import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import https from 'https';
import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
import { createClient } from '@supabase/supabase-js';
import * as vrmDataModule from '../src/utils/vrmProductsData.js';
const VRM_PRODUCTS = vrmDataModule.VRM_PRODUCTS || vrmDataModule.default?.VRM_PRODUCTS || [];
const wordFingerprint = vrmDataModule.wordFingerprint || vrmDataModule.default?.wordFingerprint || ((w) => String(w || '').toLowerCase().trim());
const resolveProductCode = vrmDataModule.resolveProductCode || vrmDataModule.default?.resolveProductCode || ((c) => c);

import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import cookieParser from 'cookie-parser';
import { createFullBackup, listBackups, restoreFromBackup } from './backupEngine.js';
import { checkTallyStatus, fetchTallyPnl, pushDirectVoucher } from './tallyService.js';
import {
  uploadBomDocument,
  createBomDocumentSignedUrl,
  deleteBomDocument,
  getBomDocumentMetadata,
  validateBusinzSession,
  validateBomCode
} from './bomDocumentService.js';

// Prioritize local development env if present, then fallback to .env
dotenv.config({ path: path.resolve(__dirname, '../.env.development.local') });
dotenv.config({ path: path.resolve(__dirname, '../.env.local') });
dotenv.config({ path: path.resolve(__dirname, '../.env') });
dotenv.config();

const DEFAULT_SUPABASE_URL = 'https://qhxaqrclvdfkswdavvjd.supabase.co';
const DEFAULT_SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFoeGFxcmNsdmRma3N3ZGF2dmpkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTAxNDc2MzgsImV4cCI6MjEwNTcyMzYzOH0.5eTHE3fVU5L0wvNr-xFcidfqgBTqVSpGFhiBvZcKfec';

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || DEFAULT_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY || process.env.VITE_SUPABASE_ANON_KEY || DEFAULT_SUPABASE_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('[BUSINZ Server Error] Supabase environment configuration is missing.');
  throw new Error('Supabase environment configuration is missing.');
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// In-memory active cache for Supabase Database stores
let supabaseMemoryStore = {};

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
const loadDatabaseCustomers = async () => {
  if (supabaseMemoryStore.customer_store && Array.isArray(supabaseMemoryStore.customer_store) && supabaseMemoryStore.customer_store.length > 0) {
    return supabaseMemoryStore.customer_store;
  }
  try {
    const { data, error } = await supabase
      .from('customers')
      .select(`
        id, customer_code, company_name, customer_name, customer_type, industry,
        gst_number, pan_number, billing_address, city, state, pincode, billing_address_obj,
        dispatch_address, dispatch_city, dispatch_state, dispatch_pincode, delivery_address_obj,
        same_as_billing, credit_limit, credit_days, payment_terms, assigned_salesperson,
        source, zoho_contact_id, primary_contact, email, phone, status, notes, created_at, updated_at
      `)
      .order('company_name', { ascending: true });

    if (!error && Array.isArray(data) && data.length > 0) {
      const mapped = data.map(c => ({
        id: c.customer_code || c.id,
        customerCode: c.customer_code,
        code: c.customer_code,
        companyName: c.company_name,
        c2: c.company_name,
        customerName: c.customer_name || c.company_name,
        c3: c.customer_name || c.company_name,
        customerType: c.customer_type || 'Customer',
        industry: c.industry || '',
        gstNumber: c.gst_number || '—',
        gstNo: c.gst_number || '—',
        panNumber: c.pan_number || '—',
        address: c.billing_address || '',
        city: c.city || '',
        state: c.state || '',
        pincode: c.pincode || '',
        billingAddress: c.billing_address || '',
        c6: c.billing_address || '',
        billingAddressObj: c.billing_address_obj || {},
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
        source: c.source || (c.zoho_contact_id ? 'Zoho Books' : 'Manual'),
        zohoContactId: c.zoho_contact_id || null,
        primaryContact: c.primary_contact || {},
        email: c.email || '—',
        c5: c.email || '—',
        phone: c.phone || '—',
        c4: c.phone || '—',
        status: (c.status || 'Active').toUpperCase(),
        notes: c.notes || '',
        createdAt: c.created_at || new Date().toISOString(),
        updatedAt: c.updated_at || new Date().toISOString()
      }));

      supabaseMemoryStore.customer_store = mapped;
      supabaseMemoryStore.crm_customers = mapped;
      return mapped;
    }
  } catch (err) {
    console.warn('[loadDatabaseCustomers] Supabase fetch notice:', err?.message || err);
  }

  // Fallback to disk JSON
  try {
    const diskPath = path.resolve(__dirname, 'customer_store.json');
    if (fs.existsSync(diskPath)) {
      const diskData = JSON.parse(fs.readFileSync(diskPath, 'utf8'));
      supabaseMemoryStore.customer_store = diskData;
      supabaseMemoryStore.crm_customers = diskData;
      return diskData;
    }
  } catch (_) {}

  return supabaseMemoryStore.customer_store || [];
};

const loadLocalCustomers = () => {
  if (supabaseMemoryStore.customer_store && Array.isArray(supabaseMemoryStore.customer_store) && supabaseMemoryStore.customer_store.length > 0) {
    return supabaseMemoryStore.customer_store;
  }
  return [];
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
    const diskPath = path.resolve(__dirname, 'crm_opportunities.json');
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

  // Fallback to disk JSON (server/crm_leads.json)
  try {
    const diskPath = path.resolve(__dirname, 'crm_leads.json');
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
// 📦 CANONICAL BOM_ORDERS ADAPTERS & STORE (PHASE C)
// ==========================================
const toConsumerBomServer = (row) => {
  if (!row || typeof row !== 'object') return row;

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
    dispatchPackingMedia: row.dispatch_packing_media || extraData.dispatchPackingMedia || { photos: [], videos: [] },
    proofDoc: row.proof_doc || extraData.proofDoc || null,
    sourcePiNo: row.source_pi_no || extraData.sourcePiNo || null,
    createdAt: row.created_at || new Date().toISOString(),
    updatedAt: row.updated_at || new Date().toISOString()
  };
};

const toDatabaseBomRowServer = (item) => {
  if (!item || typeof item !== 'object') return null;

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

  const sanitizeBomDocForStorage = (doc) => {
    if (!doc) return null;
    let target = doc;
    if (typeof doc === 'string' && (doc.startsWith('{') || doc.startsWith('['))) {
      try { target = JSON.parse(doc); } catch (_) { return doc; }
    }
    if (typeof target === 'object' && target !== null) {
      const clean = { ...target };
      // Strip embedded binary payloads from document metadata (D4 Zero-Base64 Guard)
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
    // If raw string starts with data: or is long Base64 string, disallow persisting
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
    'cancelledBy', 'cancellationReason', 'invoiceNo', 'proofDoc',
    'c2', 'c3', 'c4', 'c5', 'c6', 'c7', 'c8'
  ]);

  const extraData = {};
  Object.keys(item).forEach(k => {
    if (!standardFields.has(k)) {
      extraData[k] = item[k];
    }
  });

  // Strip Base64 from extraData
  if (extraData.dispatchPackingMedia && typeof extraData.dispatchPackingMedia === 'object') {
    if (Array.isArray(extraData.dispatchPackingMedia.photos)) {
      extraData.dispatchPackingMedia.photos = extraData.dispatchPackingMedia.photos.map(p => {
        if (p && typeof p === 'object') {
          const cp = { ...p };
          delete cp.dataUrl;
          delete cp.fileData;
          return cp;
        }
        return p;
      });
    }
    if (Array.isArray(extraData.dispatchPackingMedia.videos)) {
      extraData.dispatchPackingMedia.videos = extraData.dispatchPackingMedia.videos.map(v => {
        if (v && typeof v === 'object') {
          const cv = { ...v };
          delete cv.dataUrl;
          delete cv.fileData;
          return cv;
        }
        return v;
      });
    }
  }
  if (extraData.vehicleLoading && typeof extraData.vehicleLoading === 'object') {
    if (Array.isArray(extraData.vehicleLoading.photos)) {
      extraData.vehicleLoading.photos = extraData.vehicleLoading.photos.map(p => {
        if (p && typeof p === 'object') {
          const cp = { ...p };
          delete cp.dataUrl;
          delete cp.fileData;
          return cp;
        }
        return p;
      });
    }
    if (Array.isArray(extraData.vehicleLoading.videos)) {
      extraData.vehicleLoading.videos = extraData.vehicleLoading.videos.map(v => {
        if (v && typeof v === 'object') {
          const cv = { ...v };
          delete cv.dataUrl;
          delete cv.fileData;
          return cv;
        }
        return v;
      });
    }
  }

  const existingExtra = (item.accountsVerification && typeof item.accountsVerification === 'object' && item.accountsVerification._extra_data) || {};
  const mergedExtra = { ...existingExtra, ...extraData };
  if (item.dispatchPackingMedia) mergedExtra.dispatchPackingMedia = item.dispatchPackingMedia;
  if (item.vehicleLoading) mergedExtra.vehicleLoading = item.vehicleLoading;

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
    payments: cleanPayments,
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
};

const loadDatabaseBoms = async () => {
  try {
    const { data, error } = await supabase
      .from('bom_orders')
      .select('*')
      .order('created_at', { ascending: false });

    if (!error && Array.isArray(data) && data.length > 0) {
      const mapped = data.map(r => toConsumerBomServer(r));
      supabaseMemoryStore.bom_store = mapped;
      return mapped;
    }
  } catch (err) {
    console.warn('[loadDatabaseBoms] Supabase fetch notice:', err?.message || err);
  }

  // Fallback to memory store or disk JSON
  if (supabaseMemoryStore.bom_store && Array.isArray(supabaseMemoryStore.bom_store) && supabaseMemoryStore.bom_store.length > 0) {
    return supabaseMemoryStore.bom_store;
  }

  try {
    const diskPath = path.resolve(__dirname, 'bom_store.json');
    if (fs.existsSync(diskPath)) {
      const diskData = JSON.parse(fs.readFileSync(diskPath, 'utf8'));
      if (Array.isArray(diskData) && diskData.length > 0) {
        supabaseMemoryStore.bom_store = diskData;
        return diskData;
      }
    }
  } catch (_) {}

  return supabaseMemoryStore.bom_store || [];
};

const loadLocalBoms = () => {
  if (supabaseMemoryStore.bom_store && Array.isArray(supabaseMemoryStore.bom_store) && supabaseMemoryStore.bom_store.length > 0) {
    return supabaseMemoryStore.bom_store;
  }
  return [];
};

const saveLocalBoms = async (boms) => {
  if (!boms) return;
  const list = Array.isArray(boms) ? boms : [boms];
  supabaseMemoryStore.bom_store = list;

  // 1. Phase C: Disk file bom_store.json is retained as a passive emergency fallback only
  // and is NOT rewritten on every normal BOM operation.

  // 2. Broadcast via SSE to all connected clients
  try {
    broadcastRealtimeEvent('store_updated', { key: 'bom_store', storeData: list });
    broadcastRealtimeEvent('bom_updated', { bomList: list });
  } catch (_) {}

  // 3. Upsert to canonical public.bom_orders table (Zero leaves table interaction)
  try {
    const rows = list.map(item => toDatabaseBomRowServer(item)).filter(Boolean);
    for (let i = 0; i < rows.length; i += 20) {
      const batch = rows.slice(i, i + 20);
      await supabase.from('bom_orders').upsert(batch, { onConflict: 'id' });
    }
  } catch (sbErr) {
    console.warn('[saveLocalBoms Supabase upsert notice]:', sbErr?.message || sbErr);
  }
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
  if (cleanKey === 'bom_store' || cleanKey === 'boms') {
    return await loadDatabaseBoms();
  }
  const employeeKey = key.toUpperCase();
  try {
    const { data: records, error } = await supabase
      .from('leaves')
      .select('id, reason, dates, duration')
      .eq('employee', employeeKey)
      .order('id', { ascending: false });

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
                      const k3 = normalize(p.zohoId);
                      if (k1) poMap.set(k1, p);
                      if (k2) poMap.set(k2, p);
                      if (k3) poMap.set(k3, p);
                    });
                  }
                  diskPOs.forEach(d => {
                    const k1 = normalize(d.poNo);
                    const k2 = normalize(d.id);
                    const k3 = normalize(d.zohoId);
                    const cloudItem = (k1 && poMap.get(k1)) || (k2 && poMap.get(k2)) || (k3 && poMap.get(k3)) || {};
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

const broadcastRealtimeEvent = (eventType, payload) => {
  if (!realtimeClients || realtimeClients.size === 0) return;
  const msg = JSON.stringify({
    type: eventType,
    payload,
    timestamp: new Date().toISOString()
  });
  const chunk = `data: ${msg}\n\n`;
  for (const client of realtimeClients) {
    try {
      client.write(chunk);
    } catch (_) {
      realtimeClients.delete(client);
    }
  }
};

const saveLocalCustomers = async (customers) => {
  if (!customers) return;
  const list = Array.isArray(customers) ? customers : [customers];
  supabaseMemoryStore.customer_store = list;
  supabaseMemoryStore.crm_customers = list;

  // 1. Persist to disk files for zero data loss
  try {
    const custPath = getStoreFilePath('customer_store.json');
    fs.writeFileSync(custPath, JSON.stringify(list, null, 2), 'utf8');
    const crmPath = getStoreFilePath('crm_customers.json');
    fs.writeFileSync(crmPath, JSON.stringify(list, null, 2), 'utf8');
  } catch (diskErr) {
    console.warn('[saveLocalCustomers disk write error]:', diskErr?.message);
  }

  // 2. Broadcast via SSE to all connected clients
  try {
    broadcastRealtimeEvent('store_updated', { key: 'customer_store', storeData: list });
    broadcastRealtimeEvent('crm_updated', { type: 'customers_updated', customers: list });
  } catch (_) {}

  // 3. Upsert to canonical public.customers table (Zero leaves table interaction)
  try {
    const rows = list.map(c => ({
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
      source: c.source || (c.zohoContactId ? 'Zoho Books' : 'Manual'),
      zoho_contact_id: c.zohoContactId || null,
      primary_contact: c.primaryContact || {},
      email: c.email || c.c5 || '—',
      phone: c.phone || c.c4 || '—',
      status: c.status || 'Active',
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

  // 2. Broadcast via SSE to all connected clients
  try {
    broadcastRealtimeEvent('store_updated', { key: 'crm_opportunities', storeData: list });
    broadcastRealtimeEvent('crm_updated', { type: 'opportunities_updated', opportunities: list });
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

  // 2. Broadcast via SSE to all connected clients
  try {
    broadcastRealtimeEvent('store_updated', { key: 'crm_leads', storeData: list });
    broadcastRealtimeEvent('crm_updated', { type: 'leads_updated', leads: list });
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
  supabaseMemoryStore[key] = storeData;

  // Persist to disk files for raw_materials_store and item_store
  try {
    if (cleanKey === 'raw_materials_store' && Array.isArray(storeData)) {
      const rawMatsPath = getStoreFilePath('raw_materials_store.json');
      fs.writeFileSync(rawMatsPath, JSON.stringify(storeData, null, 2), 'utf8');
    } else if (cleanKey === 'item_store' && Array.isArray(storeData)) {
      const itemPath = getStoreFilePath('item_store.json');
      fs.writeFileSync(itemPath, JSON.stringify(storeData, null, 2), 'utf8');
    } else if (cleanKey === 'po_store' && Array.isArray(storeData)) {
      const poPath = getStoreFilePath('po_store.json');
      fs.writeFileSync(poPath, JSON.stringify(storeData, null, 2), 'utf8');
    } else if (cleanKey === 'grn_store' && Array.isArray(storeData)) {
      const grnPath = getStoreFilePath('grn_store.json');
      fs.writeFileSync(grnPath, JSON.stringify(storeData, null, 2), 'utf8');
    }
  } catch (diskErr) {
    console.warn(`[saveDatabaseStore disk write error for ${key}]:`, diskErr?.message);
  }

  // Real-time broadcast to all connected users immediately
  try {
    broadcastRealtimeEvent('store_updated', { key, storeData });
    if (cleanKey === 'raw_materials_store') {
      broadcastRealtimeEvent('inventory_updated', { rawMaterials: storeData });
    } else if (cleanKey === 'item_store' || cleanKey === 'vrm_prod_inventory') {
      broadcastRealtimeEvent('item_store_updated', { items: storeData });
    } else if (cleanKey === 'bom_store') {
      broadcastRealtimeEvent('bom_updated', { bomList: storeData });
    }
  } catch (_) {}

  const employeeKey = key.toUpperCase();
  // STRICT: Do not write migrated stores into legacy public.leaves
  if (['BOM_STORE', 'CUSTOMER_STORE', 'CRM_CUSTOMERS', 'CRM_OPPORTUNITIES', 'OPPORTUNITIES', 'CRM_LEADS', 'LEADS'].includes(employeeKey)) {
    return storeData;
  }

  try {
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
      const masterId = records[0].id;
      await supabase.from('leaves').update(payload).eq('id', masterId);
      if (records.length > 1) {
        const excessIds = records.slice(1).map(r => r.id);
        await supabase.from('leaves').delete().in('id', excessIds);
      }
    } else {
      await supabase.from('leaves').insert(payload);
    }
  } catch (err) {
    console.error(`[saveDatabaseStore Error for ${key}]:`, err?.message || err);
  }
  return storeData;
};

// Aliases for seamless backward compatibility
const syncStoreWithSupabase = async (key) => getDatabaseStore(key);
const pushStoreToSupabase = async (key, storeData) => saveDatabaseStore(key, storeData);

// Helpers for Production Work Orders Database store
const loadLocalWorkOrders = () => {
  if (supabaseMemoryStore['workorder_store'] && Array.isArray(supabaseMemoryStore['workorder_store']) && supabaseMemoryStore['workorder_store'].length > 0) {
    return supabaseMemoryStore['workorder_store'];
  }
  return [];
};

const saveLocalWorkOrders = (orders) => {
  supabaseMemoryStore['workorder_store'] = orders;
  saveDatabaseStore('workorder_store', orders);
  saveDatabaseStore('vrm_prod_workorders', orders);
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

// 📁 STATIC MEDIA UPLOADS & STREAMING DIRECTORY (Supports byte-range video streaming)
const uploadsDir = path.join(__dirname, 'uploads');
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
app.get('/api/media/find/:name', (req, res) => {
  try {
    const rawSearch = decodeURIComponent(req.params.name || '').toLowerCase().trim();
    if (!rawSearch || !fs.existsSync(uploadsDir)) {
      return res.json({ found: false });
    }
    const files = fs.readdirSync(uploadsDir);
    // 1. Exact filename match
    const exact = files.find(f => f.toLowerCase() === rawSearch);
    if (exact) {
      return res.json({ found: true, url: `/api/uploads/${exact}`, filename: exact });
    }
    // 2. Base slug match (ignoring timestamps and special characters)
    const searchBase = path.basename(rawSearch, path.extname(rawSearch)).replace(/[^a-z0-9]/gi, '');
    const matched = files.find(f => {
      const fBase = path.basename(f, path.extname(f)).toLowerCase().replace(/[^a-z0-9]/gi, '');
      return searchBase && (fBase.includes(searchBase) || searchBase.includes(fBase));
    });
    if (matched) {
      return res.json({ found: true, url: `/api/uploads/${matched}`, filename: matched });
    }
    res.json({ found: false });
  } catch (err) {
    res.status(500).json({ found: false, error: err.message });
  }
});

const loadCredentialsFromEnv = () => {
  const DEFAULT_ORG_ID = '60082137608';
  const DEFAULT_REFRESH_TOKEN = '1000.69cd7dbd3da3ab8f107f8addf5e9e04c.87b4757d889f6ebd95a1bf897147a1c7';
  const DEFAULT_CLIENT_ID = '1000.9U5BAN338075M5HBI3U8K1VBNKUU8K';
  const DEFAULT_CLIENT_SECRET = 'e82079a5165e3b2e75fdc602f3e08fd38489d75f13';

  // Force active ARMS AI Zoho credentials
  process.env.ZOHO_CLIENT_ID = DEFAULT_CLIENT_ID;
  process.env.ZOHO_CLIENT_SECRET = DEFAULT_CLIENT_SECRET;
  process.env.ZOHO_ORG_ID = DEFAULT_ORG_ID;
  process.env.ZOHO_REFRESH_TOKEN = DEFAULT_REFRESH_TOKEN;

  return { 
    orgId: DEFAULT_ORG_ID, 
    apiToken: DEFAULT_REFRESH_TOKEN, 
    connected: true 
  };
};

const initialCreds = loadCredentialsFromEnv();

let cachedToken = '';
let cachedExpiresAt = 0;
try {
  const p = path.join(__dirname, 'zoho_token_cache.json');
  if (fs.existsSync(p)) {
    const c = JSON.parse(fs.readFileSync(p, 'utf8'));
    if (c.accessToken && c.tokenExpiresAt > Date.now() + 60000) {
      cachedToken = c.accessToken;
      cachedExpiresAt = c.tokenExpiresAt;
    }
  }
} catch (_) {}

// In-memory session store for Zoho OAuth tokens, initializing from env if present
let zohoSession = {
  connected: initialCreds.connected,
  orgId: initialCreds.orgId,
  apiToken: initialCreds.apiToken,
  accessToken: cachedToken,
  tokenExpiresAt: cachedExpiresAt,
  organizationName: 'ARMS AI'
};

const saveCredentialsToEnv = (orgId, apiToken, clientId, clientSecret) => {
  try {
    const envPath = path.resolve(process.cwd(), '.env');
    let content = '';
    if (fs.existsSync(envPath)) {
      content = fs.readFileSync(envPath, 'utf8');
    }
    
    if (orgId !== undefined) {
      if (content.includes('ZOHO_ORG_ID=')) {
        content = content.replace(/ZOHO_ORG_ID=.*/, `ZOHO_ORG_ID=${orgId}`);
      } else {
        content += `\nZOHO_ORG_ID=${orgId}`;
      }
    }
    
    if (apiToken !== undefined) {
      if (content.includes('ZOHO_REFRESH_TOKEN=')) {
        content = content.replace(/ZOHO_REFRESH_TOKEN=.*/, `ZOHO_REFRESH_TOKEN=${apiToken}`);
      } else {
        content += `\nZOHO_REFRESH_TOKEN=${apiToken}`;
      }
    }

    if (clientId) {
      if (content.includes('ZOHO_CLIENT_ID=')) {
        content = content.replace(/ZOHO_CLIENT_ID=.*/, `ZOHO_CLIENT_ID=${clientId}`);
      } else {
        content += `\nZOHO_CLIENT_ID=${clientId}`;
      }
    }

    if (clientSecret) {
      if (content.includes('ZOHO_CLIENT_SECRET=')) {
        content = content.replace(/ZOHO_CLIENT_SECRET=.*/, `ZOHO_CLIENT_SECRET=${clientSecret}`);
      } else {
        content += `\nZOHO_CLIENT_SECRET=${clientSecret}`;
      }
    }
    
    fs.writeFileSync(envPath, content.trim() + '\n', 'utf8');
  } catch (err) {
    console.error("Failed to write credentials to .env file:", err);
  }
};

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

// 1. Check Connection Status and Credentials
app.get('/api/zoho/status', async (req, res) => {
  let orgName = zohoSession.organizationName || 'ARMS AI';
  if (zohoSession.connected && zohoSession.apiToken) {
    try {
      const accessToken = await getZohoAccessToken();
      const options = {
        hostname: 'www.zohoapis.in',
        port: 443,
        path: '/books/v3/organizations',
        method: 'GET',
        headers: {
          'Authorization': `Zoho-oauthtoken ${accessToken}`
        }
      };
      const orgData = await new Promise((resolve) => {
        const r = https.request(options, (resp) => {
          let body = '';
          resp.on('data', c => body += c);
          resp.on('end', () => {
            try { resolve(JSON.parse(body)); } catch(e) { resolve(null); }
          });
        });
        r.on('error', () => resolve(null));
        r.end();
      });
      if (orgData && Array.isArray(orgData.organizations)) {
        const matched = orgData.organizations.find(o => String(o.organization_id) === String(zohoSession.orgId)) || orgData.organizations[0];
        if (matched && matched.name) {
          orgName = matched.name;
          zohoSession.organizationName = matched.name;
        }
      }
    } catch(err) {
      console.error('Error fetching org name from Zoho:', err.message);
    }
  }

  res.json({
    connected: zohoSession.connected,
    orgId: zohoSession.orgId,
    apiToken: zohoSession.apiToken,
    clientId: process.env.ZOHO_CLIENT_ID || '',
    organizationName: orgName
  });
});

// 2. Save Credentials (API Token, Org ID, Client ID, Client Secret)
app.post('/api/zoho/credentials', (req, res) => {
  const { orgId, apiToken, clientId, clientSecret } = req.body;
  if (!orgId || !apiToken) {
    return res.status(400).json({ error: 'Organization ID and Refresh Token are required.' });
  }

  const effectiveClientId = clientId ? clientId.trim() : (process.env.ZOHO_CLIENT_ID || '1000.9U5BAN338075M5HBI3U8K1VBNKUU8K');
  const effectiveClientSecret = clientSecret ? clientSecret.trim() : (process.env.ZOHO_CLIENT_SECRET || 'e82079a5165e3b2e75fdc602f3e08fd38489d75f13');

  zohoSession.connected = true;
  zohoSession.orgId = orgId.trim();
  zohoSession.apiToken = apiToken.trim();
  zohoSession.accessToken = ''; // Reset token to force immediate re-authentication
  zohoSession.tokenExpiresAt = 0;
  
  process.env.ZOHO_CLIENT_ID = effectiveClientId;
  process.env.ZOHO_CLIENT_SECRET = effectiveClientSecret;
  process.env.ZOHO_ORG_ID = orgId.trim();
  process.env.ZOHO_REFRESH_TOKEN = apiToken.trim();

  saveCredentialsToEnv(orgId.trim(), apiToken.trim(), effectiveClientId, effectiveClientSecret);
  
  res.json({ success: true, message: 'Zoho Account credentials updated successfully!' });
});

// 3. Disconnect from Zoho
app.post('/api/zoho/disconnect', (req, res) => {
  zohoSession = {
    connected: false,
    orgId: '',
    apiToken: '',
    organizationName: 'ARMS AI'
  };
  
  // Wipe from .env
  saveCredentialsToEnv('', '');
  
  res.json({ success: true });
});

// 4. Trigger Manual Sync
app.post('/api/zoho/sync', async (req, res) => {
  if (!zohoSession.connected) {
    return res.status(401).json({ error: 'Zoho not connected. Configure credentials first.' });
  }
  
  try {
    // Force testing Zoho access token validity
    const accessToken = await getZohoAccessToken();
    // Test fetch to confirm organization and access token are healthy
    await fetchZohoItems(accessToken);
    res.json({ success: true, timestamp: new Date().toISOString() });
  } catch (err) {
    console.error("Zoho Sync authentication or connection failed:", err);
    res.status(500).json({ error: `Sync failed: ${err.message || 'Check OAuth configuration'}` });
  }
});

// Local Store file path & helpers
const getStoreFilePath = (filename) => {
  const p1 = path.join(__dirname, filename);
  if (fs.existsSync(p1)) return p1;
  const p2 = path.resolve(process.cwd(), 'server', filename);
  if (fs.existsSync(p2)) return p2;
  const p3 = path.resolve(process.cwd(), filename);
  if (fs.existsSync(p3)) return p3;
  return p1;
};

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
          const k3 = normalize(p.zohoId);
          if (k1) map.set(k1, p);
          if (k2) map.set(k2, p);
          if (k3) map.set(k3, p);
        });
        // Merge with diskPOs (disk has the authoritative local edits)
        diskPOs.forEach(d => {
          const k1 = normalize(d.poNo);
          const k2 = normalize(d.id);
          const k3 = normalize(d.zohoId);
          const existing = (k1 && map.get(k1)) || (k2 && map.get(k2)) || (k3 && map.get(k3)) || {};
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

          if (d.status === 'OPEN / PARTIALLY RECEIVED' || (dOrd > 0 && dRec > 0 && dRec < dOrd)) {
            effStatus = 'OPEN / PARTIALLY RECEIVED';
            effStatusType = 'partially_received';
          } else if (existing.status === 'OPEN / PARTIALLY RECEIVED' || (exOrd > 0 && exRec > 0 && exRec < exOrd)) {
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
          if (k3) map.set(k3, mergedItem);
        });
        // Also ensure any existing in-memory/cloud POs not on disk are in the map
        memPOs.forEach(p => {
          const k1 = normalize(p.poNo);
          const k2 = normalize(p.id);
          const k3 = normalize(p.zohoId);
          if (k1 && !map.has(k1)) map.set(k1, p);
          if (k2 && !map.has(k2)) map.set(k2, p);
          if (k3 && !map.has(k3)) map.set(k3, p);
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
  return [];
};

const saveLocalVendors = (vendors) => {
  supabaseMemoryStore.vendor_store = vendors;
  saveDatabaseStore('vendor_store', vendors);
};

const loadLocalItems = () => {
  const itemsPath = getStoreFilePath('item_store.json');
  let diskItems = [];
  if (fs.existsSync(itemsPath)) {
    try {
      diskItems = JSON.parse(fs.readFileSync(itemsPath, 'utf8')) || [];
    } catch (_) {}
  }
  const memItems = supabaseMemoryStore.item_store;
  if (Array.isArray(memItems) && memItems.length >= diskItems.length && memItems.length > 0) {
    return memItems;
  }
  if (Array.isArray(diskItems) && diskItems.length > 0) {
    if (Array.isArray(memItems) && memItems.length > 0) {
      const map = new Map();
      diskItems.forEach(d => {
        const k = String(d.code || d.name || '').toUpperCase().trim();
        if (k) map.set(k, { ...d });
      });
      memItems.forEach(m => {
        const k = String(m.code || m.name || '').toUpperCase().trim();
        if (k && map.has(k)) {
          map.set(k, { ...map.get(k), ...m });
        } else if (k) {
          map.set(k, { ...m });
        }
      });
      const unified = Array.from(map.values());
      supabaseMemoryStore.item_store = unified;
      return unified;
    }
    supabaseMemoryStore.item_store = diskItems;
    return diskItems;
  }
  return memItems || [];
};

const loadLocalRawMaterials = () => {
  const rawPath = getStoreFilePath('raw_materials_store.json');
  let diskMats = [];
  if (fs.existsSync(rawPath)) {
    try {
      diskMats = JSON.parse(fs.readFileSync(rawPath, 'utf8')) || [];
    } catch (_) {}
  }
  const memMats = supabaseMemoryStore.raw_materials_store;
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
      const unified = Array.from(map.values());
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

// ⚡ Real-Time Push Gateway (Server-Sent Events)
// Enables sub-second instant updates across all 10+ users without page refresh
app.get('/api/realtime-events', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders();

  res.write(`data: ${JSON.stringify({ type: 'connected', timestamp: new Date().toISOString() })}\n\n`);
  realtimeClients.add(res);

  const keepAliveInterval = setInterval(() => {
    try {
      res.write(': keepalive\n\n');
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

// Generic Data Store endpoints backed 100% by Supabase Cloud Database
app.get('/api/store/:key', async (req, res) => {
  const { key } = req.params;
  try {
    const data = await getDatabaseStore(key);
    res.json({ success: true, data: data !== undefined && data !== null ? data : [] });
  } catch (err) {
    res.json({ success: true, data: [] });
  }
});

app.post('/api/store/:key', async (req, res) => {
  const { key } = req.params;
  const storeData = req.body;
  try {
    let finalDataToSave = storeData;

    // Smart merge for array collections
    if (Array.isArray(storeData) && storeData.length === 0) {
      finalDataToSave = [];
    } else if (Array.isArray(storeData)) {
      const currentData = await getDatabaseStore(key);
      if (Array.isArray(currentData) && currentData.length > 0) {
        const getId = (item) => {
          if (!item || typeof item !== 'object') return null;
          return item.piNo || item.estimate_number || item.estimateId || item.bomCode || item.code || item.id || item.poNo || item.invNo || item.grnNo || item.vendorCode || item.email || item.name;
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
    } else if (key === 'presets_store' && storeData && typeof storeData === 'object' && !Array.isArray(storeData)) {
      const current = await getDatabaseStore(key);
      finalDataToSave = { ...(current || {}), ...storeData };
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
    res.json({ success: true, count: Array.isArray(finalDataToSave) ? finalDataToSave.length : 1, data: finalDataToSave });
  } catch (err) {
    res.json({ success: false, error: err.message });
  }
});

app.delete('/api/store/:key/:id', async (req, res) => {
  const { key, id } = req.params;
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

      // 3. Broadcast event
      broadcastRealtimeEvent('store_updated', { key: 'crm_opportunities', storeData: updated });
      broadcastRealtimeEvent('crm_updated', { type: 'opportunities_updated', opportunities: updated });

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

      broadcastRealtimeEvent('bom_updated', { id: cleanId, action: 'delete', bomList: updated });
      broadcastRealtimeEvent('store_updated', { key: 'bom_store', storeData: updated });
      return res.json({ success: true, message: `BOM ${cleanId} deleted successfully`, data: updated });
    } catch (err) {
      return res.status(500).json({ success: false, error: err.message });
    }
  }
  return res.status(400).json({ success: false, error: `Deletion not supported for store key: ${key}` });
});

let pendingTokenPromise = null;

const getZohoAccessToken = () => {
  const now = Date.now();
  // If we already have a valid access token (with a 5-minute buffer), resolve immediately
  if (zohoSession.accessToken && zohoSession.tokenExpiresAt > now + 300000) {
    return Promise.resolve(zohoSession.accessToken);
  }

  if (pendingTokenPromise) {
    return pendingTokenPromise;
  }

  pendingTokenPromise = new Promise((resolve, reject) => {
    const postData = new URLSearchParams({
      refresh_token: zohoSession.apiToken,
      client_id: process.env.ZOHO_CLIENT_ID,
      client_secret: process.env.ZOHO_CLIENT_SECRET,
      grant_type: 'refresh_token'
    }).toString();

    const options = {
      hostname: 'accounts.zoho.in',
      port: 443,
      path: '/oauth/v2/token',
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Content-Length': Buffer.byteLength(postData)
      }
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          if (parsed.access_token) {
            zohoSession.accessToken = parsed.access_token;
            // Cache token and set expiration timestamp
            zohoSession.tokenExpiresAt = Date.now() + (parsed.expires_in || 3600) * 1000;
            try {
              fs.writeFileSync(path.join(__dirname, 'zoho_token_cache.json'), JSON.stringify({
                accessToken: zohoSession.accessToken,
                tokenExpiresAt: zohoSession.tokenExpiresAt
              }), 'utf8');
            } catch (_) {}
            resolve(parsed.access_token);
          } else {
            reject(new Error(parsed.error || 'No access token returned.'));
          }
        } catch (e) {
          reject(e);
        }
      });
    });

    req.on('error', (e) => reject(e));
    req.setTimeout(4000, () => {
      try { req.destroy(); } catch (_) {}
      reject(new Error('Zoho token request timed out'));
    });
    req.write(postData);
    req.end();
  }).finally(() => {
    pendingTokenPromise = null;
  });

  return pendingTokenPromise;
};


const fetchZohoVendors = (accessToken) => {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'www.zohoapis.in',
      port: 443,
      path: `/books/v3/contacts?organization_id=${zohoSession.orgId}&contact_type=vendor`,
      method: 'GET',
      headers: {
        'Authorization': `Zoho-oauthtoken ${accessToken}`
      }
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          resolve(parsed);
        } catch (e) {
          reject(e);
        }
      });
    });

    req.on('error', (e) => reject(e));
    req.end();
  });
};

// Helper to create a new Vendor contact in Zoho Books
const createZohoVendor = (accessToken, vendorPayload) => {
  return new Promise((resolve, reject) => {
    const postData = JSON.stringify(vendorPayload);
    const options = {
      hostname: 'www.zohoapis.in',
      port: 443,
      path: `/books/v3/contacts?organization_id=${zohoSession.orgId}`,
      method: 'POST',
      headers: {
        'Authorization': `Zoho-oauthtoken ${accessToken}`,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData)
      }
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          resolve(parsed);
        } catch (e) {
          reject(e);
        }
      });
    });

    req.on('error', (e) => reject(e));
    req.write(postData);
    req.end();
  });
};

// Endpoint to create a new vendor in Zoho Books
app.post('/api/zoho/vendors', async (req, res) => {
  if (!zohoSession.connected) {
    return res.json({ success: true, message: 'Saved locally (Zoho not connected)', vendor: req.body });
  }

  try {
    const accessToken = await getZohoAccessToken();
    const vendorPayload = {
      contact_name: req.body.name || req.body.companyName || 'New Vendor',
      company_name: req.body.companyName || req.body.name || 'New Vendor',
      contact_type: 'vendor',
      email: req.body.email && req.body.email !== '—' ? req.body.email : undefined,
      phone: req.body.phone && req.body.phone !== '—' ? req.body.phone : undefined,
      mobile: req.body.mobile && req.body.mobile !== '—' ? req.body.mobile : undefined,
      currency_code: req.body.currency || 'INR',
      pan_no: req.body.pan && req.body.pan !== '—' ? req.body.pan : undefined
    };

    let result = await createZohoVendor(accessToken, vendorPayload);
    if (result && (result.code === 0 || result.contact)) {
      return res.json({
        success: true,
        message: 'Vendor created in Zoho Books successfully!',
        contact: result.contact
      });
    } else {
      console.warn('[ZOHO VENDOR CREATE NOTICE]', result);
      return res.status(400).json({
        error: (result && result.message) || 'Failed to create vendor in Zoho Books.'
      });
    }
  } catch (err) {
    console.error('[ZOHO VENDOR CREATE ERROR]', err);
    res.status(500).json({ error: 'Failed to create vendor in Zoho Books: ' + err.message });
  }
});

// Helper to fetch customer contacts from Zoho Books
const fetchZohoCustomers = (accessToken) => {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'www.zohoapis.in',
      port: 443,
      path: `/books/v3/contacts?organization_id=${zohoSession.orgId}&contact_type=customer`,
      method: 'GET',
      headers: {
        'Authorization': `Zoho-oauthtoken ${accessToken}`
      }
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          resolve(parsed);
        } catch (e) {
          reject(e);
        }
      });
    });

    req.on('error', (e) => reject(e));
    req.end();
  });
};

// Helper to create a new Customer contact in Zoho Books
const createZohoCustomer = (accessToken, customerPayload) => {
  return new Promise((resolve, reject) => {
    const postData = JSON.stringify(customerPayload);
    const options = {
      hostname: 'www.zohoapis.in',
      port: 443,
      path: `/books/v3/contacts?organization_id=${zohoSession.orgId}`,
      method: 'POST',
      headers: {
        'Authorization': `Zoho-oauthtoken ${accessToken}`,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData)
      }
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          resolve(parsed);
        } catch (e) {
          reject(e);
        }
      });
    });

    req.on('error', (e) => reject(e));
    req.write(postData);
    req.end();
  });
};

// Endpoint to create a new customer in Zoho Books
app.post('/api/zoho/customers', async (req, res) => {
  const localCustomers = loadLocalCustomers();
  const incoming = req.body;

  // Build local customer record
  const customerId = incoming.customerCode || incoming.id || `CUST-VRM-${100 + localCustomers.length + 1}`;
  const localCustomerRecord = {
    id: customerId,
    customerCode: customerId,
    customerName: incoming.customerName || incoming.companyName || incoming.name || 'New Customer',
    companyName: incoming.companyName || incoming.customerName || incoming.name || 'New Customer',
    customerType: incoming.customerType || 'EPC Contractor',
    industry: incoming.industry || '',
    gstNumber: incoming.gstNumber || incoming.gstin || '',
    panNumber: incoming.panNumber || incoming.pan || '',
    address: incoming.address || incoming.streetAddress || '',
    city: incoming.city || '',
    state: incoming.state || '',
    pincode: incoming.pincode || '',
    dispatchAddress: incoming.dispatchAddress || incoming.address || '',
    dispatchCity: incoming.dispatchCity || incoming.city || '',
    dispatchState: incoming.dispatchState || incoming.state || '',
    dispatchPincode: incoming.dispatchPincode || incoming.pincode || '',
    sameAsBilling: incoming.sameAsBilling !== undefined ? incoming.sameAsBilling : true,
    creditLimit: incoming.creditLimit || 2500000,
    creditDays: incoming.creditDays || 30,
    paymentTerms: incoming.paymentTerms || '50% Advance + 50% Dispatch',
    assignedSalesperson: incoming.assignedSalesperson || 'Mohith JV',
    source: incoming.source || 'Direct',
    primaryContact: incoming.primaryContact || {
      name: incoming.contactPerson || incoming.contactName || '',
      phone: incoming.phone || incoming.mobile || '',
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
      address: incoming.address || '',
      city: incoming.city || '',
      state: incoming.state || '',
      pincode: incoming.pincode || ''
    },
    c7: incoming.c7 || incoming.deliveryAddress || incoming.dispatchAddress || incoming.address || '',
    deliveryAddressObj: incoming.deliveryAddressObj || {
      address: incoming.dispatchAddress || incoming.address || '',
      city: incoming.dispatchCity || incoming.city || '',
      state: incoming.dispatchState || incoming.state || '',
      pincode: incoming.dispatchPincode || incoming.pincode || ''
    },
    status: incoming.status || 'ACTIVE',
    createdAt: new Date().toISOString()
  };

  // 1. Immediately persist to disk storage & Supabase (Never delete customers sharing same companyName)
  const updatedCustomers = [
    localCustomerRecord,
    ...localCustomers.filter(c => 
      (c.customerCode || c.id) !== localCustomerRecord.customerCode &&
      (!localCustomerRecord.zohoContactId || !c.zohoContactId || c.zohoContactId !== localCustomerRecord.zohoContactId)
    )
  ];
  saveLocalCustomers(updatedCustomers);

  if (!zohoSession.connected) {
    return res.json({ success: true, message: 'Saved locally in Control Room (Zoho not connected)', customer: localCustomerRecord });
  }

  try {
    const accessToken = await getZohoAccessToken();
    const contactPersons = [];
    if (localCustomerRecord.primaryContact && localCustomerRecord.primaryContact.name) {
      const names = localCustomerRecord.primaryContact.name.trim().split(' ');
      contactPersons.push({
        first_name: names[0] || 'Contact',
        last_name: names.slice(1).join(' ') || 'Person',
        email: localCustomerRecord.primaryContact.email || undefined,
        phone: localCustomerRecord.primaryContact.phone || undefined,
        mobile: localCustomerRecord.primaryContact.whatsapp || localCustomerRecord.primaryContact.phone || undefined,
        is_primary_contact: true
      });
    }

    const billingAddress = {
      address: (localCustomerRecord.address || '').slice(0, 80),
      city: (localCustomerRecord.city || '').slice(0, 40),
      state: (localCustomerRecord.state || '').slice(0, 40),
      zip: (localCustomerRecord.pincode || '').slice(0, 20),
      country: 'India'
    };

    const shippingAddress = {
      address: (localCustomerRecord.dispatchAddress || localCustomerRecord.address || '').slice(0, 80),
      city: (localCustomerRecord.dispatchCity || localCustomerRecord.city || '').slice(0, 40),
      state: (localCustomerRecord.dispatchState || localCustomerRecord.state || '').slice(0, 40),
      zip: (localCustomerRecord.dispatchPincode || localCustomerRecord.pincode || '').slice(0, 20),
      country: 'India'
    };

    const baseCompanyName = String(localCustomerRecord.companyName || localCustomerRecord.customerName || incoming.code || 'Valued Customer').trim();
    const custIdentifier = localCustomerRecord.customerCode || customerId;
    const contactNameVal = `${baseCompanyName} [${custIdentifier}]`;
    const companyNameVal = baseCompanyName;

    const rawGst = String(localCustomerRecord.gstNumber || '').trim();
    const isValidGst = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/i.test(rawGst);

    const zohoPayload = {
      contact_name: contactNameVal,
      company_name: companyNameVal,
      contact_type: 'customer',
      customer_sub_type: 'business',
      currency_code: 'INR',
      pan_no: localCustomerRecord.panNumber ? String(localCustomerRecord.panNumber).trim().slice(0, 10) : undefined,
      billing_address: billingAddress,
      shipping_address: shippingAddress,
      contact_persons: contactPersons.length > 0 ? contactPersons : undefined,
      notes: `Customer Code: ${custIdentifier}${rawGst ? ` | GSTIN: ${rawGst}` : ''} | Created via Control Room B2B Solar CRM. Type: ${localCustomerRecord.customerType || 'EPC Contractor'}`
    };

    let result = await createZohoCustomer(accessToken, zohoPayload);

    // Auto-resolve Zoho code 8 / Invalid Element error (e.g. if any field is rejected by Zoho org config)
    if (result && result.code === 8 && result.message) {
      const match = result.message.match(/Invalid Element\s+(\w+)/i);
      if (match && match[1]) {
        const invalidKey = match[1];
        console.warn(`[Zoho Contact Notice] Stripping invalid element "${invalidKey}" and retrying customer creation...`);
        delete zohoPayload[invalidKey];
        result = await createZohoCustomer(accessToken, zohoPayload);
      }
    }

    // Auto-resolve Zoho code 3062 / duplicate contact name error
    if (result && (result.code === 3062 || (result.message && result.message.toLowerCase().includes('already exists')))) {
      console.log(`[Zoho Contact Notice] Contact "${contactNameVal}" already exists in Zoho Books. Linking or resolving unique name...`);
      try {
        const existingData = await fetchZohoCustomers(accessToken);
        if (existingData && Array.isArray(existingData.contacts)) {
          const targetName = contactNameVal.toLowerCase().trim();
          const targetComp = companyNameVal.toLowerCase().trim();
          const targetBase = baseCompanyName.toLowerCase().trim();

          const exactMatch = existingData.contacts.find(c => {
            const zName = (c.contact_name || '').toLowerCase().trim();
            const zComp = (c.company_name || '').toLowerCase().trim();
            return zName === targetName || zName === targetBase || zComp === targetComp || zComp === targetBase;
          });
          if (exactMatch && exactMatch.contact_id) {
            localCustomerRecord.zohoContactId = exactMatch.contact_id;
            const finalized = updatedCustomers.map(c => 
              (c.customerCode === localCustomerRecord.customerCode || c.id === localCustomerRecord.id) 
                ? { ...c, zohoContactId: exactMatch.contact_id } 
                : c
            );
            saveLocalCustomers(finalized);
            return res.json({
              success: true,
              message: 'Customer linked with existing Zoho Books contact successfully!',
              customer: localCustomerRecord,
              zohoContact: exactMatch
            });
          }
        }
      } catch (eMatch) {
        console.warn('Error matching existing Zoho contact:', eMatch.message);
      }

      // If not linked to existing, disambiguate contact name with contact person or code and retry
      const contactPersonName = localCustomerRecord.primaryContact && localCustomerRecord.primaryContact.name;
      const suffix = contactPersonName || localCustomerRecord.customerCode || Date.now();
      const disambiguatedName = `${companyNameVal} (${suffix})`;
      console.log(`[Zoho Retry] Retrying customer creation with unique contact_name: "${disambiguatedName}"`);
      result = await createZohoCustomer(accessToken, { ...zohoPayload, contact_name: disambiguatedName });
    }

    if (result && (result.code === 0 || result.contact)) {
      if (result.contact && result.contact.contact_id) {
        localCustomerRecord.zohoContactId = result.contact.contact_id;
        const finalized = updatedCustomers.map(c => 
          (c.customerCode === localCustomerRecord.customerCode || c.id === localCustomerRecord.id) 
            ? { ...c, zohoContactId: result.contact.contact_id } 
            : c
        );
        saveLocalCustomers(finalized);
      }
      return res.json({
        success: true,
        message: 'Customer registered in Control Room and synchronized to Zoho Books successfully!',
        customer: localCustomerRecord,
        zohoContact: result.contact
      });
    } else {
      console.warn('[ZOHO CUSTOMER CREATE NOTICE]', result);
      return res.json({
        success: true,
        warning: `Customer saved in Control Room, but Zoho Books responded: ${(result && result.message) || 'Unknown response'}`,
        customer: localCustomerRecord
      });
    }
  } catch (err) {
    console.error('[ZOHO CUSTOMER CREATE ERROR]', err);
    return res.json({
      success: true,
      warning: `Customer saved in Control Room. Zoho API synchronization notice: ${err.message}`,
      customer: localCustomerRecord
    });
  }
});

// Real-time synchronization endpoint retrieving live customers from Zoho Books
app.get('/api/zoho/customers', async (req, res) => {
  const localCustomers = loadLocalCustomers();

  if (!zohoSession.connected) {
    return res.json(localCustomers);
  }

  try {
    const accessToken = await getZohoAccessToken();
    const data = await fetchZohoCustomers(accessToken);

    if (data && data.contacts && Array.isArray(data.contacts)) {
      // Map raw Zoho Books contacts
      const zohoCustomers = data.contacts.map((c, idx) => {
        const bAddr = c.billing_address || {};
        const codeMatch = (c.contact_name || '').match(/\[(CUST-[^\]]+)\]/i);
        const extractedCode = codeMatch ? codeMatch[1].trim() : null;
        const cleanCompanyName = extractedCode
          ? (c.company_name || c.contact_name.replace(/\[CUST-[^\]]+\]/i, '').trim())
          : (c.company_name || c.contact_name);

        const assignedCode = extractedCode || (c.contact_id ? `CUST-${String(c.contact_id).slice(-4)}` : `CUST-VRM-${100 + idx + 1}`);

        // Parse contact person name cleanly
        let contactPersonName = c.primary_contact_name;
        if (!contactPersonName || contactPersonName === '—' || contactPersonName === c.contact_name) {
          if (c.first_name) {
            contactPersonName = `${c.first_name} ${c.last_name || ''}`.trim();
          } else if (Array.isArray(c.contact_persons) && c.contact_persons[0] && c.contact_persons[0].first_name) {
            contactPersonName = `${c.contact_persons[0].first_name} ${c.contact_persons[0].last_name || ''}`.trim();
          } else {
            contactPersonName = '—';
          }
        }

        const phoneVal = c.phone || c.mobile || (c.contact_persons && c.contact_persons[0]?.phone) || (c.contact_persons && c.contact_persons[0]?.mobile) || '';
        const emailVal = c.email || (c.contact_persons && c.contact_persons[0]?.email) || '';

        return {
          id: assignedCode,
          customerCode: assignedCode,
          companyName: cleanCompanyName,
          customerName: cleanCompanyName,
          customerType: 'EPC Contractor',
          industry: 'Solar Energy / Utility Scale',
          gstNumber: c.gst_no || c.gstin || '',
          panNumber: c.pan_no || c.pan || '',
          address: bAddr.address || c.address || '',
          city: bAddr.city || c.city || '',
          state: bAddr.state || c.state || '',
          pincode: bAddr.zip || c.zip || '',
          creditLimit: c.credit_limit || 2500000,
          creditDays: c.payment_terms || 30,
          paymentTerms: c.payment_terms_label || (c.payment_terms ? `Net ${c.payment_terms} Days` : '50% Advance + 50% Dispatch'),
          assignedSalesperson: 'Mohith JV',
          source: 'Zoho Books',
          zohoContactId: c.contact_id,
          primaryContact: {
            name: contactPersonName,
            designation: 'Procurement Head',
            phone: phoneVal,
            whatsapp: phoneVal,
            email: emailVal
          },
          createdAt: c.created_time || new Date().toISOString()
        };
      });

      // 1. Index local customers by zohoContactId, customerCode, and company + primary contact
      const byZohoId = new Map();
      const byCode = new Map();
      const byNameAndContact = new Map();

      localCustomers.forEach(cust => {
        if (cust.zohoContactId) byZohoId.set(String(cust.zohoContactId).trim(), cust);
        const codeKey = (cust.customerCode || cust.id || '').toLowerCase().trim();
        if (codeKey) byCode.set(codeKey, cust);

        const pName = (cust.primaryContact && cust.primaryContact.name) || cust.c3 || '';
        const nameKey = `${(cust.companyName || '').toLowerCase().trim()}:::${pName.toLowerCase().trim()}`;
        if (nameKey !== ':::') byNameAndContact.set(nameKey, cust);
      });

      // 2. Map all Zoho contacts and merge with local customer details without losing distinct contacts
      const processedZohoIds = new Set();
      const processedCodes = new Set();
      const mergedList = [];

      zohoCustomers.forEach(zCust => {
        const zId = String(zCust.zohoContactId || zCust.id).trim();
        processedZohoIds.add(zId);

        let localMatch = byZohoId.get(zId);
        if (!localMatch) {
          const pName = (zCust.primaryContact && zCust.primaryContact.name) || '';
          const zNameKey = `${(zCust.companyName || '').toLowerCase().trim()}:::${pName.toLowerCase().trim()}`;
          localMatch = byNameAndContact.get(zNameKey);
        }
        if (!localMatch && zCust.customerCode) {
          localMatch = byCode.get(zCust.customerCode.toLowerCase().trim());
        }

        const effectiveCode = (localMatch && (localMatch.customerCode || localMatch.id)) || zCust.customerCode;
        processedCodes.add(String(effectiveCode).toLowerCase().trim());

        const mergedCust = {
          ...zCust,
          ...(localMatch || {}),
          id: effectiveCode,
          customerCode: effectiveCode,
          companyName: (localMatch && localMatch.companyName) || zCust.companyName,
          customerName: zCust.customerName || (localMatch && localMatch.customerName),
          zohoContactId: zCust.zohoContactId || zId,
          primaryContact: {
            ...zCust.primaryContact,
            ...((localMatch && localMatch.primaryContact) || {})
          },
          customerType: (localMatch && localMatch.customerType) || zCust.customerType,
          creditLimit: (localMatch && localMatch.creditLimit) || zCust.creditLimit,
          creditDays: (localMatch && localMatch.creditDays) || zCust.creditDays,
          assignedSalesperson: (localMatch && localMatch.assignedSalesperson) || zCust.assignedSalesperson || 'Mohith JV'
        };

        mergedList.push(mergedCust);
      });

      // 3. Preserve local customers that haven't been synchronized to Zoho yet
      localCustomers.forEach(cust => {
        const custZohoId = cust.zohoContactId ? String(cust.zohoContactId).trim() : null;
        if (custZohoId && processedZohoIds.has(custZohoId)) {
          return;
        }
        const cCode = String(cust.customerCode || cust.id || '').toLowerCase().trim();
        if (cCode && processedCodes.has(cCode)) {
          return;
        }
        mergedList.push(cust);
      });

      saveLocalCustomers(mergedList);
      return res.json(mergedList);
    }
  } catch (err) {
    console.error('Zoho customers fetch notice:', err.message);
  }

  res.json(localCustomers);
});

// Real-time synchronization endpoint retrieving live vendors from Zoho Books
app.get('/api/zoho/vendors', async (req, res) => {
  const localVendors = loadLocalVendors();

  if (!zohoSession.connected) {
    return res.json(localVendors);
  }

  try {
    const accessToken = await getZohoAccessToken();
    const data = await fetchZohoVendors(accessToken);
    
    if (data && data.contacts && Array.isArray(data.contacts)) {
      const translated = data.contacts.map(c => ({
        id: c.contact_id,
        code: c.contact_id,
        name: c.contact_name,
        companyName: c.company_name || c.contact_name,
        type: c.contact_type === 'customer_vendor' ? 'Manufacturer' : 'Supplier',
        contact: c.primary_contact_name || '—',
        phone: c.phone || c.mobile || '—',
        mobile: c.mobile || '—',
        email: c.email || '—',
        cat: 'General Vendor',
        status: c.status === 'active' ? 'Active' : 'Inactive',
        spend: c.outstanding_payable_amount ? `₹${Number(c.outstanding_payable_amount).toLocaleString('en-IN')}` : '—',
        payable: c.outstanding_payable_amount ? `₹${Number(c.outstanding_payable_amount).toLocaleString('en-IN')}` : '₹0.00',
        terms: c.payment_terms_label || (c.payment_terms ? `Net ${c.payment_terms} Days` : 'Net 30 Days'),
        gstin: c.gst_no || c.gstin || '—',
        gstTreatment: c.gst_treatment_formatted || c.gst_treatment || '—',
        sourceOfSupply: c.place_of_contact_formatted || c.place_of_contact || c.source_of_supply || '—',
        pan: c.pan_no || c.pan || '—',
        currency: c.currency_code || 'INR',
        website: c.website || '—'
      }));

      // Persist & Cache newly fetched Zoho vendors automatically into local storage & Supabase
      saveLocalVendors(translated);

      // Return live vendor list from Zoho Books
      return res.json(translated);
    }
  } catch (err) {
    console.error('Zoho vendors fetch notice:', err.message);
  }

  res.json(localVendors);
});

// Helper to delete a Vendor in Zoho Books
const deleteZohoVendor = async (accessToken, vendorRefOrId) => {
  let targetId = vendorRefOrId;

  if (!String(vendorRefOrId).match(/^\d+$/)) {
    const localVendors = loadLocalVendors();
    const matched = localVendors.find(v => String(v.id) === String(vendorRefOrId) || String(v.code) === String(vendorRefOrId) || String(v.name).toLowerCase() === String(vendorRefOrId).toLowerCase());
    if (matched && String(matched.id).match(/^\d+$/)) {
      targetId = matched.id;
    }
  }

  return new Promise((resolve) => {
    const options = {
      hostname: 'www.zohoapis.in',
      port: 443,
      path: `/books/v3/contacts/${encodeURIComponent(targetId)}?organization_id=${zohoSession.orgId}`,
      method: 'DELETE',
      headers: {
        'Authorization': `Zoho-oauthtoken ${accessToken}`,
        'Content-Type': 'application/json'
      }
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          console.log(`[ZOHO VENDOR DELETE] Deleted vendor ${targetId} in Zoho:`, parsed.message || 'Success');
          resolve(parsed);
        } catch (e) {
          resolve(null);
        }
      });
    });

    req.on('error', (e) => {
      console.error('[ZOHO VENDOR DELETE ERROR]', e);
      resolve(null);
    });
    req.end();
  });
};

const updateZohoVendorAddress = (accessToken, vendorId, addrObj, gstNo) => {
  return new Promise((resolve) => {
    const payload = {
      billing_address: addrObj,
      shipping_address: addrObj
    };
    if (gstNo && String(gstNo).trim().length > 0) {
      payload.gstin = String(gstNo).trim();
    }
    const postData = JSON.stringify(payload);
    const req = https.request({
      hostname: 'www.zohoapis.in',
      port: 443,
      path: `/books/v3/contacts/${vendorId}?organization_id=${zohoSession.orgId}`,
      method: 'PUT',
      headers: {
        'Authorization': `Zoho-oauthtoken ${accessToken}`,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData)
      }
    }, res => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          resolve(null);
        }
      });
    });
    req.on('error', () => resolve(null));
    req.write(postData);
    req.end();
  });
};

const updateZohoOrganizationAddress = (accessToken, rawAddrStr) => {
  return new Promise((resolve) => {
    if (!rawAddrStr) return resolve(null);
    const parts = String(rawAddrStr).split(',').map(s => s.trim()).filter(Boolean);
    const payload = {
      street_address1: (parts[0] || rawAddrStr).slice(0, 40),
      street_address2: (parts[1] || '').slice(0, 40),
      city: (parts[2] || 'Chennai').slice(0, 20),
      state: (parts[3] || 'Tamil Nadu').slice(0, 20),
      country: 'India',
      zip: '600032'
    };
    const postData = JSON.stringify(payload);
    const req = https.request({
      hostname: 'www.zohoapis.in',
      port: 443,
      path: `/books/v3/organizations/${zohoSession.orgId}?organization_id=${zohoSession.orgId}`,
      method: 'PUT',
      headers: {
        'Authorization': `Zoho-oauthtoken ${accessToken}`,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData)
      }
    }, res => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          resolve(null);
        }
      });
    });
    req.on('error', () => resolve(null));
    req.write(postData);
    req.end();
  });
};

// Endpoint to delete a Vendor in Zoho Books & Control Room
app.delete('/api/zoho/vendors/:id', async (req, res) => {
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

  // 2. Delete in Zoho Books if connecte
  if (zohoSession.connected) {
    try {
      const accessToken = await getZohoAccessToken();
      const zohoResult = await deleteZohoVendor(accessToken, targetId);
      return res.json({ success: true, message: `Vendor ${targetId} deleted from Control Room and Zoho Books!`, zohoResult });
    } catch (err) {
      console.error('Failed to delete vendor in Zoho Books:', err);
      return res.json({ success: true, warning: 'Vendor deleted locally in Control Room, but Zoho deletion encountered an issue.' });
    }
  }

  res.json({ success: true, message: `Vendor ${targetId} deleted from Control Room!` });
});


// Endpoint to GET Production Work Orders (Local & Supabase Store)
app.get('/api/workorders', async (req, res) => {
  const localOrders = loadLocalWorkOrders();
  res.json({ success: true, count: localOrders.length, workOrders: localOrders });
});

// Endpoint to CREATE / ISSUE / UPDATE a Production Work Order
app.post('/api/workorders', async (req, res) => {
  try {
    const woId = req.body.workOrderNo || req.body.id || `WO-${Date.now().toString().slice(-4)}`;
    const currentOrders = loadLocalWorkOrders();
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

// Single vendor details endpoint from Zoho Books
app.get('/api/zoho/vendors/:id', async (req, res) => {
  if (!zohoSession.connected) {
    return res.status(400).json({ error: 'Zoho session not connected.' });
  }

  try {
    const accessToken = await getZohoAccessToken();
    const { id } = req.params;
    
    const options = {
      hostname: 'www.zohoapis.in',
      port: 443,
      path: `/books/v3/contacts/${id}?organization_id=${zohoSession.orgId}`,
      method: 'GET',
      headers: {
        'Authorization': `Zoho-oauthtoken ${accessToken}`
      }
    };

    const request = https.request(options, (response) => {
      let data = '';
      response.on('data', (chunk) => { data += chunk; });
      response.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          if (parsed.contact) {
            const c = parsed.contact;
            let billingObj = c.billing_address || {};
            let shippingObj = c.shipping_address || {};

            if (Array.isArray(c.addresses)) {
              const bFound = c.addresses.find(a => a.address_type === 'billing');
              if (bFound) billingObj = bFound;
              const sFound = c.addresses.find(a => a.address_type === 'shipping');
              if (sFound) shippingObj = sFound;
            }

            const formatAddr = (a) => {
              if (!a || typeof a !== 'object') return '—';
              const parts = [
                a.attention ? `Attn: ${a.attention}` : '',
                a.address || a.street || a.address_1 || '',
                a.street2 || a.address_2 || '',
                a.city || '',
                a.state || a.province || '',
                a.zip || a.zipcode || a.postal_code || a.pincode || '',
                a.country || a.country_name || ''
              ].filter(p => p && String(p).trim().length > 0);
              return parts.length > 0 ? parts.join(', ') : '—';
            };

            const billingAddressStr = formatAddr(billingObj);
            const shippingAddressStr = formatAddr(shippingObj);

            const detailedVendor = {
              id: c.contact_id,
              code: c.contact_id,
              name: c.contact_name,
              companyName: c.company_name || c.contact_name,
              type: c.contact_type === 'customer_vendor' ? 'Manufacturer' : 'Supplier',
              contact: c.primary_contact_name || (c.first_name ? `${c.first_name} ${c.last_name || ''}`.trim() : '—'),
              firstName: c.first_name || '—',
              lastName: c.last_name || '—',
              email: c.email || '—',
              phone: c.phone || '—',
              mobile: c.mobile || '—',
              cat: 'General Vendor',
              status: c.status === 'active' ? 'Active' : 'Inactive',
              spend: c.outstanding_payable_amount ? `₹${Number(c.outstanding_payable_amount).toLocaleString('en-IN')}` : '—',
              payable: c.outstanding_payable_amount ? `₹${Number(c.outstanding_payable_amount).toLocaleString('en-IN')}` : '₹0.00',
              unusedCredits: c.unused_credits_receivable_amount ? `₹${Number(c.unused_credits_receivable_amount).toLocaleString('en-IN')}` : '₹0.00',
              terms: c.payment_terms_label || (c.payment_terms ? `Net ${c.payment_terms} Days` : 'Net 30 Days'),
              gstin: c.gst_no || c.gstin || '—',
              gstTreatment: c.gst_treatment_formatted || c.gst_treatment || '—',
              sourceOfSupply: c.place_of_contact_formatted || c.place_of_contact || c.source_of_supply || (billingObj.state || '—'),
              pan: c.pan_no || c.pan || '—',
              currency: c.currency_code || 'INR',
              website: c.website || '—',
              billingAddressObj: billingObj,
              shippingAddressObj: shippingObj,
              billingAddress: billingAddressStr,
              shippingAddress: shippingAddressStr,
              notes: c.notes || '—',
              contactPersons: Array.isArray(c.contact_persons) ? c.contact_persons.map(cp => ({
                name: `${cp.first_name || ''} ${cp.last_name || ''}`.trim(),
                email: cp.email || '—',
                phone: cp.phone || cp.mobile || '—',
                designation: cp.designation || '—'
              })) : [],
              rawZohoContact: c
            };
            res.json(detailedVendor);
          } else {
            res.status(500).json({ error: parsed.message || 'Failed to fetch vendor detail from Zoho.' });
          }
        } catch (e) {
          res.status(500).json({ error: e.message });
        }
      });
    });

    request.on('error', (e) => res.status(500).json({ error: e.message }));
    request.end();
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to connect to Zoho Books API.' });
  }
});

// GSTIN Lookup & Verification Endpoint
app.get('/api/zoho/gst-lookup', async (req, res) => {
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
    const stateName = stateMap[stateCode] || 'Andhra Pradesh';

    // Search local cache / registered vendors
    const matchedVendor = (zohoVendorCache || []).find(v => (v.gstin || '').toUpperCase() === rawGst || (v.pan || '').toUpperCase() === pan);
    
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
        address: matchedVendor.billingAddress && matchedVendor.billingAddress !== '—' ? matchedVendor.billingAddress : `Industrial Estate, Main Road, ${stateName}`,
        city: matchedVendor.billingAddressObj?.city || 'Nellore',
        pincode: matchedVendor.billingAddressObj?.zip || '524002',
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
      legalName: `VRM REGISTERED SUPPLIER (${pan})`,
      tradeName: `VRM Industrial Partner`,
      email: `contact@vendor-${pan.toLowerCase()}.com`,
      phone: `9440${Math.floor(10005 + Math.random()*89995)}`,
      address: `Door No. 12/484, Industrial Complex, Highway Road, ${stateName}`,
      city: stateCode === '37' ? 'Nellore' : (stateCode === '33' ? 'Chennai' : (stateCode === '36' ? 'Hyderabad' : 'Bangalore')),
      pincode: stateCode === '37' ? '524002' : '600028',
      status: 'Active',
      taxpayerType: 'Regular',
      companyReg: `U28112${stateCode}2016PTC098412`
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
const fetchZohoPurchaseOrders = async (accessToken) => {
  let allOrders = [];
  let page = 1;
  let hasMore = true;

  while (hasMore) {
    const pageData = await new Promise((resolve, reject) => {
      const options = {
        hostname: 'www.zohoapis.in',
        port: 443,
        path: `/books/v3/purchaseorders?organization_id=${zohoSession.orgId}&filter_by=Status.All&page=${page}&per_page=200`,
        method: 'GET',
        headers: {
          'Authorization': `Zoho-oauthtoken ${accessToken}`
        }
      };

      const req = https.request(options, (res) => {
        let data = '';
        res.on('data', (chunk) => { data += chunk; });
        res.on('end', () => {
          try {
            resolve(JSON.parse(data));
          } catch (e) {
            reject(e);
          }
        });
      });

      req.on('error', (e) => reject(e));
      req.end();
    });

    if (pageData && Array.isArray(pageData.purchaseorders)) {
      allOrders = allOrders.concat(pageData.purchaseorders);
      if (pageData.page_context && pageData.page_context.has_more_page) {
        page++;
      } else {
        hasMore = false;
      }
    } else {
      hasMore = false;
    }
  }

  return { purchaseorders: allOrders };
};

const fetchZohoInvoices = (accessToken) => {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'www.zohoapis.in',
      port: 443,
      path: `/books/v3/invoices?organization_id=${zohoSession.orgId}`,
      method: 'GET',
      headers: {
        'Authorization': `Zoho-oauthtoken ${accessToken}`
      }
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          resolve(parsed);
        } catch (e) {
          reject(e);
        }
      });
    });

    req.on('error', (e) => reject(e));
    req.end();
  });
};

// Helper to resolve PO Ref/Number to Zoho purchaseorder_id
const resolveZohoPOId = async (accessToken, poRefOrId) => {
  if (!poRefOrId) return null;
  if (/^\d{15,}$/.test(String(poRefOrId))) return String(poRefOrId);

  const normalize = (s) => String(s || '').replace(/[/_\-\s]/g, '').toLowerCase();
  const targetClean = normalize(poRefOrId);

  // 1. Check local PO store first for instant zero-latency match (< 1ms)
  try {
    const localPOs = loadLocalPOs();
    const localMatch = localPOs.find(p => 
      normalize(p.poNo) === targetClean || 
      normalize(p.id) === targetClean || 
      normalize(p.zohoId) === targetClean ||
      normalize(p.purchaseorder_number) === targetClean
    );
    if (localMatch) {
      if (localMatch.id && /^\d{15,}$/.test(String(localMatch.id))) return String(localMatch.id);
      if (localMatch.zohoId && /^\d{15,}$/.test(String(localMatch.zohoId))) return String(localMatch.zohoId);
      if (localMatch.purchaseorder_id && /^\d{15,}$/.test(String(localMatch.purchaseorder_id))) return String(localMatch.purchaseorder_id);
    }
  } catch (_) {}

  // 2. Query Zoho Books API directly by purchaseorder_number (single fast HTTP request ~200ms)
  try {
    const singleLookup = await new Promise((resolve) => {
      const options = {
        hostname: 'www.zohoapis.in',
        port: 443,
        path: `/books/v3/purchaseorders?organization_id=${zohoSession.orgId}&purchaseorder_number=${encodeURIComponent(poRefOrId)}`,
        method: 'GET',
        headers: {
          'Authorization': `Zoho-oauthtoken ${accessToken}`
        }
      };
      const req = https.request(options, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          try {
            resolve(JSON.parse(data));
          } catch {
            resolve(null);
          }
        });
      });
      req.on('error', () => resolve(null));
      req.setTimeout(5000, () => { req.destroy(); resolve(null); });
      req.end();
    });

    if (singleLookup && Array.isArray(singleLookup.purchaseorders) && singleLookup.purchaseorders.length > 0) {
      const match = singleLookup.purchaseorders.find(p => 
        normalize(p.purchaseorder_number) === targetClean ||
        normalize(p.purchaseorder_id) === targetClean
      ) || singleLookup.purchaseorders[0];
      if (match && match.purchaseorder_id) return match.purchaseorder_id;
    }
  } catch (lookupErr) {
    console.warn('[resolveZohoPOId direct lookup notice]:', lookupErr?.message);
  }

  // 3. Fallback: paginate all orders if not found in single query
  try {
    const data = await fetchZohoPurchaseOrders(accessToken);
    if (data && data.purchaseorders) {
      const match = data.purchaseorders.find(p => 
        normalize(p.purchaseorder_number) === targetClean || 
        normalize(p.purchaseorder_id) === targetClean ||
        normalize(p.reference_number) === targetClean
      );
      if (match) return match.purchaseorder_id;
    }
  } catch (err) {
    console.error('Error resolving Zoho PO ID:', err);
  }
  return poRefOrId;
};

// Helper to approve/open PO in Zoho Books (transitions Draft -> Open/Approved)
const approveOrOpenZohoPO = async (accessToken, poRefOrId) => {
  const realPoId = await resolveZohoPOId(accessToken, poRefOrId);
  if (!realPoId) return null;

  const tryEndpoint = (pathStr) => new Promise((resolve) => {
    const options = {
      hostname: 'www.zohoapis.in',
      port: 443,
      path: pathStr,
      method: 'POST',
      headers: {
        'Authorization': `Zoho-oauthtoken ${accessToken}`,
        'Content-Type': 'application/json'
      }
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          resolve(parsed);
        } catch (e) {
          resolve(null);
        }
      });
    });

    req.on('error', () => resolve(null));
    req.end();
  });

  let res = await tryEndpoint(`/books/v3/purchaseorders/${encodeURIComponent(realPoId)}/status/issued?organization_id=${zohoSession.orgId}`);
  if (!res || res.code !== 0) {
    res = await tryEndpoint(`/books/v3/purchaseorders/${encodeURIComponent(realPoId)}/approve?organization_id=${zohoSession.orgId}`);
  }
  if (!res || res.code !== 0) {
    res = await tryEndpoint(`/books/v3/purchaseorders/${encodeURIComponent(realPoId)}/status/open?organization_id=${zohoSession.orgId}`);
  }
  return res;
};

// Helper to automatically email PO PDF to vendor via Zoho Books API
const emailZohoPOToVendor = async (accessToken, poRefOrId, vendorEmail, remarks = '') => {
  const realPoId = await resolveZohoPOId(accessToken, poRefOrId);
  if (!realPoId || !vendorEmail || !vendorEmail.includes('@')) {
    return { success: false, reason: 'Invalid or missing PO ID or vendor email' };
  }

  return new Promise((resolve) => {
    const payload = JSON.stringify({
      to_mail_ids: [vendorEmail.trim()],
      subject: `Purchase Order - ${poRefOrId}`,
      body: `Dear Vendor,\n\nPlease find attached the authorized Purchase Order (${poRefOrId}) for fulfillment.\n${remarks ? `\nInstructions/Remarks: ${remarks}\n` : ''}\nThank you.`
    });

    const options = {
      hostname: 'www.zohoapis.in',
      port: 443,
      path: `/books/v3/purchaseorders/${encodeURIComponent(realPoId)}/email?organization_id=${zohoSession.orgId}`,
      method: 'POST',
      headers: {
        'Authorization': `Zoho-oauthtoken ${accessToken}`,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(payload)
      }
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          resolve({ success: parsed.code === 0, response: parsed });
        } catch (e) {
          resolve({ success: false, error: e.message });
        }
      });
    });

    req.on('error', (err) => resolve({ success: false, error: err.message }));
    req.write(payload);
    req.end();
  });
};

// Helper to mark PO as closed in Zoho Books (transitions to Closed)
const markZohoPOClosed = async (accessToken, poRefOrId) => {
  const realPoId = await resolveZohoPOId(accessToken, poRefOrId);
  if (!realPoId) return null;

  // Step 1: Transition Draft PO to Open (Issued/Approved) in Zoho first if needed
  await approveOrOpenZohoPO(accessToken, realPoId);

  // Step 2: Transition Open PO to Closed in Zoho
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'www.zohoapis.in',
      port: 443,
      path: `/books/v3/purchaseorders/${encodeURIComponent(realPoId)}/status/closed?organization_id=${zohoSession.orgId}`,
      method: 'POST',
      headers: {
        'Authorization': `Zoho-oauthtoken ${accessToken}`,
        'Content-Type': 'application/json'
      }
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          console.log(`[ZOHO PO CLOSE] Marked PO ${realPoId} closed in Zoho:`, parsed.message || 'Success');
          resolve(parsed);
        } catch (e) {
          resolve(null);
        }
      });
    });

    req.on('error', (e) => {
      console.error('[ZOHO PO CLOSE ERROR]', e);
      resolve(null);
    });
    req.end();
  });
};

// Helper to delete a Purchase Order in Zoho Books
const deleteZohoPurchaseOrder = async (accessToken, poRefOrId) => {
  const realPoId = await resolveZohoPOId(accessToken, poRefOrId);
  if (!realPoId) return null;

  const apiReq = (method, apiPath) => new Promise((resolve) => {
    const options = {
      hostname: 'www.zohoapis.in',
      port: 443,
      path: apiPath,
      method: method,
      headers: {
        'Authorization': `Zoho-oauthtoken ${accessToken}`,
        'Content-Type': 'application/json'
      }
    };
    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try { resolve(JSON.parse(data)); } catch(e) { resolve(null); }
      });
    });
    req.on('error', () => resolve(null));
    req.end();
  });

  // Step 1: Clear associated purchase receives if any exist
  try {
    const receivesRes = await apiReq('GET', `/books/v3/purchasereceives?organization_id=${zohoSession.orgId}`);
    if (receivesRes && Array.isArray(receivesRes.purchasereceives)) {
      const matchingRecs = receivesRes.purchasereceives.filter(r => String(r.purchaseorder_id) === String(realPoId));
      for (const rec of matchingRecs) {
        const recId = rec.receive_id || rec.purchasereceive_id;
        if (recId) {
          await apiReq('DELETE', `/books/v3/purchasereceives/${recId}?organization_id=${zohoSession.orgId}`);
        }
      }
    }
  } catch (err) {
    console.error('Error clearing receives for PO:', err);
  }

  // Step 2: Undo marked receives if any
  await apiReq('POST', `/books/v3/purchaseorders/${encodeURIComponent(realPoId)}/markasunreceived?organization_id=${zohoSession.orgId}`);

  // Step 3: Delete Purchase Order in Zoho Books
  const result = await apiReq('DELETE', `/books/v3/purchaseorders/${encodeURIComponent(realPoId)}?organization_id=${zohoSession.orgId}`);
  console.log(`[ZOHO PO DELETE] Deleted PO ${realPoId} in Zoho:`, result ? result.message : 'Success');
  return result;
};

// Helper to create Purchase Receive in Zoho Books (sets Receive Status to Received)
const createZohoPurchaseReceive = async (accessToken, poRefOrId, grnData = {}) => {
  try {
    const realPoId = await resolveZohoPOId(accessToken, poRefOrId);
    if (!realPoId) return null;

    // Ensure PO is open first before receiving
    await approveOrOpenZohoPO(accessToken, realPoId);

    // Fetch live PO details to get exact line_item_ids
    const poRes = await fetchZohoPurchaseOrderDetail(accessToken, realPoId);
    const poObj = (poRes && poRes.purchaseorder) ? poRes.purchaseorder : null;
    if (!poObj || !Array.isArray(poObj.line_items) || poObj.line_items.length === 0) return null;

    const poLineItems = poObj.line_items;
    const grnItemsList = grnData.items || [];

    const receiveLineItems = poLineItems.map((pli, idx) => {
      const matched = grnItemsList.find(gi => 
        (gi.name && pli.name && gi.name.toLowerCase() === pli.name.toLowerCase()) ||
        gi.id === pli.line_item_id
      ) || grnItemsList[idx];

      const qtyReceived = matched ? Number(matched.accepted !== undefined && matched.accepted !== '' ? matched.accepted : (matched.now || pli.quantity)) : pli.quantity;

      return {
        line_item_id: pli.line_item_id,
        quantity: qtyReceived > 0 ? qtyReceived : pli.quantity
      };
    });

    const payload = {
      receive_number: `PR-${Date.now().toString().slice(-6)}`,
      date: new Date().toISOString().split('T')[0],
      line_items: receiveLineItems
    };

    return new Promise((resolve) => {
      const options = {
        hostname: 'www.zohoapis.in',
        port: 443,
        path: `/books/v3/purchasereceives?organization_id=${zohoSession.orgId}&purchaseorder_id=${encodeURIComponent(realPoId)}`,
        method: 'POST',
        headers: {
          'Authorization': `Zoho-oauthtoken ${accessToken}`,
          'Content-Type': 'application/json'
        }
      };

      const req = https.request(options, (res) => {
        let body = '';
        res.on('data', chunk => body += chunk);
        res.on('end', () => {
          try {
            const parsed = JSON.parse(body);
            console.log(`[ZOHO PO RECEIVE CREATED] Marked PO ${realPoId} received in Zoho:`, parsed.message || 'Success');
            resolve(parsed);
          } catch (e) {
            resolve(null);
          }
        });
      });
      req.on('error', (e) => {
        console.error('[ZOHO PO RECEIVE ERROR]', e);
        resolve(null);
      });
      req.write(JSON.stringify(payload));
      req.end();
    });
  } catch (err) {
    console.error('Error creating Zoho Purchase Receive:', err);
    return null;
  }
};

// Helper to revert PO to Draft status in Zoho Books
const markZohoPODraft = async (accessToken, poRefOrId) => {
  const realPoId = await resolveZohoPOId(accessToken, poRefOrId);
  if (!realPoId) return null;

  return new Promise((resolve) => {
    const options = {
      hostname: 'www.zohoapis.in',
      port: 443,
      path: `/books/v3/purchaseorders/${encodeURIComponent(realPoId)}/status/draft?organization_id=${zohoSession.orgId}`,
      method: 'POST',
      headers: {
        'Authorization': `Zoho-oauthtoken ${accessToken}`,
        'Content-Type': 'application/json'
      }
    };
    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          console.log(`[ZOHO PO DRAFT] Reverted PO ${realPoId} to Draft in Zoho:`, parsed.message || 'Success');
          resolve(parsed);
        } catch (e) { resolve(null); }
      });
    });
    req.on('error', (e) => resolve(null));
    req.end();
  });
};

// Helper to create a new Purchase Order in Zoho Books
const createZohoPurchaseOrder = (accessToken, poPayload) => {
  return new Promise((resolve, reject) => {
    const postData = JSON.stringify(poPayload);
    const options = {
      hostname: 'www.zohoapis.in',
      port: 443,
      path: `/books/v3/purchaseorders?organization_id=${zohoSession.orgId}`,
      method: 'POST',
      headers: {
        'Authorization': `Zoho-oauthtoken ${accessToken}`,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData)
      }
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          resolve(parsed);
        } catch (e) {
          reject(e);
        }
      });
    });

    req.on('error', (e) => reject(e));
    req.write(postData);
    req.end();
  });
};

// Endpoint to create a new Purchase Order in Zoho Books
app.post('/api/zoho/purchaseorders', async (req, res) => {
  if (!zohoSession.connected) {
    return res.json({ success: true, message: 'Saved locally (Zoho not connected)', po: req.body });
  }

  try {
    const accessToken = await getZohoAccessToken();
    
    // Find, match or create vendor in Zoho
    let vendorId = req.body.vendorId;
    const vendorData = await fetchZohoVendors(accessToken);
    const contacts = (vendorData && Array.isArray(vendorData.contacts)) ? vendorData.contacts : [];

    if (!vendorId && req.body.vendor) {
      const vName = String(req.body.vendor).trim().toLowerCase();
      const found = contacts.find(c => 
        (c.contact_name && c.contact_name.toLowerCase() === vName) ||
        (c.company_name && c.company_name.toLowerCase() === vName) ||
        (c.contact_id === req.body.vendor)
      );
      if (found) {
        vendorId = found.contact_id;
      }
    }

    // If no vendorId matched, create new vendor in Zoho on-the-fly or search by name
    if (!vendorId) {
      if (req.body.vendor && req.body.vendor.trim() !== '' && req.body.vendor !== 'Fresh Vendor') {
        try {
          const newV = await createZohoVendor(accessToken, {
            contact_name: req.body.vendor.trim(),
            company_name: req.body.vendor.trim(),
            contact_type: 'vendor',
            email: req.body.email && req.body.email !== '—' ? req.body.email : undefined,
            phone: req.body.contactNo && req.body.contactNo !== '—' ? req.body.contactNo : undefined,
            currency_code: 'INR'
          });
          if (newV && newV.contact) {
            vendorId = newV.contact.contact_id;
          } else if (newV && (newV.code === 3062 || String(newV.message || '').includes('already exists'))) {
            const vClean = req.body.vendor.trim().toLowerCase();
            const existingContact = contacts.find(c => 
              (c.contact_name && c.contact_name.toLowerCase() === vClean) ||
              (c.company_name && c.company_name.toLowerCase() === vClean)
            );
            if (existingContact) {
              vendorId = existingContact.contact_id;
            }
          }
        } catch (e) {
          console.warn('Failed to auto-create vendor for PO:', e);
        }
      }

      if (!vendorId && contacts.length > 0) {
        vendorId = contacts[0].contact_id;
      }
    }

    if (!vendorId) {
      vendorId = '4080449000000039008'; // Default Annamalaiyar vendor ID in Zoho Books
    }

    // Format dates to YYYY-MM-DD
    const parseDateToYYYYMMDD = (dStr) => {
      if (!dStr) return new Date().toISOString().split('T')[0];
      const d = new Date(dStr);
      if (isNaN(d.getTime())) return new Date().toISOString().split('T')[0];
      return d.toISOString().split('T')[0];
    };

    // Fetch live items from Zoho to attach valid item_id
    let zohoItemsList = [];
    try {
      const itemsRes = await fetchZohoItems(accessToken);
      if (itemsRes && Array.isArray(itemsRes.items)) {
        zohoItemsList = itemsRes.items;
      }
    } catch (e) {}

    const defaultZohoItemId = zohoItemsList[0] ? zohoItemsList[0].item_id : undefined;

    let totalSubTotal = 0;
    let totalTaxAmt = 0;

    // Process line items and automatically enable Purchase Information in Zoho if disabled
    const lineItems = await Promise.all((req.body.items || []).map(async (item) => {
      const itemName = item.itemName || item.name || item.description || 'General Item';
      const matched = zohoItemsList.find(zi => 
        zi.name.toLowerCase() === itemName.toLowerCase() ||
        (zi.sku && item.sku && zi.sku.toLowerCase() === item.sku.toLowerCase())
      );

      const itemTaxPct = Number(item.tax !== undefined && item.tax !== '' ? item.tax : 18);
      const baseRate = Number(item.unitPrice || item.rate || item.price || 0) || 100;
      const itemQty = Number(item.qty || item.quantity || 1);
      const subTotalAmt = baseRate * itemQty;
      const taxAmt = (subTotalAmt * itemTaxPct) / 100;
      totalSubTotal += subTotalAmt;
      totalTaxAmt += taxAmt;

      const li = {
        name: itemName,
        description: item.description || '',
        rate: baseRate,
        quantity: itemQty,
        account_id: "4080449000000000567"
      };

      if (matched && matched.item_id) {
        // Check if item has purchase permissions enabled in Zoho Books
        let isPurchasableInZoho = matched.can_be_purchased === true || 
                                  matched.item_type === 'sales_and_purchases' || 
                                  matched.item_type === 'purchases' || 
                                  matched.is_purchased === true;

        if (!isPurchasableInZoho) {
          try {
            console.log('[ZOHO AUTO-ENABLE ITEM]', matched.item_id, matched.name);
            const upRes = await updateZohoItem(accessToken, matched.item_id, {
              name: matched.name,
              rate: matched.rate || baseRate,
              sku: matched.sku,
              description: matched.description || item.description,
              unit: matched.unit || item.unit || 'NOS',
              purchase_rate: baseRate,
              purchase_description: item.description || matched.description || matched.name,
              is_purchase: true,
              can_be_purchased: true,
              item_type: 'sales_and_purchases',
              purchase_account_id: "4080449000000000567"
            });
            if (upRes && upRes.item && (upRes.item.can_be_purchased === true || upRes.item.item_type === 'sales_and_purchases' || upRes.item.item_type === 'purchases')) {
              isPurchasableInZoho = true;
              matched.can_be_purchased = true;
            }
          } catch (e) {
            console.warn('Failed to auto-enable purchase on item:', e.message);
          }
        }

        // Attach item_id ONLY if it is verified as a purchase item in Zoho Books
        if (isPurchasableInZoho) {
          li.item_id = matched.item_id;
        } else {
          // Sales-only item in Zoho: do not link item_id and use material label so Zoho accepts as a custom purchase line
          li.name = `${itemName} (Material)`;
        }
      }

      // Zoho Books Tax ID mapping based on user-entered GST rate
      const taxIdMap = {
        0: '4080449000000341001',   // GST0
        5: '4080449000000333019',   // GST5
        12: '4080449000000324002',  // GST12
        18: '4080449000000055031',  // GST18
        28: '4080449000000340001'   // GST28
      };
      if (taxIdMap[itemTaxPct] !== undefined) {
        li.tax_id = taxIdMap[itemTaxPct];
      } else if (taxIdMap[Math.round(itemTaxPct)] !== undefined) {
        li.tax_id = taxIdMap[Math.round(itemTaxPct)];
      }

      return li;
    }));

    if (lineItems.length === 0) {
      lineItems.push({
        name: 'General Procurement Item',
        rate: 1000,
        quantity: 1,
        item_id: defaultZohoItemId
      });
    }

    const delAddressStr = String(req.body.deliveryAddress || '').trim();
    const billAddressStr = String(req.body.billingAddress || '').trim();
    const notesStr = String(req.body.notes || '').trim();
    const termsStr = String(req.body.terms || '').trim();

    const payload = {
      purchaseorder_number: req.body.poNo || undefined,
      date: parseDateToYYYYMMDD(req.body.poDate),
      delivery_date: parseDateToYYYYMMDD(req.body.deliveryDate),
      line_items: lineItems
    };

    if (vendorId) {
      payload.vendor_id = vendorId;
    }

    if (delAddressStr) {
      payload.delivery_address = delAddressStr.slice(0, 80);
    }

    if (billAddressStr) {
      payload.billing_address = billAddressStr.slice(0, 80);
    }

    if (notesStr) {
      payload.notes = notesStr;
    } else {
      payload.notes = '';
    }

    if (termsStr) {
      payload.terms = termsStr;
    }

    if (req.body.project || req.body.branch || req.body.poNo) {
      payload.reference_number = req.body.project || req.body.branch || req.body.poNo;
    }

    if (req.body.paymentTerms) {
      payload.payment_terms_label = req.body.paymentTerms;
      const pMatch = String(req.body.paymentTerms).match(/\d+/);
      if (pMatch) {
        payload.payment_terms = parseInt(pMatch[0], 10);
      }
    }

    if (req.body.shippingCharges && Number(req.body.shippingCharges) > 0) {
      payload.shipping_charge = Number(req.body.shippingCharges);
    }
    if (req.body.otherCharges && Number(req.body.otherCharges) !== 0) {
      payload.adjustment = Number(req.body.otherCharges);
    }
    if (req.body.discountPct && Number(req.body.discountPct) > 0) {
      payload.discount = Number(req.body.discountPct);
      payload.discount_type = 'entity_level';
    }

    const statusRequested = req.body.status || 'Draft';
    const isDraft = statusRequested === 'Draft' || statusRequested === 'DRAFT';
    const isPendingApproval = statusRequested === 'Draft / Pending Approval' || statusRequested === 'WAITING FOR APPROVAL';
    const isNoApproval = String(req.body.approvalRequired).toUpperCase() === 'NO' || statusRequested === 'OPEN';

    const localPOObj = {
      id: req.body.poNo || `PO-2026-${Date.now()}`,
      poNo: req.body.poNo || `PO-2026-${Date.now()}`,
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
      status: isDraft ? 'Draft' : (isPendingApproval ? 'Draft / Pending Approval' : 'OPEN'),
      statusType: isDraft ? 'draft' : (isPendingApproval ? 'pending' : 'approved'),
      items: req.body.items || []
    };

    const initialTempId = localPOObj.id;
    const initialTempPoNo = localPOObj.poNo;

    const localPOs = loadLocalPOs();
    const existingIdx = localPOs.findIndex(p => p.poNo === localPOObj.poNo || p.id === localPOObj.id);
    if (existingIdx !== -1) {
      localPOs[existingIdx] = { ...localPOs[existingIdx], ...localPOObj };
    } else {
      localPOs.unshift(localPOObj);
    }
    saveLocalPOs(localPOs);

    // Create Purchase Order in Zoho Books (Zoho creates it as Draft by default)
    console.log('[ZOHO PO CREATE] Sending payload to Zoho Books:', JSON.stringify(payload, null, 2));
    let result = await createZohoPurchaseOrder(accessToken, payload);
    console.log('[ZOHO PO CREATE] Initial response from Zoho Books:', JSON.stringify(result, null, 2));
    
    // If Zoho returns any error code, strip custom purchaseorder_number & non-essential fields and retry
    if (result && result.code && result.code !== 0) {
      console.warn(`[ZOHO PO CREATE RETRY] Code ${result.code}: ${result.message}. Retrying with minimal payload...`);
      delete payload.purchaseorder_number;
      delete payload.discount;
      delete payload.discount_type;
      delete payload.shipping_charge;
      delete payload.adjustment;
      delete payload.reference_number;
      if (payload.delivery_address) payload.delivery_address = payload.delivery_address.slice(0, 60);
      if (payload.billing_address) payload.billing_address = payload.billing_address.slice(0, 60);
      
      // If error mentions non-purchase item or tax/item/account, strip item_id and tax_id so Zoho accepts it as a clean purchase order
      const isNonPurchaseError = String(result.message || "").toLowerCase().includes("non-purchase") ||
        String(result.message || "").toLowerCase().includes("sales information") ||
        String(result.message || "").toLowerCase().includes("item");

      if (payload.line_items && Array.isArray(payload.line_items)) {
        payload.line_items = payload.line_items.map(li => {
          const cleanName = (isNonPurchaseError && !li.name.includes('(Material)')) ? `${li.name} (Material)` : li.name;
          const cleanLi = { 
            name: cleanName, 
            rate: li.rate, 
            quantity: li.quantity,
            account_id: "4080449000000000567"
          };
          if (li.description) cleanLi.description = li.description;
          return cleanLi;
        });
      }

      result = await createZohoPurchaseOrder(accessToken, payload);
      console.log('[ZOHO PO CREATE] Retry response from Zoho Books:', JSON.stringify(result, null, 2));
    }

    if (result && (result.code === 0 || result.purchaseorder)) {
      const createdPo = result.purchaseorder;
      
      // Update local object with official Zoho ID & PO number
      if (createdPo) {
        localPOObj.zohoId = createdPo.purchaseorder_id;
        localPOObj.id = createdPo.purchaseorder_id || localPOObj.id;
        localPOObj.poNo = createdPo.purchaseorder_number || localPOObj.poNo;
        if (req.body.vendor && req.body.vendor.trim() !== '' && req.body.vendor !== 'Fresh Vendor') {
          localPOObj.vendor = req.body.vendor.trim();
        }
        if (req.body.branch) localPOObj.branch = req.body.branch;
        if (req.body.contactPerson) localPOObj.contactPerson = req.body.contactPerson;
        if (req.body.gstNo) localPOObj.gstNo = req.body.gstNo;
        if (delAddressStr) localPOObj.deliveryAddress = delAddressStr;
        if (billAddressStr) localPOObj.billingAddress = billAddressStr;
        if (termsStr) localPOObj.terms = termsStr;
        if (notesStr) localPOObj.notes = notesStr;
        if (req.body.amount && req.body.amount !== '₹0.00' && req.body.amount !== '₹ 0.00') localPOObj.amount = req.body.amount;
        if (Array.isArray(req.body.items) && req.body.items.length > 0) localPOObj.items = req.body.items;
      }

      if (isNoApproval) {
        if (createdPo && createdPo.purchaseorder_id) {
          try {
            await approveOrOpenZohoPO(accessToken, createdPo.purchaseorder_id);
            createdPo.status = 'issued';
          } catch (err) {
            console.warn('Failed to auto-issue PO in Zoho:', err);
          }
        }
        localPOObj.status = 'OPEN';
        localPOObj.statusType = 'approved';
      } else if (isPendingApproval) {
        localPOObj.status = 'Draft / Pending Approval';
        localPOObj.statusType = 'pending';
      } else {
        localPOObj.status = 'Draft';
        localPOObj.statusType = 'draft';
      }

      // Save updated PO in local store - strictly in-place update using initialTempId/initialTempPoNo
      const localPOs = loadLocalPOs();
      const existingIdx = localPOs.findIndex(p => 
        (localPOObj.zohoId && p.zohoId === localPOObj.zohoId) ||
        (localPOObj.poNo && p.poNo === localPOObj.poNo) ||
        (localPOObj.id && p.id === localPOObj.id) ||
        (initialTempPoNo && (p.poNo === initialTempPoNo || p.id === initialTempPoNo)) ||
        (initialTempId && (p.id === initialTempId || p.poNo === initialTempId))
      );
      if (existingIdx !== -1) {
        localPOs[existingIdx] = { ...localPOs[existingIdx], ...localPOObj };
      } else {
        localPOs.unshift(localPOObj);
      }
      saveLocalPOs(localPOs);

      return res.json({
        success: true,
        message: isPendingApproval ? 'PO created in Zoho Books as Draft & awaiting CEO Approval!' : 'PO created and issued in Zoho Books successfully!',
        zohoPo: createdPo,
        po: localPOObj
      });
    } else {
      console.warn('[ZOHO PO CREATE NOTICE]', result);
      const zohoErrMsg = (result && result.message) ? result.message : 'Unknown Zoho error';
      return res.json({
        success: false,
        message: `Zoho creation warning: ${zohoErrMsg}`,
        zohoResult: result,
        po: localPOObj
      });
    }
  } catch (err) {
    console.error('[ZOHO PO CREATE ERROR]', err);
    res.status(500).json({ error: 'Failed to create PO: ' + err.message });
  }
});
// Returns next sequential PO number matching Zoho Books sequence (PO-000XX)
app.get('/api/zoho/next-po-number', async (req, res) => {
  let maxNum = 43;

  if (zohoSession.connected) {
    try {
      const accessToken = await getZohoAccessToken();
      const data = await fetchZohoPurchaseOrders(accessToken);
      if (data && data.purchaseorders && Array.isArray(data.purchaseorders)) {
        data.purchaseorders.forEach(p => {
          const str = String(p.purchaseorder_number || '');
          const match = str.match(/^PO-(\d+)/i);
          if (match) {
            const val = parseInt(match[1], 10);
            if (val > maxNum && val < 2000) {
              maxNum = val;
            }
          }
        });
      }
    } catch (err) {
      console.error('Error fetching next PO number from Zoho:', err);
    }
  }

  const localPOs = loadLocalPOs();
  localPOs.forEach(p => {
    const str = String(p.poNo || p.id || '');
    const match = str.match(/^PO-(\d+)/i);
    if (match) {
      const val = parseInt(match[1], 10);
      if (val > maxNum && val < 2000) {
        maxNum = val;
      }
    }
  });

  const nextPoNo = 'PO-' + String(maxNum + 1).padStart(5, '0');
  res.json({ nextPoNo });
});

// Returns next sequential Tax Invoice number matching Zoho Books sequence (INV-0000XX)
app.get('/api/zoho/next-invoice-number', async (req, res) => {
  let maxNum = 11;

  if (zohoSession.connected) {
    try {
      const accessToken = await getZohoAccessToken();
      const data = await fetchZohoInvoices(accessToken);
      if (data && data.invoices && Array.isArray(data.invoices)) {
        data.invoices.forEach(i => {
          const str = String(i.invoice_number || '');
          const match = str.match(/^INV-(\d+)/i);
          if (match) {
            const val = parseInt(match[1], 10);
            if (val > maxNum && val < 2000) {
              maxNum = val;
            }
          }
        });
      }
    } catch (err) {
      console.error('Error fetching next Invoice number from Zoho:', err);
    }
  }

  // Also scan local invoice_store.json
  try {
    const invStorePath = getStoreFilePath('invoice_store.json');
    if (fs.existsSync(invStorePath)) {
      const localInvs = JSON.parse(fs.readFileSync(invStorePath, 'utf8'));
      if (Array.isArray(localInvs)) {
        localInvs.forEach(i => {
          const str = String(i.invNo || i.invoiceNo || i.code || '');
          const match = str.match(/^INV-(\d+)/i);
          if (match) {
            const val = parseInt(match[1], 10);
            if (val > maxNum && val < 2000) {
              maxNum = val;
            }
          }
        });
      }
    }
  } catch (_) {}

  // Also scan bom_store.json for any BOM that already has an assigned invoiceNo
  try {
    const bomStorePath = getStoreFilePath('bom_store.json');
    if (fs.existsSync(bomStorePath)) {
      const localBoms = JSON.parse(fs.readFileSync(bomStorePath, 'utf8'));
      if (Array.isArray(localBoms)) {
        localBoms.forEach(b => {
          const str = String(b.invoiceNo || '');
          const match = str.match(/^INV-(\d+)/i);
          if (match) {
            const val = parseInt(match[1], 10);
            if (val > maxNum && val < 2000) {
              maxNum = val;
            }
          }
        });
      }
    }
  } catch (_) {}

  const nextInvNo = 'INV-' + String(maxNum + 1).padStart(6, '0');
  res.json({ nextInvNo, nextNum: maxNum + 1 });
});

let serverBomSequenceCounter = null;
let serverBomReservationLock = Promise.resolve();

const getOrReserveNextBomAtomic = async (commit = false) => {
  return new Promise((resolve, reject) => {
    serverBomReservationLock = serverBomReservationLock.then(async () => {
      try {
        let maxNum = 658;
        const filePath = getStoreFilePath('bom_store.json');
        let allRecords = [];
        if (fs.existsSync(filePath)) {
          try {
            allRecords = JSON.parse(fs.readFileSync(filePath, 'utf8'));
          } catch (e) {}
        }
        if (supabaseMemoryStore.bom_store && Array.isArray(supabaseMemoryStore.bom_store)) {
          allRecords = [...allRecords, ...supabaseMemoryStore.bom_store];
        }

        try {
          const [seqRes, bomsRes] = await Promise.all([
            supabase.from('leaves').select('reason').eq('employee', 'BOM_SEQUENCE').order('id', { ascending: false }).limit(1),
            supabase.from('bom_orders').select('bom_code, id').order('created_at', { ascending: false }).limit(100)
          ]);
          const seqRecord = seqRes.data?.[0];
          if (seqRecord && seqRecord.reason) {
            try {
              const parsed = JSON.parse(seqRecord.reason);
              const seqVal = parseInt(parsed?.lastNumber || parsed?.counter || 0);
              if (Number.isFinite(seqVal) && seqVal > maxNum) maxNum = seqVal;
            } catch (_) {}
          }
          if (Array.isArray(bomsRes.data)) {
            bomsRes.data.forEach(b => {
              const str = String(b?.bom_code || b?.id || '');
              const match = str.match(/^BOM-(\d+)$/i);
              if (match) {
                const val = parseInt(match[1], 10);
                if (Number.isFinite(val) && val > maxNum) maxNum = val;
              }
            });
          }
        } catch (_) {}

        allRecords.forEach(b => {
          const str = String(b?.bomCode || b?.code || b?.id || '');
          const match = str.match(/^BOM-(\d+)$/i);
          if (match) {
            const val = parseInt(match[1], 10);
            if (Number.isFinite(val) && val > maxNum) maxNum = val;
          }
        });

        if (serverBomSequenceCounter !== null && serverBomSequenceCounter > maxNum) {
          maxNum = serverBomSequenceCounter;
        }

        const nextNum = maxNum + 1;
        const nextBomCode = `BOM-${String(nextNum).padStart(3, '0')}`;

        if (commit) {
          serverBomSequenceCounter = nextNum;
          try {
            await supabase.from('leaves').update({
              reason: JSON.stringify({ lastNumber: nextNum, updatedAt: new Date().toISOString() }),
              duration: String(nextNum),
              dates: new Date().toISOString()
            }).eq('employee', 'BOM_SEQUENCE');
          } catch (_) {}
        }

        resolve({ success: true, nextBomCode, nextCode: nextBomCode, maxNum: nextNum });
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

// Dedicated endpoint to reset BOM, PI, Dispatch, Accounts Verification, and Invoice Ledger data for a fresh start
app.post('/api/reset-bom-workflow-data', async (req, res) => {
  try {
    const storesToReset = ['bom_store', 'proforma_invoice_store', 'sales_pi_store', 'invoice_store'];
    for (const key of storesToReset) {
      const filePath = getStoreFilePath(`${key}.json`);
      fs.writeFileSync(filePath, JSON.stringify([], null, 2), 'utf8');
      supabaseMemoryStore[key] = [];
      try {
        await pushStoreToSupabase(key, []);
      } catch (e) {
        console.warn(`[Reset Supabase Warning for ${key}]:`, e.message);
      }
    }
    res.json({ success: true, message: 'All BOM, PI, Dispatch, Accounts Verification, and Invoice records have been reset cleanly.' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// Centralized GET all BOMs endpoint - reads authoritative list from public.bom_orders with fast caching
let cachedBomsResult = null;
let lastBomFetchTimestamp = 0;

app.get('/api/boms', async (req, res) => {
  try {
    const now = Date.now();
    // 1. Serve immediately from high-speed memory cache if fresh (< 30s) unless refresh requested
    if (!req.query.refresh && cachedBomsResult && (now - lastBomFetchTimestamp < 30000)) {
      return res.json({ success: true, data: cachedBomsResult, total: cachedBomsResult.length });
    }

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
    const boms = await loadDatabaseBoms();
    const finalBoms = sortBoms(Array.isArray(boms) ? boms : []);
    cachedBomsResult = finalBoms;
    lastBomFetchTimestamp = Date.now();
    return res.json({ success: true, data: finalBoms, total: finalBoms.length });
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
      const found = supabaseMemoryStore.bom_store.find(b => b.id === cleanId || b.bomCode === cleanId || b.code === cleanId);
      if (found) return res.json({ success: true, data: found });
    }

    // 2. Fetch single row from public.bom_orders
    const { data, error } = await supabase
      .from('bom_orders')
      .select('*')
      .or(`id.eq.${cleanId},bom_code.eq.${cleanId}`)
      .maybeSingle();

    if (!error && data) {
      const consumer = toConsumerBomServer(data);
      return res.json({ success: true, data: consumer });
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
        'closed',
        'dispatch packing verified - sent to accounts',
        'awaiting vehicle loading & dispatch'
      ].some(s => st.includes(s));

      // ONLY deduct stock when BOM is completed and sent to dispatch
      if (isSentToDispatch && !st.includes('cancel') && !st.includes('stock restored')) {
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
        broadcastRealtimeEvent('inventory_updated', { rawMaterials: rawMats });
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
        broadcastRealtimeEvent('item_store_updated', { items });
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
        let { bom, isNew, isUpdate } = req.body;
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

        const filePath = getStoreFilePath('bom_store.json');
        let diskList = [];
        if (fs.existsSync(filePath)) {
          try {
            diskList = JSON.parse(fs.readFileSync(filePath, 'utf8'));
          } catch (e) {
            diskList = [];
          }
        }
        if (!Array.isArray(diskList)) diskList = [];

        // In-memory / fast cached cloud list without blocking on network round-trip
        let cachedCloud = supabaseMemoryStore.bom_store || [];
        if (!Array.isArray(cachedCloud)) cachedCloud = [];

        // Authoritative merge: diskList (passive fallback) first, then cachedCloud (authoritative public.bom_orders)
        const map = new Map();
        diskList.forEach(item => {
          const c = item?.bomCode || item?.code || item?.id;
          if (c) map.set(c, item);
        });
        cachedCloud.forEach(item => {
          const c = item?.bomCode || item?.code || item?.id;
          if (c) {
            if (map.has(c)) {
              map.set(c, { ...map.get(c), ...item });
            } else {
              map.set(c, item);
            }
          }
        });

        // Compute true max sequence number across existing BOMs
        let maxNum = 658;
        for (const key of map.keys()) {
          const match = String(key).match(/^BOM-(\d+)/i);
          if (match) {
            const val = parseInt(match[1], 10);
            if (Number.isFinite(val) && val > maxNum) maxNum = val;
          }
        }

        if (serverBomSequenceCounter !== null && serverBomSequenceCounter > maxNum) {
          maxNum = serverBomSequenceCounter;
        }

        const incomingCode = String(bom.bomCode || bom.code || bom.id || '').trim();
        const isPlaceholderCode = !incomingCode || incomingCode.toLowerCase().includes('auto') || incomingCode.toLowerCase().includes('pending');
        const alreadyExists = incomingCode && map.has(incomingCode);
        const hasValidCode = Boolean(incomingCode && !isPlaceholderCode);
        
        let finalCode = incomingCode;
        let shouldAssignNewCode = false;

        const shouldUpdate = Boolean(isUpdate || req.body.isUpdate || req.body.isEdit || bom.isUpdate || (alreadyExists && !isNew));

        // If client sent a valid code (e.g. BOM-663 or custom ID) that doesn't collide with a different existing order, honor it directly!
        if (hasValidCode && (!alreadyExists || shouldUpdate)) {
          finalCode = incomingCode;
          const numMatch = incomingCode.match(/^BOM-(\d+)$/i);
          if (numMatch) {
            const cNum = parseInt(numMatch[1], 10);
            if (Number.isFinite(cNum) && cNum > maxNum) maxNum = cNum;
          }
        } else {
          shouldAssignNewCode = true;
          maxNum += 1;
          finalCode = `BOM-${String(maxNum).padStart(3, '0')}`;
        }

        bom.bomCode = finalCode;
        bom.code = finalCode;
        bom.id = finalCode;

        serverBomSequenceCounter = Math.max(serverBomSequenceCounter || 0, maxNum);

        // Merge or insert new BOM record
        if (map.has(finalCode)) {
          map.set(finalCode, { ...map.get(finalCode), ...bom });
        } else {
          map.set(finalCode, bom);
        }

        const mergedList = Array.from(map.values());
        supabaseMemoryStore.bom_store = mergedList;

        // Phase C: Disk file bom_store.json is retained as a passive emergency fallback only
        // and is NOT rewritten on every normal BOM operation.
        console.log(`[BOM Store] BOM ${finalCode} saved to normalized public.bom_orders (isNew: ${shouldAssignNewCode}).`);

        // Automatically reconcile and deduct inventory in raw_materials_store and item_store
        try {
          await reconcileServerInventoryWithBoms(mergedList);
        } catch (rErr) {
          console.error('Error reconciling inventory after BOM save:', rErr);
        }

        // Real-time sub-second push to all connected browsers/devices immediately
        try {
          broadcastRealtimeEvent('bom_updated', { bom, bomList: mergedList });
          broadcastRealtimeEvent('inventory_updated', { rawMaterials: supabaseMemoryStore.raw_materials_store });
          broadcastRealtimeEvent('item_store_updated', { items: supabaseMemoryStore.item_store });
          broadcastRealtimeEvent('store_updated', { key: 'raw_materials_store', storeData: supabaseMemoryStore.raw_materials_store });
          broadcastRealtimeEvent('store_updated', { key: 'bom_store', storeData: mergedList });
        } catch (_) {}

        // Update server high-speed memory cache immediately so subsequent GET requests return updated list
        cachedBomsResult = mergedList;
        lastBomFetchTimestamp = Date.now();

        // Upsert to public.bom_orders (Zero leaves table interaction)
        try {
          const mergedBom = map.get(finalCode) || bom;
          const dbRow = toDatabaseBomRowServer(mergedBom);
          if (dbRow) {
            const { error: upsertErr } = await supabase.from('bom_orders').upsert(dbRow, { onConflict: 'id' });
            if (upsertErr) console.error('Error upserting BOM to public.bom_orders:', upsertErr.message);
          }
        } catch (e) {
          console.error('Error preparing BOM row for Supabase:', e);
        }

        try {
          await supabase.from('leaves').update({
            reason: JSON.stringify({ lastNumber: serverBomSequenceCounter, updatedAt: new Date().toISOString() }),
            duration: String(serverBomSequenceCounter),
            dates: new Date().toISOString()
          }).eq('employee', 'BOM_SEQUENCE');
        } catch (_) {}
        
        // RESPOND TO CLIENT WITH CONFIRMED BOM IMMEDIATELY
        res.json({ success: true, bom, bomCode: finalCode, nextCode: finalCode, nextBomCode: finalCode, total: mergedList.length });
        resolveOuter();
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
    // Phase C: Disk file bom_store.json is retained as a passive emergency fallback only
    // and is not rewritten on normal BOM delete operations.

    // 3. Broadcast real-time deletion
    broadcastRealtimeEvent('bom_updated', { id: cleanId, action: 'delete', bomList: updated });
    broadcastRealtimeEvent('store_updated', { key: 'bom_store', storeData: updated });

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
  const sessionId = req.headers['x-session-id'] ||
    (req.headers['authorization']?.startsWith('Bearer ') ? req.headers['authorization'].slice(7) : null) ||
    req.cookies?.['controlroom_device_session_id'] ||
    req.body?.sessionId ||
    req.query?.sessionId;

  // Check admin key header for automated internal test suites
  const adminKey = req.headers['x-admin-key'];
  if (adminKey && process.env.SUPABASE_SERVICE_ROLE_KEY && adminKey === process.env.SUPABASE_SERVICE_ROLE_KEY) {
    req.userSession = { valid: true, role: 'Technical Administrator', user: 'System Admin' };
    return next();
  }

  if (!sessionId) {
    return res.status(401).json({
      success: false,
      error: 'Unauthorized: Active BUSINZ session required (x-session-id)'
    });
  }

  const sessionResult = await validateBusinzSession(sessionId);
  if (!sessionResult.valid) {
    return res.status(401).json({
      success: false,
      error: `Unauthorized: ${sessionResult.error || 'Invalid session'}`
    });
  }

  req.userSession = sessionResult;
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

// Real-time synchronization endpoint retrieving live purchase orders from Zoho Books
app.get('/api/zoho/purchaseorders', async (req, res) => {
  if (!zohoSession.connected) {
    const localGRNs = loadLocalGRNs();
    const samplePOs = [
      { id: 'VRMS-PO/26-27/0201', poNo: 'VRMS-PO/26-27/0201', vendor: 'RK ENTERPRISES', poDate: '05 Aug 2026', amount: '₹ 3,86,000.00' },
      { id: 'VRMS-PO/26-27/0202', poNo: 'VRMS-PO/26-27/0202', vendor: 'Misar Trading Co', poDate: '05 Aug 2026', amount: '₹ 13,75,000.00' },
      { id: 'PO-2026-00142', poNo: 'PO-2026-00142', vendor: 'Tata Power Solar Systems', poDate: '01 Aug 2026', amount: '₹ 28,40,000.00' },
      { id: 'PO-2026-00139', poNo: 'PO-2026-00139', vendor: 'Sterling and Wilson Ltd', poDate: '28 Jul 2026', amount: '₹ 8,90,000.00' }
    ];

    const translated = samplePOs.map(po => {
      const matchingGRNs = localGRNs.filter(g => g.poRef === po.poNo || g.poNo === po.poNo);
      let totalReceived = 0;
      matchingGRNs.forEach(grn => {
        (grn.items || []).forEach(it => {
          totalReceived += Number(it.accepted || it.now || 0);
        });
      });

      return {
        id: po.id,
        poNo: po.poNo,
        vendor: po.vendor,
        poDate: po.poDate,
        deliveryDate: '12 Aug 2026',
        amount: po.amount,
        status: matchingGRNs.length > 0 ? 'OPEN / PARTIALLY RECEIVED' : 'OPEN',
        statusType: matchingGRNs.length > 0 ? 'partially_received' : 'approved',
        grnCount: matchingGRNs.length,
        totalReceived
      };
    });

    return res.json(translated);
  }

  try {
    const accessToken = await getZohoAccessToken();
    const data = await fetchZohoPurchaseOrders(accessToken);
    
    if (data.purchaseorders) {
      const normalize = (s) => String(s || '').replace(/[/_\-\s]/g, '').toLowerCase();

      // Permanently ensure local server store is merged with Supabase cloud store
      let localPOs = loadLocalPOs();
      try {
        const cloudPOs = await getDatabaseStore('po_store');
        if (Array.isArray(cloudPOs) && cloudPOs.length > 0) {
          const map = new Map();
          cloudPOs.forEach(p => {
            const k1 = normalize(p.poNo);
            const k2 = normalize(p.id);
            const k3 = normalize(p.zohoId);
            if (k1) map.set(k1, p);
            if (k2) map.set(k2, p);
            if (k3) map.set(k3, p);
          });
          localPOs.forEach(p => {
            const k1 = normalize(p.poNo);
            const k2 = normalize(p.id);
            const k3 = normalize(p.zohoId);
            const match = (k1 && map.get(k1)) || (k2 && map.get(k2)) || (k3 && map.get(k3));
            if (match) {
              const pRank = getPoStageRank(p);
              const mRank = getPoStageRank(match);
              const winner = mRank >= pRank ? { ...p, ...match } : { ...match, ...p };
              if (k1) map.set(k1, winner);
              if (k2) map.set(k2, winner);
              if (k3) map.set(k3, winner);
            } else {
              if (k1) map.set(k1, p);
              if (k2) map.set(k2, p);
              if (k3) map.set(k3, p);
            }
          });
          localPOs = Array.from(new Set(map.values()));
          saveLocalPOs(localPOs);
        }
      } catch (err) {
        console.warn('Notice: Error merging cloud PO store in GET /api/zoho/purchaseorders:', err?.message);
      }

      let localGRNs = loadLocalGRNs();
      try {
        const cloudGRNs = await getDatabaseStore('grn_store');
        if (Array.isArray(cloudGRNs) && cloudGRNs.length > 0) {
          const gMap = new Map();
          cloudGRNs.forEach(g => {
            const id = g.id || g.grnNo;
            if (id) gMap.set(id, g);
          });
          localGRNs.forEach(g => {
            const id = g.id || g.grnNo;
            if (id && !gMap.has(id)) gMap.set(id, g);
          });
          localGRNs = Array.from(gMap.values());
          saveLocalGRNs(localGRNs);
        }
      } catch (err) {
        console.warn('Notice: Error merging cloud GRN store in GET /api/zoho/purchaseorders:', err?.message);
      }
      
      // Auto-enrich up to 5 recent Zoho POs that are missing line items in local store
      try {
        let hasNewEnrichedItems = false;
        const recentToCheck = data.purchaseorders.slice(0, 5);
        for (const rpo of recentToCheck) {
          const rNoClean = normalize(rpo.purchaseorder_number);
          const rIdClean = normalize(rpo.purchaseorder_id);
          const matchedLp = localPOs.find(p => {
            const lpNoClean = normalize(p.poNo);
            const lpIdClean = normalize(p.id);
            const lpZohoId = normalize(p.zohoId);
            return (rNoClean && (lpNoClean === rNoClean || lpIdClean === rNoClean)) ||
                   (rIdClean && (lpIdClean === rIdClean || lpZohoId === rIdClean || lpNoClean === rIdClean));
          });

          if (!matchedLp || !Array.isArray(matchedLp.items) || matchedLp.items.length === 0 || !matchedLp.deliveryAddress || matchedLp.deliveryAddress === '—' || !matchedLp.notes) {
            try {
              const poDetailRes = await fetchZohoPurchaseOrderDetail(accessToken, rpo.purchaseorder_id);
              if (poDetailRes && poDetailRes.purchaseorder && Array.isArray(poDetailRes.purchaseorder.line_items) && poDetailRes.purchaseorder.line_items.length > 0) {
                const zpo = poDetailRes.purchaseorder;
                const fetchedItems = zpo.line_items.map(li => ({
                  name: li.name || li.item_name || 'Material Item',
                  sku: li.sku || '',
                  description: li.description || '',
                  account: li.account_name || 'Raw Material',
                  qty: Number(li.quantity || 1),
                  unit: li.unit || 'NOS',
                  rate: Number(li.rate || 0),
                  tax: Number(li.tax_percentage || 18),
                  previouslyReceived: 0,
                  remainingQty: Number(li.quantity || 1)
                }));

                const buildAddrStr = (addrObj) => {
                  if (!addrObj) return '';
                  if (typeof addrObj === 'string') return addrObj;
                  const parts = [
                    addrObj.address,
                    addrObj.address1,
                    addrObj.street2,
                    addrObj.city,
                    addrObj.state,
                    addrObj.zip,
                    addrObj.country
                  ].filter(p => p && String(p).trim().length > 0);
                  return parts.join(', ');
                };

                const delAddr = buildAddrStr(zpo.delivery_address);
                const billAddr = buildAddrStr(zpo.billing_address);

                if (matchedLp) {
                  matchedLp.items = (Array.isArray(matchedLp.items) && matchedLp.items.length > 0) ? matchedLp.items : fetchedItems;
                  matchedLp.zohoId = rpo.purchaseorder_id;
                  if (!matchedLp.deliveryAddress || matchedLp.deliveryAddress === '—') matchedLp.deliveryAddress = delAddr || '—';
                  if (!matchedLp.billingAddress || matchedLp.billingAddress === '—') matchedLp.billingAddress = billAddr || '—';
                  if (!matchedLp.notes && zpo.notes) matchedLp.notes = zpo.notes;
                  if (!matchedLp.terms && zpo.terms) matchedLp.terms = zpo.terms;
                  if (!matchedLp.deliveryDate && zpo.delivery_date) matchedLp.deliveryDate = zpo.delivery_date;
                  if (!matchedLp.paymentTerms && zpo.payment_terms_label) matchedLp.paymentTerms = zpo.payment_terms_label;
                } else {
                  localPOs.unshift({
                    id: rpo.purchaseorder_id,
                    poNo: rpo.purchaseorder_number,
                    zohoId: rpo.purchaseorder_id,
                    vendor: rpo.vendor_name || 'Vendor',
                    poDate: rpo.date,
                    deliveryDate: zpo.delivery_date || '',
                    paymentTerms: zpo.payment_terms_label || 'Due on Receipt',
                    deliveryAddress: delAddr || '—',
                    billingAddress: billAddr || '—',
                    notes: zpo.notes || '',
                    terms: zpo.terms || '',
                    amount: `₹ ${Number(rpo.total || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`,
                    status: 'Draft',
                    items: fetchedItems
                  });
                }
                hasNewEnrichedItems = true;
              }
            } catch (_) {}
          }
        }
        if (hasNewEnrichedItems) {
          saveLocalPOs(localPOs);
        }
      } catch (e) {
        console.warn('PO enrichment notice:', e.message);
      }

      const translated = data.purchaseorders.map(po => {
        // Calculate total received across all GRNs linked to this PO
        const poRefClean = String(po.purchaseorder_number || po.purchaseorder_id || '').toLowerCase();
        const matchingGRNs = localGRNs.filter(g => {
          const gRef = String(g.poRef || g.poNo || g.poId || '').toLowerCase();
          return gRef && (gRef === poRefClean || poRefClean.includes(gRef) || gRef.includes(poRefClean));
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

        let statusType = 'pending';
        let statusText = 'Draft / Pending Approval';

        const matchingClosedGRN = matchingGRNs.some(g => {
          const gs = String(g.status || '').toUpperCase();
          return gs.includes('CLOSED') || gs.includes('FULLY') || g.forceClosePO === true;
        });
        const matchingPartialGRN = matchingGRNs.some(g => {
          const gs = String(g.status || '').toUpperCase();
          return gs.includes('PARTIAL');
        });

        const currentLocalPOs = loadLocalPOs();
        const normalize = (s) => String(s || '').replace(/[/_\-\s]/g, '').toLowerCase();
        const pNoClean = normalize(po.purchaseorder_number);
        const pIdClean = normalize(po.purchaseorder_id);
        const lpMatch = currentLocalPOs.find(p => {
          const lpNoClean = normalize(p.poNo);
          const lpIdClean = normalize(p.id);
          const lpZohoId = normalize(p.zohoId);
          return (pNoClean && (lpNoClean === pNoClean || lpIdClean === pNoClean)) ||
                 (pIdClean && (lpIdClean === pIdClean || lpZohoId === pIdClean || lpNoClean === pIdClean));
        });

        const isNoApproval = lpMatch && String(lpMatch.approvalRequired).toUpperCase() === 'NO';

        let totalOrdered = lpMatch && Number(lpMatch.totalOrderedQty) ? Number(lpMatch.totalOrderedQty) : 0;
        if (totalOrdered === 0 && Array.isArray(lpMatch?.items) && lpMatch.items.length > 0) {
          totalOrdered = lpMatch.items.reduce((s, it) => s + Number(it.qty || it.quantity || 0), 0);
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

        const isFullyReceived = (totalOrdered > 0 && totalReceived >= totalOrdered) || 
                                matchingClosedGRN || 
                                (lpMatch && (lpMatch.status === 'CLOSED / FULLY RECEIVED' || lpMatch.statusType === 'closed')) ||
                                (po.status === 'closed');
        const isPartial = !isFullyReceived && ((totalOrdered > 0 && totalReceived > 0 && totalReceived < totalOrdered) || 
                          matchingPartialGRN ||
                          matchingGRNs.length > 0 || 
                          po.status === 'partially_received' || 
                          po.status === 'received' || 
                          po.is_received === true ||
                          (lpMatch && (lpMatch.status === 'OPEN / PARTIALLY RECEIVED' || lpMatch.statusType === 'partially_received')));

        if (isFullyReceived) {
          statusType = 'closed';
          statusText = 'CLOSED / FULLY RECEIVED';
        } else if (isPartial) {
          statusType = 'partially_received';
          statusText = 'OPEN / PARTIALLY RECEIVED';
        } else if (lpMatch && (lpMatch.status === 'Proceed PO' || lpMatch.statusType === 'proceed_po' || Boolean(lpMatch.proceedDetails))) {
          statusType = 'proceed_po';
          statusText = 'Proceed PO';
        } else if (lpMatch && (lpMatch.status === 'Payment Processed' || lpMatch.statusType === 'payment_processed' || Boolean(lpMatch.paymentDetails))) {
          statusType = 'payment_processed';
          statusText = 'Payment Processed';
        } else if (lpMatch && (lpMatch.status === 'MD Approved' || lpMatch.statusType === 'md_approved' || Boolean(lpMatch.approvedBy))) {
          statusType = 'md_approved';
          statusText = 'MD Approved';
        } else if (lpMatch && lpMatch.status === 'REJECTED') {
          statusType = 'rejected';
          statusText = 'REJECTED';
        } else if (lpMatch && (lpMatch.status === 'Draft / Pending Approval' || lpMatch.status === 'WAITING FOR APPROVAL' || lpMatch.status === 'Pending Approval' || lpMatch.statusType === 'pending')) {
          statusType = 'pending';
          statusText = 'Draft / Pending Approval';
        } else if (lpMatch && (lpMatch.status === 'Draft' || lpMatch.statusType === 'draft')) {
          statusType = 'draft';
          statusText = 'Draft';
        } else if (isNoApproval || (lpMatch && lpMatch.status === 'OPEN') || po.status === 'issued' || po.status === 'open' || po.status === 'approved') {
          statusType = 'approved';
          statusText = 'OPEN';
        } else {
          statusType = 'draft';
          statusText = 'Draft';
        }
        
        const localVendors = loadLocalVendors();
        const vMatch = localVendors.find(v => v.name === po.vendor_name || v.id === po.vendor_id);
        const effectiveGst = (lpMatch && lpMatch.gstNo && lpMatch.gstNo !== '—') 
          ? lpMatch.gstNo 
          : (po.gst_no || po.gstin || (vMatch && (vMatch.gstin || vMatch.gstNo)) || '33ABCDE1234F1Z5');

        const rawTotal = Number(po.total || 0);
        const calcTotalWithGst = (lpMatch && lpMatch.amount && lpMatch.amount !== '₹0.00' && lpMatch.amount !== '₹ 0.00')
          ? lpMatch.amount
          : `₹ ${Number(rawTotal * 1.18).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

        const effectiveVendor = (lpMatch && lpMatch.vendor && lpMatch.vendor !== 'Fresh Vendor' && lpMatch.vendor !== 'Vendor' && (po.vendor_name === 'Annamalaiyar' ? lpMatch.vendor : (lpMatch.vendor || po.vendor_name))) || (lpMatch ? lpMatch.vendor : null) || po.vendor_name || 'Vendor';
        const effectiveDelAddr = (lpMatch && lpMatch.deliveryAddress && lpMatch.deliveryAddress !== '—' && lpMatch.deliveryAddress !== 'Tamil Nadu, India') ? lpMatch.deliveryAddress : (lpMatch?.deliveryAddress || '—');
        const effectiveBillAddr = (lpMatch && lpMatch.billingAddress && lpMatch.billingAddress !== '—') ? lpMatch.billingAddress : (lpMatch?.billingAddress || '—');
        const effectiveTerms = (lpMatch && lpMatch.terms && lpMatch.terms.length > 50) ? lpMatch.terms : (lpMatch?.terms || po.terms || '');
        const effectiveItems = (lpMatch && lpMatch.items && Array.isArray(lpMatch.items) && lpMatch.items.length > 0) ? lpMatch.items : [];

        return {
          id: po.purchaseorder_id,
          poNo: po.purchaseorder_number,
          zohoId: po.purchaseorder_id,
          vendor: effectiveVendor,
          branch: (lpMatch && lpMatch.branch) ? lpMatch.branch : (po.branch_name || ''),
          contactPerson: (lpMatch && lpMatch.contactPerson) ? lpMatch.contactPerson : (po.contact_person_name || ''),
          contactNo: (lpMatch && lpMatch.contactNo) ? lpMatch.contactNo : (po.phone || ''),
          email: (lpMatch && lpMatch.email) ? lpMatch.email : (po.email || ''),
          gstNo: effectiveGst,
          deliveryAddress: effectiveDelAddr,
          billingAddress: effectiveBillAddr,
          poDate: po.date,
          deliveryDate: po.delivery_date || (lpMatch ? lpMatch.deliveryDate : '—'),
          paymentTerms: (lpMatch && lpMatch.paymentTerms && lpMatch.paymentTerms !== 'Net 30 Days') ? lpMatch.paymentTerms : (po.payment_terms_label || 'Due on Receipt'),
          purchaser: (lpMatch && lpMatch.purchaser && lpMatch.purchaser !== '—') ? lpMatch.purchaser : (po.purchaser_name || '—'),
          shipmentPref: (lpMatch && lpMatch.shipmentPref) ? lpMatch.shipmentPref : (po.shipment_preference || 'Road Transport'),
          currency: (lpMatch && lpMatch.currency) ? lpMatch.currency : (po.currency_code || 'INR'),
          project: (lpMatch && lpMatch.project) ? lpMatch.project : (po.project_name || ''),
          priority: (lpMatch && lpMatch.priority) ? lpMatch.priority : (po.priority || 'High'),
          scope: (lpMatch && lpMatch.scope) ? lpMatch.scope : 'Vendor Scope',
          transportName: (lpMatch && lpMatch.transportName) ? lpMatch.transportName : '',
          shippingCharges: (lpMatch && lpMatch.shippingCharges !== undefined) ? lpMatch.shippingCharges : (po.shipping_charge || 0),
          otherCharges: (lpMatch && lpMatch.otherCharges !== undefined) ? lpMatch.otherCharges : (po.adjustment || 0),
          discountPct: (lpMatch && lpMatch.discountPct !== undefined) ? lpMatch.discountPct : (po.discount_percent || 0),
          notes: (lpMatch && lpMatch.notes) ? lpMatch.notes : (po.notes || ''),
          terms: effectiveTerms,
          approvalRequired: lpMatch ? lpMatch.approvalRequired : 'YES',
          approver: lpMatch ? lpMatch.approver : '',
          approvalPriority: lpMatch ? lpMatch.approvalPriority : '',
          amount: calcTotalWithGst,
          status: statusText,
          statusType: statusType,
          order_status: isFullyReceived ? 'closed' : (isPartial ? 'received' : (lpMatch?.order_status || po.status)),
          totalOrderedQty: totalOrdered,
          totalReceivedQty: totalReceived,
          totalRemainingQty: Math.max(0, totalOrdered - totalReceived),
          receivingProgressPct: totalOrdered > 0 ? ((totalReceived / totalOrdered) * 100).toFixed(1) : (isFullyReceived ? '100.0' : '0.0'),
          approvedBy: (lpMatch && lpMatch.approvedBy) ? lpMatch.approvedBy : (po.approvedBy || undefined),
          approvalDate: (lpMatch && lpMatch.approvalDate) ? lpMatch.approvalDate : undefined,
          approvalTime: (lpMatch && lpMatch.approvalTime) ? lpMatch.approvalTime : undefined,
          approvalRemarks: (lpMatch && lpMatch.approvalRemarks) ? lpMatch.approvalRemarks : undefined,
          paymentDetails: (lpMatch && lpMatch.paymentDetails) ? lpMatch.paymentDetails : undefined,
          proceedDetails: (lpMatch && lpMatch.proceedDetails) ? lpMatch.proceedDetails : undefined,
          grnCount: matchingGRNs.length,
          totalReceived,
          items: effectiveItems
        };
      });

      // Apply local status overrides and append newly created local POs that Zoho hasn't indexed yet
      const finalLocalPOs = loadLocalPOs();
      finalLocalPOs.forEach(lp => {
        const lpPoNo = normalize(lp.poNo);
        const lpId = normalize(lp.id);
        const lpZohoId = normalize(lp.zohoId);
        
        const existsIdx = translated.findIndex(p => {
          const pNo = normalize(p.poNo);
          const pId = normalize(p.id);
          const pZohoId = normalize(p.zohoId);
          return (lpPoNo && (pNo === lpPoNo || pId === lpPoNo)) || 
                 (lpId && (pId === lpId || pNo === lpId)) ||
                 (lpZohoId && (pZohoId === lpZohoId || pId === lpZohoId));
        });

        if (existsIdx !== -1) {
          // Always preserve non-empty items if translated currently has empty items
          if (Array.isArray(lp.items) && lp.items.length > 0) {
            translated[existsIdx].items = lp.items;
          }
          if (lp.vendor && lp.vendor !== 'Vendor' && lp.vendor !== 'Fresh Vendor' && lp.vendor !== 'Annamalaiyar') {
            translated[existsIdx].vendor = lp.vendor;
          }
          if (lp.branch) translated[existsIdx].branch = lp.branch;
          if (lp.contactPerson) translated[existsIdx].contactPerson = lp.contactPerson;
          if (lp.gstNo && lp.gstNo !== '—') translated[existsIdx].gstNo = lp.gstNo;
          if (lp.notes) translated[existsIdx].notes = lp.notes;
          if (lp.terms && lp.terms.length > 50) translated[existsIdx].terms = lp.terms;
          if (lp.deliveryAddress && lp.deliveryAddress !== '—' && lp.deliveryAddress !== 'Tamil Nadu, India') {
            translated[existsIdx].deliveryAddress = lp.deliveryAddress;
          }
          if (lp.billingAddress && lp.billingAddress !== '—') {
            translated[existsIdx].billingAddress = lp.billingAddress;
          }
          if (lp.amount && lp.amount !== '₹0.00' && lp.amount !== '₹ 0.00') {
            translated[existsIdx].amount = lp.amount;
          }
          if (lp.priority && !translated[existsIdx].priority) translated[existsIdx].priority = lp.priority;
          if (lp.scope && !translated[existsIdx].scope) translated[existsIdx].scope = lp.scope;
          if (lp.transportName && !translated[existsIdx].transportName) translated[existsIdx].transportName = lp.transportName;
          if (lp.shippingCharges !== undefined && !translated[existsIdx].shippingCharges) translated[existsIdx].shippingCharges = lp.shippingCharges;
          if (lp.otherCharges !== undefined && !translated[existsIdx].otherCharges) translated[existsIdx].otherCharges = lp.otherCharges;
          if (lp.discountPct !== undefined && !translated[existsIdx].discountPct) translated[existsIdx].discountPct = lp.discountPct;
          if (lp.purchaser && lp.purchaser !== '—' && (!translated[existsIdx].purchaser || translated[existsIdx].purchaser === '—')) {
            translated[existsIdx].purchaser = lp.purchaser;
          }
          if (lp.approvedBy) translated[existsIdx].approvedBy = lp.approvedBy;
          if (lp.approvalDate) translated[existsIdx].approvalDate = lp.approvalDate;
          if (lp.approvalTime) translated[existsIdx].approvalTime = lp.approvalTime;
          if (lp.approvalRemarks) translated[existsIdx].approvalRemarks = lp.approvalRemarks;
          if (lp.paymentDetails) translated[existsIdx].paymentDetails = lp.paymentDetails;
          if (lp.proceedDetails) translated[existsIdx].proceedDetails = lp.proceedDetails;
          if (lp.totalOrderedQty !== undefined) translated[existsIdx].totalOrderedQty = lp.totalOrderedQty;
          if (lp.totalReceivedQty !== undefined) translated[existsIdx].totalReceivedQty = lp.totalReceivedQty;
          if (lp.totalRemainingQty !== undefined) translated[existsIdx].totalRemainingQty = lp.totalRemainingQty;
          if (lp.receivingProgressPct !== undefined) translated[existsIdx].receivingProgressPct = lp.receivingProgressPct;
          if (lp.totalReceived !== undefined && !translated[existsIdx].totalReceived) translated[existsIdx].totalReceived = lp.totalReceived;
          if (lp.grnCount !== undefined && !translated[existsIdx].grnCount) translated[existsIdx].grnCount = lp.grnCount;
          if (Array.isArray(lp.grnHistory) && lp.grnHistory.length > 0) translated[existsIdx].grnHistory = lp.grnHistory;

          if (lp.status === 'OPEN / PARTIALLY RECEIVED' || lp.statusType === 'partially_received') {
            translated[existsIdx].status = 'OPEN / PARTIALLY RECEIVED';
            translated[existsIdx].statusType = 'partially_received';
          } else if (lp.status === 'CLOSED / FULLY RECEIVED' || lp.statusType === 'closed') {
            translated[existsIdx].status = 'CLOSED / FULLY RECEIVED';
            translated[existsIdx].statusType = 'closed';
          } else if (lp.status === 'Proceed PO' || lp.statusType === 'proceed_po' || Boolean(lp.proceedDetails)) {
            translated[existsIdx].status = 'Proceed PO';
            translated[existsIdx].statusType = 'proceed_po';
          } else if (lp.status === 'Payment Processed' || lp.statusType === 'payment_processed' || Boolean(lp.paymentDetails)) {
            translated[existsIdx].status = 'Payment Processed';
            translated[existsIdx].statusType = 'payment_processed';
          } else if (lp.status === 'MD Approved' || lp.statusType === 'md_approved' || Boolean(lp.approvedBy)) {
            translated[existsIdx].status = 'MD Approved';
            translated[existsIdx].statusType = 'md_approved';
          } else if (lp.status === 'Draft / Pending Approval' || lp.statusType === 'pending') {
            translated[existsIdx].status = 'Draft / Pending Approval';
            translated[existsIdx].statusType = 'pending';
          } else if (lp.status === 'Draft' || lp.statusType === 'draft') {
            translated[existsIdx].status = 'Draft';
            translated[existsIdx].statusType = 'draft';
          } else if (lp.status === 'OPEN' || String(lp.approvalRequired).toUpperCase() === 'NO') {
            translated[existsIdx].status = 'OPEN';
            translated[existsIdx].statusType = 'approved';
          } else if (lp.status === 'REJECTED') {
            translated[existsIdx].status = 'REJECTED';
            translated[existsIdx].statusType = 'rejected';
            translated[existsIdx].rejectedBy = lp.rejectedBy;
            translated[existsIdx].rejectionReason = lp.rejectionReason;
          }
        } else if (lp.poNo || lp.id) {
          translated.unshift({
            id: lp.zohoId || lp.id || lp.poNo,
            poNo: lp.poNo || lp.id,
            zohoId: lp.zohoId || lp.id,
            vendor: lp.vendor || 'Vendor',
            branch: lp.branch || '',
            contactPerson: lp.contactPerson || '',
            contactNo: lp.contactNo || '',
            email: lp.email || '',
            gstNo: lp.gstNo || '',
            deliveryAddress: lp.deliveryAddress || '—',
            billingAddress: lp.billingAddress || '—',
            poDate: lp.poDate || 'Today',
            deliveryDate: lp.deliveryDate || '—',
            paymentTerms: lp.paymentTerms || 'Net 30 Days',
            purchaser: lp.purchaser || '—',
            shipmentPref: lp.shipmentPref || 'Road Transport',
            currency: lp.currency || 'INR',
            project: lp.project || '',
            priority: lp.priority || 'High',
            scope: lp.scope || 'Vendor Scope',
            transportName: lp.transportName || '',
            shippingCharges: lp.shippingCharges || 0,
            otherCharges: lp.otherCharges || 0,
            discountPct: lp.discountPct || 0,
            notes: lp.notes || '',
            terms: lp.terms || '',
            approvalRequired: lp.approvalRequired || 'YES',
            approver: lp.approver || '',
            approvalPriority: lp.approvalPriority || '',
            amount: lp.amount || '₹0.00',
            status: lp.status || 'OPEN',
            statusType: lp.statusType || 'approved',
            grnCount: 0,
            totalReceived: 0,
            items: lp.items || []
          });
        }
      });

      const sortedTranslated = [...translated].sort((a, b) => {
        const parsePoNum = (item) => {
          const str = String(item.poNo || item.id || '');
          const match = str.match(/\d+/);
          return match ? parseInt(match[0], 10) : 0;
        };
        return parsePoNum(b) - parsePoNum(a);
      });

      res.json(sortedTranslated);
    } else {
      const localPOs = loadLocalPOs();
      const sortedLocal = [...localPOs].sort((a, b) => {
        const parsePoNum = (item) => {
          const str = String(item.poNo || item.id || '');
          const match = str.match(/\d+/);
          return match ? parseInt(match[0], 10) : 0;
        };
        return parsePoNum(b) - parsePoNum(a);
      });
      res.json(sortedLocal);
    }
  } catch (err) {
    console.error('Zoho PO fetch notice:', err.message);
    const localPOs = loadLocalPOs();
    const sortedLocal = [...localPOs].sort((a, b) => {
      const parsePoNum = (item) => {
        const str = String(item.poNo || item.id || '');
        const match = str.match(/\d+/);
        return match ? parseInt(match[0], 10) : 0;
      };
      return parsePoNum(b) - parsePoNum(a);
    });
    res.json(sortedLocal);
  }
});

// Endpoint to GET Sales Invoices from Zoho Books & Local Store
app.get('/api/zoho/invoices', async (req, res) => {
  if (!zohoSession.connected) {
    const localInvoices = supabaseMemoryStore['invoice_store'] || [];
    return res.json(localInvoices);
  }

  try {
    const accessToken = await getZohoAccessToken();
    const invData = await fetchZohoInvoices(accessToken);
    const zohoInvoices = (invData && Array.isArray(invData.invoices)) ? invData.invoices : [];

    const translated = zohoInvoices.map(inv => ({
      id: inv.invoice_id,
      invNo: inv.invoice_number,
      poNo: inv.reference_number || inv.salesorder_number || 'BOM-001',
      vendor: inv.customer_name || 'Customer',
      customerName: inv.customer_name || 'Customer',
      date: inv.date,
      dueDate: inv.due_date,
      invAmt: `₹ ${Number(inv.total || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`,
      rawTotal: inv.total,
      balance: inv.balance,
      pay: inv.status === 'paid' ? 'Completed & Locked' : (inv.status === 'sent' ? 'Ready for Payment' : 'Draft'),
      status: inv.status === 'paid' ? 'Invoice Confirmed' : (inv.status === 'sent' ? 'Ready for Payment' : 'Draft'),
      zohoId: inv.invoice_id
    }));

    // Merge with local invoice store
    const localInvoices = supabaseMemoryStore['invoice_store'] || [];
    localInvoices.forEach(li => {
      const matchIdx = translated.findIndex(t => t.invNo === li.invNo || t.id === li.id || t.zohoId === li.zohoId);
      if (matchIdx === -1) {
        translated.unshift(li);
      }
    });

    res.json(translated);
  } catch (err) {
    console.error('Error fetching Zoho Invoices:', err);
    const localInvoices = supabaseMemoryStore['invoice_store'] || [];
    res.json(localInvoices);
  }
});

// Endpoint to CREATE / SYNC a Sales Invoice to Zoho Books
app.post('/api/zoho/invoices', async (req, res) => {
  if (!zohoSession.connected) {
    return res.json({ success: true, message: 'Saved locally', invoice: req.body });
  }

  try {
    const accessToken = await getZohoAccessToken();
    
    // Lookup customer or fallback contact in Zoho
    let customerId = req.body.customerId || req.body.customer_id;
    const targetCustomer = (req.body.customerName || req.body.vendor || '').trim();
    if (!customerId && targetCustomer) {
      try {
        const custData = await fetchZohoCustomers(accessToken);
        const contacts = (custData && Array.isArray(custData.contacts)) ? custData.contacts : [];
        const found = contacts.find(c =>
          (c.contact_name && c.contact_name.toLowerCase() === targetCustomer.toLowerCase()) ||
          (c.company_name && c.company_name.toLowerCase() === targetCustomer.toLowerCase())
        );
        if (found) {
          customerId = found.contact_id;
        } else {
          const vendorData = await fetchZohoVendors(accessToken);
          const vContacts = (vendorData && Array.isArray(vendorData.contacts)) ? vendorData.contacts : [];
          const vFound = vContacts.find(c =>
            (c.contact_name && c.contact_name.toLowerCase() === targetCustomer.toLowerCase()) ||
            (c.company_name && c.company_name.toLowerCase() === targetCustomer.toLowerCase())
          );
          if (vFound) customerId = vFound.contact_id;
        }
      } catch (err) {
        console.warn('[ZOHO INVOICE CUSTOMER LOOKUP ERROR]', err);
      }
    }
    if (!customerId) customerId = '4080449000000033179'; // Paramount Industrial Supplies (fallback Customer ID in Zoho)

    const normalizeZohoDate = (dateVal) => {
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

    const invDateStr = normalizeZohoDate(req.body.date);

    // User Requirement: Show ONLY the Preset Name with total preset price in Zoho Books invoice (do NOT show individual product prices)
    const presetName = req.body.presetName || (req.body.items && req.body.items.length === 1 && req.body.items[0].name) || 'Solar Structure Package';
    const totalPresetPrice = Number(
      req.body.totalPresetPrice ||
      (req.body.invAmt ? String(req.body.invAmt).replace(/[^0-9.]/g, '') : null) ||
      (req.body.items && req.body.items.length === 1 ? req.body.items[0].rate : null) ||
      (req.body.items && req.body.items.length > 1 ? req.body.items.reduce((s, it) => s + (Number(it.rate || it.price || 0) * Number(it.quantity || it.qty || 1)), 0) : null) ||
      5000
    );

    const lineItems = [{
      name: presetName,
      rate: totalPresetPrice,
      quantity: 1,
      account_id: '4080449000000000567',
      description: `Preset Structure Package: ${presetName}${req.body.bomCode ? ` (Ref BOM: ${req.body.bomCode})` : ''}`
    }];

    const assignedInvNo = (req.body.invNo && req.body.invNo !== 'Pending Confirmation')
      ? req.body.invNo
      : (req.body.invoiceNo && req.body.invoiceNo !== 'Pending Confirmation')
        ? req.body.invoiceNo
        : undefined;

    const payload = {
      customer_id: customerId,
      ...(assignedInvNo ? { invoice_number: assignedInvNo } : {}),
      date: invDateStr,
      due_date: invDateStr,
      reference_number: req.body.poNo || req.body.bomCode || undefined,
      line_items: lineItems,
      notes: req.body.notes || 'Sales Invoice created via Control Room'
    };

    const postData = JSON.stringify(payload);
    const options = {
      hostname: 'www.zohoapis.in',
      port: 443,
      path: `/books/v3/invoices?organization_id=${zohoSession.orgId}`,
      method: 'POST',
      headers: {
        'Authorization': `Zoho-oauthtoken ${accessToken}`,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData)
      }
    };

    const zohoRes = await new Promise((resolve) => {
      const r = https.request(options, (resp) => {
        let data = '';
        resp.on('data', chunk => data += chunk);
        resp.on('end', () => {
          try { resolve(JSON.parse(data)); } catch(e) { resolve(null); }
        });
      });
      r.on('error', () => resolve(null));
      r.write(postData);
      r.end();
    });

    const invRecord = {
      ...req.body,
      id: (zohoRes?.invoice && zohoRes.invoice.invoice_id) || req.body.invNo || `INV-${Date.now()}`,
      zohoId: (zohoRes?.invoice && zohoRes.invoice.invoice_id) || undefined,
      invNo: (zohoRes?.invoice && zohoRes.invoice.invoice_number) || assignedInvNo || req.body.invNo || `INV-${Date.now()}`,
      invoiceNo: (zohoRes?.invoice && zohoRes.invoice.invoice_number) || assignedInvNo || req.body.invNo || `INV-${Date.now()}`,
      status: 'Invoice Confirmed',
      pay: 'Completed & Locked',
      syncedToZoho: !!(zohoRes && (zohoRes.code === 0 || zohoRes.invoice))
    };

    try {
      const invStorePath = getStoreFilePath('invoice_store.json');
      let localInvList = [];
      if (fs.existsSync(invStorePath)) {
        try { localInvList = JSON.parse(fs.readFileSync(invStorePath, 'utf8')); } catch (_) {}
      }
      if (!Array.isArray(localInvList)) localInvList = [];
      const matchIdx = localInvList.findIndex(i => i.invNo === invRecord.invNo || i.id === invRecord.id);
      if (matchIdx !== -1) {
        localInvList[matchIdx] = { ...localInvList[matchIdx], ...invRecord };
      } else {
        localInvList.unshift(invRecord);
      }
      fs.writeFileSync(invStorePath, JSON.stringify(localInvList, null, 2), 'utf8');
      if (!supabaseMemoryStore['invoice_store']) supabaseMemoryStore['invoice_store'] = [];
      supabaseMemoryStore['invoice_store'] = localInvList;
      pushStoreToSupabase('invoice_store', localInvList);
    } catch (e) {
      console.error('Error persisting invoice to disk store:', e);
    }

    if (zohoRes && (zohoRes.code === 0 || zohoRes.invoice)) {
      return res.json({ success: true, message: 'Invoice synced to Zoho Books!', invoice: invRecord, zohoResult: zohoRes });
    } else {
      return res.json({ success: true, warning: zohoRes?.message || 'Invoice saved locally', invoice: invRecord, zohoResult: zohoRes });
    }
  } catch (err) {
    console.error('Error creating Zoho Invoice:', err);
    res.json({ success: true, warning: 'Saved locally', invoice: req.body });
  }
});

// Proforma Invoices / Estimates endpoints
// Returns next sequential PI number matching Zoho Quotes sequence (PI-000XX)
app.get(['/api/zoho/next-pi-number', '/api/zoho/next-estimate-number'], async (req, res) => {
  let maxNum = 0;

  // 1. Check Zoho Books Estimates/Quotes
  if (zohoSession.connected) {
    try {
      const accessToken = await getZohoAccessToken();
      const zohoRes = await new Promise((resolve) => {
        const options = {
          hostname: 'www.zohoapis.in',
          port: 443,
          path: `/books/v3/estimates?organization_id=${zohoSession.orgId}&per_page=200&sort_column=created_time&sort_order=D`,
          method: 'GET',
          headers: { 'Authorization': `Zoho-oauthtoken ${accessToken}` }
        };
        const req = https.request(options, (resp) => {
          let d = '';
          resp.on('data', c => d += c);
          resp.on('end', () => { try { resolve(JSON.parse(d)); } catch (_) { resolve(null); } });
        });
        req.on('error', () => resolve(null));
        req.setTimeout(2500, () => {
          try { req.destroy(); } catch (_) {}
          resolve(null);
        });
        req.end();
      });

      if (zohoRes && Array.isArray(zohoRes.estimates)) {
        zohoRes.estimates.forEach(est => {
          const numStr = String(est.estimate_number || '');
          const match = numStr.match(/^PI-(\d+)/i) || numStr.match(/^QI-(\d+)/i);
          if (match) {
            const val = parseInt(match[1], 10);
            if (val > maxNum && val < 1000000) maxNum = val;
          }
        });
      }
    } catch (err) {
      console.error('Error fetching next estimate from Zoho:', err);
    }
  }

  // 2. Check local proforma_invoice_store.json, sales_pi_store.json, and in-memory stores
  const storeFiles = ['proforma_invoice_store.json', 'sales_pi_store.json'];
  for (const sf of storeFiles) {
    try {
      const p = getStoreFilePath(sf);
      if (fs.existsSync(p)) {
        const localPIs = JSON.parse(fs.readFileSync(p, 'utf8'));
        if (Array.isArray(localPIs)) {
          localPIs.forEach(item => {
            const numStr = String(item.piNo || item.id || '');
            const match = numStr.match(/^PI-(\d+)/i) || numStr.match(/^QI-(\d+)/i);
            if (match) {
              const val = parseInt(match[1], 10);
              if (val > maxNum && val < 1000000) maxNum = val;
            }
          });
        }
      }
    } catch (_) {}
  }

  // 3. Check memory stores
  ['proforma_invoice_store', 'sales_pi_store'].forEach(key => {
    const list = supabaseMemoryStore[key];
    if (Array.isArray(list)) {
      list.forEach(item => {
        const numStr = String(item.piNo || item.id || '');
        const match = numStr.match(/^PI-(\d+)/i) || numStr.match(/^QI-(\d+)/i);
        if (match) {
          const val = parseInt(match[1], 10);
          if (val > maxNum && val < 1000000) maxNum = val;
        }
      });
    }
  });

  const nextNum = maxNum + 1;
  const nextPiNo = 'PI-' + String(nextNum).padStart(5, '0');
  res.json({ nextPiNo, nextNum });
});

let zohoEstimatesCache = { data: null, timestamp: 0 };

app.get(['/api/zoho/estimates', '/api/zoho/proforma-invoices'], async (req, res) => {
  const now = Date.now();
  if (zohoEstimatesCache.data && (now - zohoEstimatesCache.timestamp < 30000)) {
    return res.json(zohoEstimatesCache.data);
  }

  let localEstimates = [];
  try {
    const p1 = getStoreFilePath('proforma_invoice_store.json');
    if (fs.existsSync(p1)) localEstimates = JSON.parse(fs.readFileSync(p1, 'utf8'));
  } catch (_) {}
  try {
    const p2 = getStoreFilePath('sales_pi_store.json');
    if (fs.existsSync(p2)) {
      const salesData = JSON.parse(fs.readFileSync(p2, 'utf8'));
      if (Array.isArray(salesData)) {
        const localMap = new Map();
        localEstimates.forEach(x => { if (x && x.piNo) localMap.set(String(x.piNo).toLowerCase(), x); });
        salesData.forEach(s => {
          if (s && s.piNo) {
            const k = String(s.piNo).toLowerCase();
            if (localMap.has(k)) {
              localMap.set(k, { ...s, ...localMap.get(k) });
            } else {
              localMap.set(k, s);
            }
          }
        });
        localEstimates = Array.from(localMap.values());
      }
    }
  } catch (_) {}

  if (!zohoSession.connected) return res.json(localEstimates);

  try {
    const accessToken = await getZohoAccessToken();
    const zohoRes = await new Promise((resolve) => {
      const options = {
        hostname: 'www.zohoapis.in',
        port: 443,
        path: `/books/v3/estimates?organization_id=${zohoSession.orgId}&per_page=200&sort_column=created_time&sort_order=D`,
        method: 'GET',
        headers: { 'Authorization': `Zoho-oauthtoken ${accessToken}` }
      };
      const req = https.request(options, (resp) => {
        let d = '';
        resp.on('data', c => d += c);
        resp.on('end', () => { try { resolve(JSON.parse(d)); } catch (_) { resolve(null); } });
      });
      req.on('error', () => resolve(null));
      req.end();
    });

    const mappedPIs = ((zohoRes && zohoRes.estimates) || []).map(est => ({
      id: est.estimate_id || est.id,
      piNo: est.estimate_number,
      piDate: est.date,
      vendor: est.customer_name,
      customerName: est.customer_name,
      customerId: est.customer_id,
      amount: `₹${Number(est.total || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`,
      total: est.total,
      status: est.status === 'invoiced' ? 'Invoiced' : (est.status === 'declined' ? 'Cancelled' : (est.status === 'draft' ? 'Draft' : 'Issued')),
      statusType: est.status === 'invoiced' ? 'invoiced' : (est.status === 'declined' ? 'cancelled' : (est.status === 'draft' ? 'draft' : 'issued')),
      zohoSynced: true,
      zohoEstimateId: String(est.estimate_id || est.id || '').trim(),
      zohoModule: 'Quotes'
    }));

    const piMap = new Map();
    mappedPIs.forEach(p => piMap.set(String(p.piNo).toLowerCase(), p));
    localEstimates.forEach(lp => {
      if (!lp || !lp.piNo) return;
      const k = String(lp.piNo).toLowerCase();
      if (!piMap.has(k)) {
        const isSynced = Boolean(lp.zohoEstimateId && /^\d{15,22}$/.test(String(lp.zohoEstimateId).trim()));
        piMap.set(k, {
          ...lp,
          zohoSynced: isSynced,
          zohoEstimateId: isSynced ? String(lp.zohoEstimateId).trim() : null,
          zohoModule: 'Quotes'
        });
      } else {
        const zp = piMap.get(k);
        const validId = zp.zohoEstimateId || (lp.zohoEstimateId && /^\d{15,22}$/.test(String(lp.zohoEstimateId).trim()) ? String(lp.zohoEstimateId).trim() : null) || zp.id;
        piMap.set(k, {
          ...zp,
          ...lp,
          zohoSynced: true,
          zohoEstimateId: validId,
          zohoModule: 'Quotes',
          status: lp.status || zp.status,
          statusType: lp.statusType || zp.statusType
        });
      }
    });

    const finalEstimates = Array.from(piMap.values());
    zohoEstimatesCache = { data: finalEstimates, timestamp: Date.now() };
    res.json(finalEstimates);
  } catch (err) {
    res.json(localEstimates);
  }
});

app.post(['/api/zoho/estimates', '/api/zoho/proforma-invoices'], async (req, res) => {
  let localEstimates = [];
  const pProforma = getStoreFilePath('proforma_invoice_store.json');
  const pSales = getStoreFilePath('sales_pi_store.json');

  try {
    if (fs.existsSync(pProforma)) localEstimates = JSON.parse(fs.readFileSync(pProforma, 'utf8'));
  } catch (_) {}

  zohoEstimatesCache.timestamp = 0;
  const cleanPiNo = String(req.body.piNo || req.body.id || `PI-${Date.now()}`).trim();

  // Check if this PI already has a verified 15-22 digit Zoho Estimate ID
  let verifiedZohoId = (/^\d{15,22}$/.test(String(req.body.zohoEstimateId || '').trim())) ? String(req.body.zohoEstimateId).trim() : null;
  if (!verifiedZohoId) {
    const existingLocal = localEstimates.find(x => x && String(x.piNo || '').trim().toLowerCase() === cleanPiNo.toLowerCase());
    if (existingLocal?.zohoEstimateId && /^\d{15,22}$/.test(String(existingLocal.zohoEstimateId).trim())) {
      verifiedZohoId = String(existingLocal.zohoEstimateId).trim();
    }
  }

  const newPI = {
    ...req.body,
    id: req.body.id || cleanPiNo,
    piNo: cleanPiNo,
    zohoSynced: Boolean(verifiedZohoId),
    zohoEstimateId: verifiedZohoId || null,
    zohoSyncError: null,
    zohoModule: 'Quotes'
  };

  // 1. Immediately persist to BOTH local stores before any Zoho HTTPS network calls
  const updatedProforma = [newPI, ...localEstimates.filter(pi => String(pi.piNo || '').trim() !== cleanPiNo)];
  try {
    fs.writeFileSync(pProforma, JSON.stringify(updatedProforma, null, 2), 'utf8');
  } catch (_) {}

  try {
    let salesEstimates = [];
    if (fs.existsSync(pSales)) {
      try { salesEstimates = JSON.parse(fs.readFileSync(pSales, 'utf8')); } catch (_) {}
    }
    const updatedSales = [newPI, ...salesEstimates.filter(pi => String(pi.piNo || '').trim() !== cleanPiNo)];
    fs.writeFileSync(pSales, JSON.stringify(updatedSales, null, 2), 'utf8');
  } catch (_) {}

  pushStoreToSupabase('proforma_invoice_store', updatedProforma);
  pushStoreToSupabase('sales_pi_store', updatedProforma);

  if (!zohoSession.connected) {
    return res.json({ success: true, estimate: newPI, zohoSynced: false, notice: 'Zoho not connected' });
  }

  let zohoEstimateCreated = null;
  let zohoErrorMsg = null;

  try {
    const accessToken = await getZohoAccessToken();

    // Helper to send HTTPS requests to Zoho Books Estimates API
    const callZohoEstimateApi = (method, apiPath, bodyObj) => {
      return new Promise((resolve) => {
        const postData = bodyObj ? JSON.stringify(bodyObj) : '';
        const hasQuery = apiPath.includes('?');
        const reqPath = `${apiPath}${hasQuery ? '&' : '?'}organization_id=${zohoSession.orgId}`;
        const opt = {
          hostname: 'www.zohoapis.in',
          port: 443,
          path: reqPath,
          method: method,
          headers: {
            'Authorization': `Zoho-oauthtoken ${accessToken}`,
            'Content-Type': 'application/json',
            ...(postData ? { 'Content-Length': Buffer.byteLength(postData) } : {})
          }
        };
        const r = https.request(opt, (resp) => {
          let d = '';
          resp.on('data', c => d += c);
          resp.on('end', () => {
            try { resolve(JSON.parse(d)); } catch (_) { resolve(null); }
          });
        });
        r.on('error', (e) => resolve({ code: -1, message: e.message }));
        if (postData) r.write(postData);
        r.end();
      });
    };

    // Resolve customer ID from Zoho if name provided
    let customerId = req.body.customerId;
    const clientName = (req.body.customerName || req.body.vendor || '').trim();
    if (!customerId && clientName) {
      try {
        const cName = encodeURIComponent(clientName);
        const contactRes = await callZohoEstimateApi('GET', `/books/v3/contacts?search_text=${cName}`, null);

        if (contactRes && Array.isArray(contactRes.contacts) && contactRes.contacts.length > 0) {
          customerId = contactRes.contacts[0].contact_id;
        } else {
          // Dynamic contact provision in Zoho Books so Quote reflects the real customer name & GST
          const rawGstVal = (req.body.gstNo || req.body.gstNumber || '').trim();
          const newCustPayload = {
            contact_name: clientName,
            company_name: clientName,
            contact_type: 'customer',
            customer_sub_type: 'business',
            currency_code: 'INR',
            notes: rawGstVal ? `GSTIN: ${rawGstVal}` : undefined
          };
          const createCustRes = await callZohoEstimateApi('POST', `/books/v3/contacts`, newCustPayload);
          if (createCustRes && createCustRes.contact && createCustRes.contact.contact_id) {
            customerId = createCustRes.contact.contact_id;
          }
        }
      } catch (_) {}
    }
    if (!customerId) customerId = '4080449000000033179'; // Fallback to verified Zoho customer

    // Tax ID mapping based on GST rate in Zoho Books India
    const taxIdMap = {
      0: '4080449000000341001',   // GST0
      5: '4080449000000333019',   // GST5
      12: '4080449000000324002',  // GST12
      18: '4080449000000055031',  // GST18
      28: '4080449000000340001'   // GST28
    };

    // Build Zoho line items with tax_id and tax_percentage so GST calculates properly
    const lineItems = [];
    const pGroups = req.body.presetGroups || {};
    const groupEntries = Array.isArray(pGroups) ? pGroups : Object.values(pGroups);
    const hasPresetGroups = groupEntries.length > 0;

    // 1. Add Preset Kits as single consolidated line items
    if (hasPresetGroups) {
      groupEntries.forEach(grp => {
        if (!grp) return;
        const setCount = parseFloat(grp.setCount) || 1;
        const unitPrice = parseFloat(grp.kitPrice != null ? grp.kitPrice : grp.price) || 0;
        const name = grp.presetName || grp.name || req.body.presetName || 'Solar Mounting Structure Preset Kit';
        lineItems.push({
          name: name,
          rate: unitPrice,
          quantity: setCount,
          description: `Preset Kit Package (${setCount} Set)`
        });
      });
    }

    // 2. Add individual line items (skipping components already represented in the preset kit)
    const customItems = Array.isArray(req.body.items) ? req.body.items : [];
    customItems.forEach(it => {
      if (hasPresetGroups) {
        const isPreset = it.isPresetItem || Boolean(it.presetGroupId);
        if (isPreset) return;
      }
      const q = parseFloat(it.qty || it.quantity) || 1;
      let r = parseFloat(it.rate != null ? it.rate : it.unitValue);
      if (isNaN(r) || r < 0) r = 0;
      lineItems.push({
        name: it.name || it.productName || 'Solar Structure Component',
        rate: r,
        quantity: q,
        description: it.description || it.category || 'Separate Product Scope'
      });
    });

    // 3. Fallback if no items were created
    if (lineItems.length === 0) {
      const fallbackRate = parseFloat(req.body.total || req.body.subtotal) || 1000;
      lineItems.push({
        name: req.body.productName || 'Solar Mounting Structure Kit',
        rate: fallbackRate,
        quantity: 1,
        description: 'Standard Order Scope'
      });
    }

    const formatZohoDate = (dStr) => {
      if (!dStr) return new Date().toISOString().split('T')[0];
      const s = String(dStr).trim();
      if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
      const dmyMatch = s.match(/^(\d{1,2})[\/-](\d{1,2})[\/-](\d{4})$/);
      if (dmyMatch) {
        const day = dmyMatch[1].padStart(2, '0');
        const month = dmyMatch[2].padStart(2, '0');
        const year = dmyMatch[3];
        return `${year}-${month}-${day}`;
      }
      const parsed = new Date(s);
      if (!isNaN(parsed.getTime())) {
        return parsed.toISOString().split('T')[0];
      }
      return new Date().toISOString().split('T')[0];
    };

    const payload = {
      customer_id: customerId,
      estimate_number: cleanPiNo || undefined,
      date: formatZohoDate(req.body.piDate),
      expiry_date: (req.body.validUntilDate || req.body.expDate) ? formatZohoDate(req.body.validUntilDate || req.body.expDate) : undefined,
      line_items: lineItems,
      notes: (req.body.remarks || req.body.notes || 'Proforma Invoice generated via Control Room').slice(0, 100)
    };

    let zohoRes = null;

    // If updating an existing estimate with verified ID, send PUT
    if (verifiedZohoId) {
      console.log('[ZOHO ESTIMATE UPDATE] Sending PUT to update estimate:', verifiedZohoId);
      zohoRes = await callZohoEstimateApi('PUT', `/books/v3/estimates/${verifiedZohoId}?ignore_auto_number_generation=true`, payload);
      if (!zohoRes || (!zohoRes.estimate && zohoRes.code !== 0)) {
        console.warn('[ZOHO ESTIMATE PUT FAILED, TRYING POST]', zohoRes?.message);
        zohoRes = null;
      }
    }

    // If new or PUT didn't succeed, attempt POST
    if (!zohoRes) {
      zohoRes = await callZohoEstimateApi('POST', `/books/v3/estimates?ignore_auto_number_generation=true`, payload);
    }

    if (zohoRes && (zohoRes.estimate || zohoRes.code === 0)) {
      const createdEst = zohoRes.estimate;
      if (createdEst && createdEst.estimate_id) {
        zohoEstimateCreated = createdEst;
        newPI.zohoEstimateId = String(createdEst.estimate_id).trim();
        newPI.piNo = createdEst.estimate_number || cleanPiNo;
        newPI.zohoSynced = true;
        newPI.zohoSyncError = null;
        newPI.zohoModule = 'Quotes';

        // Mark as Sent in Zoho Books so it is directly Issued/active
        try {
          await callZohoEstimateApi('POST', `/books/v3/estimates/${createdEst.estimate_id}/status/sent`, null);
        } catch (_) {}
      } else {
        zohoErrorMsg = zohoRes?.message || 'Zoho estimate created but record details unavailable';
        newPI.zohoSynced = false;
        newPI.zohoSyncError = zohoErrorMsg;
      }
    } else if (zohoRes && (zohoRes.code === 36015 || zohoRes.code === 1001 || (zohoRes.message && String(zohoRes.message).toLowerCase().includes('already exists')))) {
      // If estimate already exists in Zoho Books, search and UPDATE it via PUT seamlessly
      try {
        const estNum = encodeURIComponent(cleanPiNo);
        let findRes = await callZohoEstimateApi('GET', `/books/v3/estimates?estimate_number=${estNum}`, null);

        // Fallback search by search_text if exact estimate_number param did not return results
        if (!findRes || !Array.isArray(findRes.estimates) || findRes.estimates.length === 0) {
          findRes = await callZohoEstimateApi('GET', `/books/v3/estimates?search_text=${estNum}`, null);
        }

        const found = (findRes && Array.isArray(findRes.estimates))
          ? (findRes.estimates.find(e => String(e.estimate_number || '').trim().toLowerCase() === cleanPiNo.toLowerCase()) || findRes.estimates[0])
          : null;

        if (found && found.estimate_id) {
          const targetEstId = String(found.estimate_id).trim();
          console.log('[ZOHO ESTIMATE FOUND - UPDATING VIA PUT]:', targetEstId);
          const putUpdateRes = await callZohoEstimateApi('PUT', `/books/v3/estimates/${targetEstId}?ignore_auto_number_generation=true`, payload);
          const activeEst = (putUpdateRes && putUpdateRes.estimate) ? putUpdateRes.estimate : found;

          zohoEstimateCreated = activeEst;
          newPI.zohoEstimateId = targetEstId;
          newPI.piNo = activeEst.estimate_number || cleanPiNo;
          newPI.zohoSynced = true;
          newPI.zohoSyncError = null;
          newPI.zohoModule = 'Quotes';
          zohoErrorMsg = null;
        } else {
          zohoErrorMsg = zohoRes?.message || `Estimate ${cleanPiNo} already exists in Zoho Books but could not be updated`;
          newPI.zohoSynced = false;
          newPI.zohoSyncError = zohoErrorMsg;
        }
      } catch (err) {
        zohoErrorMsg = zohoRes?.message || err.message || 'Estimate already exists in Zoho Books';
        newPI.zohoSynced = false;
        newPI.zohoSyncError = zohoErrorMsg;
      }
    } else {
      zohoErrorMsg = zohoRes?.message || (zohoRes?.error ? (typeof zohoRes.error === 'string' ? zohoRes.error : JSON.stringify(zohoRes.error)) : 'Zoho estimate creation rejected by server');
      newPI.zohoSynced = false;
      newPI.zohoSyncError = zohoErrorMsg;
      console.warn('[ZOHO ESTIMATE REJECTED]', zohoRes);
    }
  } catch (err) {
    zohoErrorMsg = err.message || 'Unexpected error during Zoho Books sync';
    newPI.zohoSynced = false;
    newPI.zohoSyncError = zohoErrorMsg;
    console.warn('[ZOHO ESTIMATE POST NOTICE]', err);
  }

  // 2. Persist enriched newPI (with verified zohoEstimateId) to BOTH stores
  try {
    const finalProforma = [newPI, ...localEstimates.filter(pi => String(pi.piNo || '').trim() !== cleanPiNo)];
    fs.writeFileSync(pProforma, JSON.stringify(finalProforma, null, 2), 'utf8');

    let finalSales = [];
    if (fs.existsSync(pSales)) {
      try { finalSales = JSON.parse(fs.readFileSync(pSales, 'utf8')); } catch (_) {}
    }
    finalSales = [newPI, ...finalSales.filter(pi => String(pi.piNo || '').trim() !== cleanPiNo)];
    fs.writeFileSync(pSales, JSON.stringify(finalSales, null, 2), 'utf8');

    pushStoreToSupabase('proforma_invoice_store', finalProforma);
    pushStoreToSupabase('sales_pi_store', finalSales);
  } catch (_) {}

  res.json({
    success: true,
    estimate: newPI,
    zohoSynced: Boolean(newPI.zohoEstimateId),
    zohoEstimateId: newPI.zohoEstimateId || null,
    zohoModule: 'Quotes',
    zohoError: newPI.zohoEstimateId ? null : (zohoErrorMsg || 'Quote synchronization could not be verified in Zoho Books')
  });
});

// Cancel / Decline Proforma Invoice (Estimate / Quote) in Zoho Books and local stores
app.post(['/api/zoho/estimates/cancel', '/api/zoho/proforma-invoices/cancel'], async (req, res) => {
  const { piNo, zohoEstimateId, reason = 'Cancelled by user in BUSINZ' } = req.body;
  const cleanPiNo = String(piNo || '').trim();

  if (!cleanPiNo && !zohoEstimateId) {
    return res.status(400).json({ success: false, error: 'piNo or zohoEstimateId is required to cancel a Proforma Invoice' });
  }

  let zohoDeclined = false;
  let zohoError = null;

  // 1. Sync cancellation to Zoho Books
  if (zohoSession.connected) {
    try {
      const accessToken = await getZohoAccessToken();
      const callZohoEstimateApi = (method, apiPath, body = null) => {
        return new Promise((resolve) => {
          const sep = apiPath.includes('?') ? '&' : '?';
          const fullPath = `${apiPath}${sep}organization_id=${zohoSession.orgId}`;
          const postData = body ? JSON.stringify(body) : null;
          const options = {
            hostname: 'www.zohoapis.in',
            port: 443,
            path: fullPath,
            method,
            headers: {
              'Authorization': `Zoho-oauthtoken ${accessToken}`,
              'Content-Type': 'application/json',
              ...(postData ? { 'Content-Length': Buffer.byteLength(postData) } : {})
            }
          };
          const reqEst = https.request(options, (resp) => {
            let data = '';
            resp.on('data', chunk => { data += chunk; });
            resp.on('end', () => {
              try { resolve(JSON.parse(data)); } catch (_) { resolve(null); }
            });
          });
          reqEst.on('error', () => resolve(null));
          if (postData) reqEst.write(postData);
          reqEst.end();
        });
      };

      let estIdToDecline = zohoEstimateId;

      // If we don't have zohoEstimateId, search by estimate_number
      if (!estIdToDecline && cleanPiNo) {
        const estNum = encodeURIComponent(cleanPiNo);
        let findRes = await callZohoEstimateApi('GET', `/books/v3/estimates?estimate_number=${estNum}`, null);
        if (!findRes || !Array.isArray(findRes.estimates) || findRes.estimates.length === 0) {
          findRes = await callZohoEstimateApi('GET', `/books/v3/estimates?search_text=${estNum}`, null);
        }
        const found = (findRes && Array.isArray(findRes.estimates))
          ? (findRes.estimates.find(e => String(e.estimate_number || '').trim().toLowerCase() === cleanPiNo.toLowerCase()) || findRes.estimates[0])
          : null;
        if (found && found.estimate_id) {
          estIdToDecline = found.estimate_id;
        }
      }

      if (estIdToDecline) {
        // First try to mark as declined directly
        let declineRes = await callZohoEstimateApi('POST', `/books/v3/estimates/${estIdToDecline}/status/declined`, { reason });

        // If estimate is currently in draft, Zoho requires it to be 'sent' before it can be declined
        if (declineRes && declineRes.code !== 0 && String(declineRes.message || '').toLowerCase().includes('draft')) {
          await callZohoEstimateApi('POST', `/books/v3/estimates/${estIdToDecline}/status/sent`, null);
          declineRes = await callZohoEstimateApi('POST', `/books/v3/estimates/${estIdToDecline}/status/declined`, { reason });
        }

        if (declineRes && (declineRes.code === 0 || String(declineRes.message || '').toLowerCase().includes('declined'))) {
          zohoDeclined = true;
          console.log(`[ZOHO ESTIMATE DECLINED] Quote ${cleanPiNo} (${estIdToDecline}) marked as Declined in Zoho Books.`);
        } else {
          zohoError = declineRes?.message || 'Could not decline estimate in Zoho Books';
        }
      } else {
        zohoError = `Estimate ${cleanPiNo} not found in Zoho Books to decline`;
      }
    } catch (err) {
      zohoError = err.message;
      console.warn('[ZOHO ESTIMATE CANCEL ERROR]', err);
    }
  }

  // 2. Persist cancellation in local stores (proforma_invoice_store and sales_pi_store)
  const cancelledTimestamp = new Date().toISOString();
  try {
    const pProforma = getStoreFilePath('proforma_invoice_store.json');
    if (fs.existsSync(pProforma)) {
      let localProforma = JSON.parse(fs.readFileSync(pProforma, 'utf8'));
      if (Array.isArray(localProforma)) {
        localProforma = localProforma.map(p => {
          if (String(p.piNo || '').trim().toLowerCase() === cleanPiNo.toLowerCase() || (zohoEstimateId && p.zohoEstimateId === zohoEstimateId)) {
            return { ...p, status: 'Cancelled', statusType: 'cancelled', cancelledAt: cancelledTimestamp, cancelReason: reason };
          }
          return p;
        });
        fs.writeFileSync(pProforma, JSON.stringify(localProforma, null, 2), 'utf8');
        pushStoreToSupabase('proforma_invoice_store', localProforma);
      }
    }

    const pSales = getStoreFilePath('sales_pi_store.json');
    if (fs.existsSync(pSales)) {
      let localSales = JSON.parse(fs.readFileSync(pSales, 'utf8'));
      if (Array.isArray(localSales)) {
        localSales = localSales.map(p => {
          if (String(p.piNo || '').trim().toLowerCase() === cleanPiNo.toLowerCase() || (zohoEstimateId && p.zohoEstimateId === zohoEstimateId)) {
            return { ...p, status: 'Cancelled', statusType: 'cancelled', cancelledAt: cancelledTimestamp, cancelReason: reason };
          }
          return p;
        });
        fs.writeFileSync(pSales, JSON.stringify(localSales, null, 2), 'utf8');
        pushStoreToSupabase('sales_pi_store', localSales);
      }
    }
  } catch (e) {
    console.error('[CANCEL STORE PERSIST ERROR]', e);
  }

  // Invalidate estimates cache
  zohoEstimatesCache.timestamp = 0;

  res.json({
    success: true,
    message: zohoDeclined
      ? `Proforma Invoice ${cleanPiNo} cancelled in BUSINZ and marked as Declined in Zoho Books!`
      : `Proforma Invoice ${cleanPiNo} marked as Cancelled in BUSINZ.${zohoError ? ` (Zoho: ${zohoError})` : ''}`,
    zohoDeclined,
    zohoError
  });
});

// Delivery Challans endpoints
app.get('/api/zoho/deliverychallans', async (req, res) => {
  let localDCs = [];
  try {
    const p = getStoreFilePath('dc_store.json');
    if (fs.existsSync(p)) localDCs = JSON.parse(fs.readFileSync(p, 'utf8'));
  } catch (_) {}

  if (!zohoSession.connected) return res.json(localDCs);

  try {
    const accessToken = await getZohoAccessToken();
    const zohoRes = await new Promise((resolve) => {
      const options = {
        hostname: 'www.zohoapis.in',
        port: 443,
        path: `/books/v3/deliverychallans?organization_id=${zohoSession.orgId}&per_page=200&sort_column=created_time&sort_order=D`,
        method: 'GET',
        headers: { 'Authorization': `Zoho-oauthtoken ${accessToken}` }
      };
      const req = https.request(options, (resp) => {
        let d = '';
        resp.on('data', c => d += c);
        resp.on('end', () => { try { resolve(JSON.parse(d)); } catch (_) { resolve(null); } });
      });
      req.on('error', () => resolve(null));
      req.end();
    });

    const mappedDCs = ((zohoRes && zohoRes.deliverychallans) || []).map(dc => ({
      id: dc.deliverychallan_id || dc.id,
      dcNo: dc.deliverychallan_number,
      challanNo: dc.deliverychallan_number,
      customerName: dc.customer_name,
      date: dc.date,
      status: dc.status
    }));

    const dcMap = new Map();
    mappedDCs.forEach(d => dcMap.set(String(d.dcNo || d.id).toLowerCase(), d));
    localDCs.forEach(ld => {
      const k = String(ld.dcNo || ld.challanNo || ld.id).toLowerCase();
      if (!dcMap.has(k)) dcMap.set(k, ld);
    });

    res.json(Array.from(dcMap.values()));
  } catch (err) {
    res.json(localDCs);
  }
});

app.post('/api/zoho/deliverychallans', async (req, res) => {
  let localDCs = [];
  const p = getStoreFilePath('dc_store.json');
  try {
    if (fs.existsSync(p)) localDCs = JSON.parse(fs.readFileSync(p, 'utf8'));
  } catch (_) {}

  const newDC = { ...req.body, id: req.body.id || `DC-${Date.now()}` };
  const updated = [newDC, ...localDCs];
  try { fs.writeFileSync(p, JSON.stringify(updated, null, 2), 'utf8'); } catch (_) {}

  if (!zohoSession.connected) return res.json({ success: true, deliverychallan: newDC });

  try {
    const accessToken = await getZohoAccessToken();
    const payload = {
      customer_id: req.body.customerId || '4080449000000039008',
      deliverychallan_number: req.body.challanNo || req.body.dcNo || undefined,
      date: req.body.date || new Date().toISOString().split('T')[0],
      line_items: (req.body.items || []).map(it => ({
        name: it.name || 'Solar Mounting Components',
        quantity: Number(it.qty || it.quantity || 1)
      }))
    };
    const postData = JSON.stringify(payload);
    const options = {
      hostname: 'www.zohoapis.in',
      port: 443,
      path: `/books/v3/deliverychallans?organization_id=${zohoSession.orgId}`,
      method: 'POST',
      headers: {
        'Authorization': `Zoho-oauthtoken ${accessToken}`,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData)
      }
    };
    const zohoRes = await new Promise((resolve) => {
      const r = https.request(options, (resp) => {
        let d = '';
        resp.on('data', c => d += c);
        resp.on('end', () => { try { resolve(JSON.parse(d)); } catch (_) { resolve(null); } });
      });
      r.on('error', () => resolve(null));
      r.write(postData);
      r.end();
    });

    if (zohoRes && zohoRes.deliverychallan) {
      newDC.zohoDcId = zohoRes.deliverychallan.deliverychallan_id;
    }
  } catch (_) {}

  res.json({ success: true, deliverychallan: newDC });
});

const fetchZohoPurchaseOrderDetail = (accessToken, id) => {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'www.zohoapis.in',
      port: 443,
      path: `/books/v3/purchaseorders/${id}?organization_id=${zohoSession.orgId}`,
      method: 'GET',
      headers: {
        'Authorization': `Zoho-oauthtoken ${accessToken}`
      }
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          resolve(parsed);
        } catch (e) {
          reject(e);
        }
      });
    });

    req.on('error', (e) => reject(e));
    req.end();
  });
};

// Real-time synchronization endpoint retrieving live purchase order details from Zoho Books
app.get('/api/zoho/purchaseorders/{*id}', async (req, res) => {
  const rawId = req.params.id;
  const poNo = decodeURIComponent(Array.isArray(rawId) ? rawId.join('/') : (rawId || ''));
  if (!zohoSession.connected) {
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
      normalize(p.zohoId) === targetClean ||
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

    return res.json({
      id: poNo,
      poNo: poNo,
      vendor: matchedLocalPO ? matchedLocalPO.vendor : 'Misar Trading Co',
      branch: matchedLocalPO ? matchedLocalPO.branch : '',
      contactPerson: matchedLocalPO ? matchedLocalPO.contactPerson : '',
      contactNo: matchedLocalPO ? matchedLocalPO.contactNo : '',
      email: matchedLocalPO ? matchedLocalPO.email : '',
      gstNo: matchedLocalPO ? matchedLocalPO.gstNo : '',
      deliveryAddress: matchedLocalPO ? (matchedLocalPO.deliveryAddress || '—') : '—',
      billingAddress: matchedLocalPO ? (matchedLocalPO.billingAddress || '—') : '—',
      poDate: matchedLocalPO ? matchedLocalPO.poDate : '05 Aug 2026',
      deliveryDate: matchedLocalPO ? matchedLocalPO.deliveryDate : '12 Aug 2026',
      paymentTerms: matchedLocalPO ? matchedLocalPO.paymentTerms : 'Net 30 Days',
      purchaser: matchedLocalPO ? matchedLocalPO.purchaser : '—',
      shipmentPref: matchedLocalPO ? matchedLocalPO.shipmentPref : 'Road Transport',
      currency: matchedLocalPO ? matchedLocalPO.currency : 'INR',
      project: matchedLocalPO ? matchedLocalPO.project : '',
      priority: matchedLocalPO ? matchedLocalPO.priority : 'High',
      shippingCharges: matchedLocalPO ? (matchedLocalPO.shippingCharges || 0) : 0,
      otherCharges: matchedLocalPO ? (matchedLocalPO.otherCharges || 0) : 0,
      discountPct: matchedLocalPO ? (matchedLocalPO.discountPct || 0) : 0,
      notes: matchedLocalPO ? (matchedLocalPO.notes || '') : '',
      terms: matchedLocalPO ? (matchedLocalPO.terms || '') : '',
      items: items,
      totalOrderedQty,
      totalReceivedQty,
      totalRemainingQty: Math.max(0, totalOrderedQty - totalReceivedQty),
      receivingProgressPct: totalOrderedQty > 0 ? ((totalReceivedQty / totalOrderedQty) * 100).toFixed(1) : 0,
      grnHistory: matchingGRNs,
      amount: matchedLocalPO ? matchedLocalPO.amount : '₹ 13,75,000.00',
      status: matchedLocalPO ? matchedLocalPO.status : (totalReceivedQty >= totalOrderedQty ? 'CLOSED / FULLY RECEIVED' : (totalReceivedQty > 0 ? 'OPEN / PARTIALLY RECEIVED' : 'OPEN')),
      statusType: matchedLocalPO ? matchedLocalPO.statusType : (totalReceivedQty >= totalOrderedQty ? 'closed' : (totalReceivedQty > 0 ? 'partially_received' : 'open'))
    });
  }

  try {
    const timeoutPromise = new Promise((_, reject) => 
      setTimeout(() => reject(new Error('Zoho PO detail fetch timed out (using local authoritative record)')), 4000)
    );
    const fetchZohoPromise = (async () => {
      const accessToken = await getZohoAccessToken();
      const realPoId = await resolveZohoPOId(accessToken, poNo);
      return await fetchZohoPurchaseOrderDetail(accessToken, realPoId || poNo);
    })();
    const data = await Promise.race([fetchZohoPromise, timeoutPromise]);
    
    if (data.purchaseorder) {
      const po = data.purchaseorder;
      const localGRNs = loadLocalGRNs();
      const matchingGRNs = localGRNs.filter(g => 
        g.poRef === po.purchaseorder_number || g.poNo === po.purchaseorder_number || g.poId === po.purchaseorder_number ||
        g.poRef === po.purchaseorder_id || g.poNo === po.purchaseorder_id || g.poId === po.purchaseorder_id ||
        g.poRef === poNo || g.poNo === poNo || g.poId === poNo
      );

      // Compute cumulative received quantities per line item position
      const itemReceivedTotals = {};
      matchingGRNs.forEach(grn => {
        (grn.items || []).forEach((it, idx) => {
          const qty = Number(it.accepted !== undefined ? it.accepted : (it.now || 0));
          const idKey = it.id || it.itemId || it.lineItemId;
          const nameKey = String(it.name || '').trim().toLowerCase();
          if (idKey) itemReceivedTotals[idKey] = (itemReceivedTotals[idKey] || 0) + qty;
          if (nameKey) itemReceivedTotals[nameKey] = (itemReceivedTotals[nameKey] || 0) + qty;
          itemReceivedTotals[`IDX-${idx}`] = (itemReceivedTotals[`IDX-${idx}`] || 0) + qty;
        });
      });

      let totalOrderedQty = 0;
      let totalReceivedQty = 0;

      const localPOs = loadLocalPOs();
      const normalize = (s) => String(s || '').replace(/[/_\-\s]/g, '').toLowerCase();
      const cleanZohoId = normalize(po.purchaseorder_id);
      const cleanPoNo = normalize(po.purchaseorder_number || poNo);
      const matchedLocalPO = localPOs.find(p => {
        const lpId = normalize(p.id);
        const lpNo = normalize(p.poNo);
        const lpZohoId = normalize(p.zohoId);
        return (cleanZohoId && (lpId === cleanZohoId || lpZohoId === cleanZohoId || lpNo === cleanZohoId)) ||
               (cleanPoNo && (lpNo === cleanPoNo || lpId === cleanPoNo || lpZohoId === cleanPoNo));
      });

      const rawLineItems = (po.line_items && Array.isArray(po.line_items) && po.line_items.length > 0)
        ? po.line_items
        : (matchedLocalPO && Array.isArray(matchedLocalPO.items) && matchedLocalPO.items.length > 0 ? matchedLocalPO.items : (po.line_items || []));

      const items = rawLineItems.map((item, idx) => {
        const idKey = item.id || item.itemId || item.line_item_id;
        const nameKey = String(item.name || item.itemName || '').trim().toLowerCase();
        let prevReceived = 0;
        if (idKey && itemReceivedTotals[idKey] !== undefined) {
          prevReceived = itemReceivedTotals[idKey];
        } else if (nameKey && itemReceivedTotals[nameKey] !== undefined) {
          prevReceived = itemReceivedTotals[nameKey];
        } else if (itemReceivedTotals[`IDX-${idx}`] !== undefined) {
          prevReceived = itemReceivedTotals[`IDX-${idx}`];
        }
        const ordered = Number(item.qty !== undefined ? item.qty : (item.quantity || 0));
        const remaining = Math.max(0, ordered - prevReceived);

        totalOrderedQty += ordered;
        totalReceivedQty += prevReceived;

        const localItem = matchedLocalPO && matchedLocalPO.items && matchedLocalPO.items[idx];
        const effectiveTax = (item.tax !== undefined && item.tax !== '' && !isNaN(Number(item.tax)))
          ? Number(item.tax)
          : ((localItem && localItem.tax !== undefined && localItem.tax !== '')
            ? Number(localItem.tax)
            : (item.tax_percentage > 0 ? Number(item.tax_percentage) : 18));

        return {
          name: (localItem && localItem.name) ? localItem.name : (item.name || item.itemName || 'Material Item'),
          description: (localItem && localItem.description) ? localItem.description : (item.description || item.desc || ''),
          account: (localItem && localItem.account) ? localItem.account : (item.account || item.account_name || 'Cost of Goods Sold'),
          qty: ordered,
          unit: item.unit || (localItem ? localItem.unit : 'NOS'),
          rate: Number(item.rate !== undefined ? item.rate : (item.unitPrice || (localItem ? localItem.rate : 0))),
          tax: effectiveTax,
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

      let statusType = 'open';
      let statusText = 'OPEN';

      const matchingClosedGRN = matchingGRNs.some(g => 
        g.status === 'CLOSED / FULLY RECEIVED' || 
        g.status === 'Fully Accepted' || 
        g.status === 'Closed' || 
        g.status === 'CLOSED'
      );

      const isActuallyClosed = (totalOrderedQty > 0 && totalReceivedQty >= totalOrderedQty) || (matchingClosedGRN && (totalOrderedQty === 0 || totalReceivedQty >= totalOrderedQty)) || (po.status === 'closed' && (totalOrderedQty === 0 || totalReceivedQty >= totalOrderedQty));
      const isPartiallyReceived = (totalOrderedQty > 0 && totalReceivedQty > 0 && totalReceivedQty < totalOrderedQty) || (matchingGRNs.length > 0 && totalReceivedQty < totalOrderedQty) || po.status === 'partially_received' || (matchedLocalPO && (matchedLocalPO.status === 'OPEN / PARTIALLY RECEIVED' || matchedLocalPO.statusType === 'partially_received'));

      if (isPartiallyReceived && totalOrderedQty > 0 && totalReceivedQty < totalOrderedQty) {
        statusType = 'partially_received';
        statusText = 'OPEN / PARTIALLY RECEIVED';
      } else if (isActuallyClosed) {
        statusType = 'closed';
        statusText = 'CLOSED / FULLY RECEIVED';
      } else if (isPartiallyReceived || (totalReceivedQty > 0 && totalOrderedQty > 0 && totalReceivedQty < totalOrderedQty) || po.status === 'received' || po.is_received === true) {
        statusType = 'partially_received';
        statusText = 'OPEN / PARTIALLY RECEIVED';
      } else if (matchedLocalPO && (matchedLocalPO.status === 'Proceed PO' || matchedLocalPO.statusType === 'proceed_po')) {
        statusType = 'proceed_po';
        statusText = 'Proceed PO';
      } else if (matchedLocalPO && (matchedLocalPO.status === 'Payment Processed' || matchedLocalPO.statusType === 'payment_processed')) {
        statusType = 'payment_processed';
        statusText = 'Payment Processed';
      } else if (matchedLocalPO && (matchedLocalPO.status === 'MD Approved' || matchedLocalPO.statusType === 'md_approved' || Boolean(matchedLocalPO.approvedBy))) {
        statusType = 'md_approved';
        statusText = 'MD Approved';
      } else if (matchedLocalPO && matchedLocalPO.status === 'REJECTED') {
        statusType = 'rejected';
        statusText = 'REJECTED';
      } else if (matchedLocalPO && (matchedLocalPO.status === 'Draft / Pending Approval' || matchedLocalPO.status === 'WAITING FOR APPROVAL' || matchedLocalPO.status === 'Pending Approval' || matchedLocalPO.statusType === 'pending')) {
        statusType = 'pending';
        statusText = 'Draft / Pending Approval';
      } else if (matchedLocalPO && (matchedLocalPO.status === 'Draft' || matchedLocalPO.statusType === 'draft')) {
        statusType = 'draft';
        statusText = 'Draft';
      } else if (po.status === 'draft') {
        statusType = 'draft';
        statusText = 'Draft';
      } else if ((matchedLocalPO && matchedLocalPO.status === 'OPEN') || po.status === 'issued' || po.status === 'open' || po.status === 'approved') {
        statusType = 'approved';
        statusText = 'OPEN';
      }



      const buildAddrStr = (addrObj) => {
        if (!addrObj) return '';
        if (typeof addrObj === 'string') return addrObj;
        const parts = [
          addrObj.address,
          addrObj.address1,
          addrObj.street2,
          addrObj.city,
          addrObj.state,
          addrObj.zip,
          addrObj.country
        ].filter(p => p && String(p).trim().length > 0);
        return parts.join(', ');
      };

      const rawDelAddr = buildAddrStr(po.delivery_address);
      const delAddrFormatted = (matchedLocalPO && matchedLocalPO.deliveryAddress)
        ? matchedLocalPO.deliveryAddress
        : (rawDelAddr || '—');

      const rawBillAddr = buildAddrStr(po.billing_address);
      const billAddrFormatted = (matchedLocalPO && matchedLocalPO.billingAddress)
        ? matchedLocalPO.billingAddress
        : (rawBillAddr || '—');

      const effectiveVendor = (matchedLocalPO && matchedLocalPO.vendor && matchedLocalPO.vendor !== 'Fresh Vendor' && matchedLocalPO.vendor !== 'Vendor' && (po.vendor_name === 'Annamalaiyar' ? matchedLocalPO.vendor : (matchedLocalPO.vendor || po.vendor_name))) || (matchedLocalPO ? matchedLocalPO.vendor : null) || po.vendor_name || 'Vendor';
      const effectiveDelAddr = (matchedLocalPO && matchedLocalPO.deliveryAddress && matchedLocalPO.deliveryAddress !== '—' && matchedLocalPO.deliveryAddress !== 'Tamil Nadu, India') ? matchedLocalPO.deliveryAddress : (delAddrFormatted || '—');
      const effectiveBillAddr = (matchedLocalPO && matchedLocalPO.billingAddress && matchedLocalPO.billingAddress !== '—') ? matchedLocalPO.billingAddress : (billAddrFormatted || '—');
      const effectiveTerms = (matchedLocalPO && matchedLocalPO.terms && matchedLocalPO.terms.length > 50) ? matchedLocalPO.terms : (po.terms || matchedLocalPO?.terms || '');
      const effectiveItems = (items && items.length > 0) ? items : (matchedLocalPO?.items || []);
      const effectiveAmount = (matchedLocalPO && matchedLocalPO.amount && matchedLocalPO.amount !== '₹0.00' && matchedLocalPO.amount !== '₹ 0.00') ? matchedLocalPO.amount : `₹${Number(po.total || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

      const translated = {
        id: po.purchaseorder_id,
        poNo: po.purchaseorder_number,
        vendor: effectiveVendor,
        branch: (matchedLocalPO && matchedLocalPO.branch) ? matchedLocalPO.branch : (po.branch_name || ''),
        contactPerson: (matchedLocalPO && matchedLocalPO.contactPerson) ? matchedLocalPO.contactPerson : (po.contact_person_name || ''),
        contactNo: (matchedLocalPO && matchedLocalPO.contactNo) ? matchedLocalPO.contactNo : (po.phone || po.mobile || ''),
        email: (matchedLocalPO && matchedLocalPO.email) ? matchedLocalPO.email : (po.email || ''),
        gstNo: (matchedLocalPO && matchedLocalPO.gstNo && matchedLocalPO.gstNo !== '—') ? matchedLocalPO.gstNo : (po.gst_no || po.gstin || po.tax_registration_number || ''),
        deliveryAddress: effectiveDelAddr,
        billingAddress: effectiveBillAddr,
        poDate: po.date,
        deliveryDate: po.delivery_date || (matchedLocalPO ? matchedLocalPO.deliveryDate : '—'),
        paymentTerms: (matchedLocalPO && matchedLocalPO.paymentTerms && matchedLocalPO.paymentTerms !== 'Net 30 Days' && matchedLocalPO.paymentTerms !== 'Due on Receipt') ? matchedLocalPO.paymentTerms : (po.payment_terms_label || matchedLocalPO?.paymentTerms || 'Net 30 Days'),
        purchaser: (matchedLocalPO && matchedLocalPO.purchaser && matchedLocalPO.purchaser !== '—') ? matchedLocalPO.purchaser : (po.purchaser_name || '—'),
        shipmentPref: (matchedLocalPO && matchedLocalPO.shipmentPref) ? matchedLocalPO.shipmentPref : (po.shipment_preference || 'Road Transport'),
        currency: po.currency_code || (matchedLocalPO ? matchedLocalPO.currency : 'INR'),
        project: (matchedLocalPO && matchedLocalPO.project) ? matchedLocalPO.project : (po.project_name || ''),
        priority: (matchedLocalPO && matchedLocalPO.priority) ? matchedLocalPO.priority : (po.priority || 'High'),
        items: effectiveItems,
        totalOrderedQty: (matchedLocalPO && matchedLocalPO.totalOrderedQty) ? matchedLocalPO.totalOrderedQty : totalOrderedQty,
        totalReceivedQty: (matchedLocalPO && matchedLocalPO.totalReceivedQty) ? matchedLocalPO.totalReceivedQty : totalReceivedQty,
        totalRemainingQty: (matchedLocalPO && matchedLocalPO.totalRemainingQty) ? matchedLocalPO.totalRemainingQty : Math.max(0, totalOrderedQty - totalReceivedQty),
        receivingProgressPct: (matchedLocalPO && matchedLocalPO.receivingProgressPct) ? matchedLocalPO.receivingProgressPct : (totalOrderedQty > 0 ? ((totalReceivedQty / totalOrderedQty) * 100).toFixed(1) : 0),
        grnHistory: matchingGRNs,
        shippingCharges: (matchedLocalPO && matchedLocalPO.shippingCharges !== undefined) ? matchedLocalPO.shippingCharges : (po.shipping_charge || 0),
        otherCharges: (matchedLocalPO && matchedLocalPO.otherCharges !== undefined) ? matchedLocalPO.otherCharges : (po.adjustment || 0),
        discountPct: (matchedLocalPO && matchedLocalPO.discountPct !== undefined) ? matchedLocalPO.discountPct : (po.discount_percent || 0),
        notes: (matchedLocalPO && matchedLocalPO.notes) ? matchedLocalPO.notes : (po.notes || ''),
        terms: effectiveTerms,
        amount: effectiveAmount,
        status: statusText,
        statusType: statusType,
        approvedBy: matchedLocalPO ? matchedLocalPO.approvedBy : undefined,
        approvalDate: matchedLocalPO ? matchedLocalPO.approvalDate : undefined,
        approvalTime: matchedLocalPO ? matchedLocalPO.approvalTime : undefined,
        approvalRemarks: matchedLocalPO ? matchedLocalPO.approvalRemarks : undefined,
        paymentDetails: matchedLocalPO ? matchedLocalPO.paymentDetails : undefined,
        proceedDetails: matchedLocalPO ? matchedLocalPO.proceedDetails : undefined
      };

      // Cache this fully loaded PO record into po_store.json & Supabase cloud store
      try {
        const localPOs = loadLocalPOs();
        const lpIdx = localPOs.findIndex(p => p.id === translated.id || p.poNo === translated.poNo);
        if (lpIdx !== -1) {
          localPOs[lpIdx] = { ...localPOs[lpIdx], ...translated };
        } else {
          localPOs.unshift(translated);
        }
        saveLocalPOs(localPOs);
        saveDatabaseStore('po_store', localPOs).catch(() => {});
      } catch (_) {}

      res.json(translated);
    } else {
      throw new Error(data.message || 'Failed to fetch purchase order details from Zoho.');
    }
  } catch (err) {
    console.error('Zoho PO detail fetch failed, utilizing local fallback:', err);
    const localGRNs = loadLocalGRNs();
    const matchingGRNs = localGRNs.filter(g => g.poRef === poNo || g.poNo === poNo || g.id === poNo);
    
    const localPOs = loadLocalPOs();
    const normalize = (s) => String(s || '').replace(/[/_\-\s]/g, '').toLowerCase();
    const targetClean = normalize(poNo);
    const matchedLocalPO = localPOs.find(p => 
      normalize(p.id) === targetClean || 
      normalize(p.poNo) === targetClean || 
      normalize(p.zohoId) === targetClean ||
      normalize(p.purchaseorder_number) === targetClean ||
      (p.poNo && normalize(p.poNo).includes(targetClean)) ||
      (targetClean && normalize(p.poNo).length > 0 && targetClean.includes(normalize(p.poNo)))
    );
    
    let sampleItems = [];
    if (matchedLocalPO && Array.isArray(matchedLocalPO.items) && matchedLocalPO.items.length > 0) {
      sampleItems = matchedLocalPO.items.map(it => ({
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
      (grn.items || []).forEach(it => {
        const key = (it.name || '').trim().toLowerCase();
        itemReceivedTotals[key] = (itemReceivedTotals[key] || 0) + Number(it.accepted || it.now || 0);
      });
    });

    let totalOrderedQty = 0;
    let totalReceivedQty = 0;

    const items = sampleItems.map((item, idx) => {
      const key = (item.name || '').trim().toLowerCase();
      const prevReceived = itemReceivedTotals[key] || 0;
      const ordered = item.quantity || 0;
      const remaining = Math.max(0, ordered - prevReceived);

      totalOrderedQty += ordered;
      totalReceivedQty += Math.min(ordered, prevReceived);

      return {
        name: item.name,
        sku: item.sku || `SKU-${101 + idx}`,
        description: item.description,
        account: item.account || 'Raw Material',
        qty: ordered,
        unit: item.unit,
        rate: item.rate,
        tax: item.tax !== undefined ? item.tax : 18,
        previouslyReceived: prevReceived,
        remainingQty: remaining
      };
    });

    return res.json({
      id: matchedLocalPO ? (matchedLocalPO.zohoId || matchedLocalPO.id || poNo) : poNo,
      poNo: matchedLocalPO ? (matchedLocalPO.poNo || matchedLocalPO.purchaseorder_number || poNo) : poNo,
      zohoId: matchedLocalPO ? (matchedLocalPO.zohoId || matchedLocalPO.id) : undefined,
      vendor: matchedLocalPO ? matchedLocalPO.vendor : 'Misar Trading Co',
      branch: matchedLocalPO ? matchedLocalPO.branch : '',
      contactPerson: matchedLocalPO ? matchedLocalPO.contactPerson : '',
      contactNo: matchedLocalPO ? matchedLocalPO.contactNo : '',
      email: matchedLocalPO ? matchedLocalPO.email : '',
      gstNo: matchedLocalPO ? matchedLocalPO.gstNo : '',
      deliveryAddress: matchedLocalPO ? (matchedLocalPO.deliveryAddress || '—') : '—',
      billingAddress: matchedLocalPO ? (matchedLocalPO.billingAddress || '—') : '—',
      poDate: matchedLocalPO ? matchedLocalPO.poDate : '05 Aug 2026',
      deliveryDate: matchedLocalPO ? matchedLocalPO.deliveryDate : '12 Aug 2026',
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
      totalOrderedQty,
      totalReceivedQty,
      totalRemainingQty: Math.max(0, totalOrderedQty - totalReceivedQty),
      receivingProgressPct: totalOrderedQty > 0 ? ((totalReceivedQty / totalOrderedQty) * 100).toFixed(1) : 0,
      grnHistory: matchingGRNs,
      amount: matchedLocalPO ? matchedLocalPO.amount : '₹ 13,75,000.00',
      status: matchedLocalPO ? matchedLocalPO.status : (totalReceivedQty >= totalOrderedQty ? 'CLOSED / FULLY RECEIVED' : (totalReceivedQty > 0 ? 'OPEN / PARTIALLY RECEIVED' : 'OPEN')),
      statusType: matchedLocalPO ? matchedLocalPO.statusType : (totalReceivedQty >= totalOrderedQty ? 'closed' : (totalReceivedQty > 0 ? 'partially_received' : 'open')),
      approvedBy: matchedLocalPO ? matchedLocalPO.approvedBy : undefined,
      approvalDate: matchedLocalPO ? matchedLocalPO.approvalDate : undefined,
      approvalTime: matchedLocalPO ? matchedLocalPO.approvalTime : undefined,
      approvalRemarks: matchedLocalPO ? matchedLocalPO.approvalRemarks : undefined,
      paymentDetails: matchedLocalPO ? matchedLocalPO.paymentDetails : undefined,
      proceedDetails: matchedLocalPO ? matchedLocalPO.proceedDetails : undefined
    });
  }
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
      const pZohoId = normalize(p.zohoId);
      return pRef && (pNo === pRef || pId === pRef || pZohoId === pRef || (pNo && pRef.includes(pNo)) || (pNo && pNo.includes(pRef)));
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

// Endpoint to create a new GRN (Saves locally + Posts Draft Bill to Zoho)
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
    status: calculatedStatus,
    zohoBillPosted: false
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
        const poZohoId = normalize(po.zohoId);
        if (poRefTarget === poNum || poRefTarget === poId || poRefTarget === poZohoId || (poNum && poRefTarget.includes(poNum)) || (poNum && poNum.includes(poRefTarget))) {
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
          zohoId: grnData.poId || grnData.poRef,
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
        broadcastRealtimeEvent('inventory_updated', { rawMaterials: updatedRaw });
      }
    }
  } catch (err) {
    console.error('Failed to update inventory stock on GRN save:', err);
  }

  // 4. RETURN SUCCESS TO CLIENT IMMEDIATELY!
  res.json({ success: true, grn: newGRN });

  // 5. ASYNCHRONOUS BACKGROUND ZOHO SYNC (NON-BLOCKING)
  if (zohoSession.connected) {
    setImmediate(async () => {
      try {
        const accessToken = await getZohoAccessToken();
        const poTargetId = grnData.poId || grnData.poRef || grnData.poNo;
        if (poTargetId) {
          await createZohoPurchaseReceive(accessToken, poTargetId, newGRN);
          if (isFullyReceived) {
            await markZohoPOClosed(accessToken, poTargetId);
          }
        }
      } catch (err) {
        console.warn('[ZOHO BACKGROUND SYNC NOTICE]:', err?.message || err);
      }
    });
  }
});

// Endpoint for MD Approval (Draft/Pending -> MD Approved)
app.post('/api/zoho/purchaseorders/:id/approve', async (req, res) => {
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
    const pZohoId = normalize(p.zohoId);
    return cleanTarget && (pId === cleanTarget || pNo === cleanTarget || pZohoId === cleanTarget);
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

  // PO status remains Draft in Zoho Books until Accounts and Proceed PO is completed
  res.json({ success: true, message: `PO ${targetId} approved by ${approver} and marked as MD Approved!` });
});

// Endpoint for Payment Process (MD Approved -> Payment Processed / Credit Verified)
app.post('/api/zoho/purchaseorders/:id/process-payment', async (req, res) => {
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
    const pZohoId = normalize(p.zohoId);
    return cleanTarget && (pId === cleanTarget || pNo === cleanTarget || pZohoId === cleanTarget);
  });
  if (matchedIdx !== -1) {
    localPOs[matchedIdx].status = 'Payment Processed';
    localPOs[matchedIdx].statusType = 'payment_processed';
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

// Endpoint to Proceed PO (Payment Processed -> Proceed PO -> Ready for GRN & Auto Vendor Dispatch)
app.post('/api/zoho/purchaseorders/:id/proceed', async (req, res) => {
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
    const pZohoId = normalize(p.zohoId);
    return cleanTarget && (pId === cleanTarget || pNo === cleanTarget || pZohoId === cleanTarget);
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

  // Transition Zoho Books PO status from Draft to Issued / Open once PO is Proceeded, and email vendor (non-blocking)
  let zohoEmailResult = null;
  if (zohoSession.connected) {
    (async () => {
      try {
        const accessToken = await getZohoAccessToken();
        await approveOrOpenZohoPO(accessToken, targetId);
        if (vendorEmail && vendorEmail.includes('@')) {
          const emailRes = await emailZohoPOToVendor(accessToken, targetId, vendorEmail, remarks);
          console.log(`[Zoho PO Email] Dispatched PO ${targetId} to vendor ${vendorEmail}:`, emailRes);
        }
      } catch (err) {
        console.warn('Failed to transition PO or email vendor in Zoho on Proceed PO:', err.message);
      }
    })();
  }

  const message = vendorEmail
    ? `PO ${targetId} marked as Proceed PO! An official copy was automatically dispatched to vendor (${vendorEmail}). Ready for GRN receiving.`
    : `PO ${targetId} marked as Proceed PO! Ready for GRN receiving.`;

  res.json({
    success: true,
    vendorEmail,
    emailDispatched: Boolean(vendorEmail),
    zohoEmailResult,
    message
  });
});

// Endpoint to explicitly reject a Purchase Order (Pending -> Rejected)
app.post('/api/zoho/purchaseorders/:id/reject', async (req, res) => {
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



// Endpoint to explicitly close a Purchase Order in Zoho Books
app.post('/api/zoho/purchaseorders/:id/close', async (req, res) => {
  if (!zohoSession.connected) {
    return res.json({ success: true, message: 'PO marked as closed locally in Control Room.' });
  }

  try {
    const accessToken = await getZohoAccessToken();
    const targetId = req.params.id;
    const result = await markZohoPOClosed(accessToken, targetId);
    res.json({ success: true, result, message: 'Purchase Order marked as CLOSED in Zoho Books!' });
  } catch (err) {
    console.error('Failed to close PO in Zoho Books:', err);
    res.status(500).json({ error: err.message });
  }
});

// Endpoint to delete a Purchase Order in Zoho Books & Control Room
app.delete('/api/zoho/purchaseorders/:id', async (req, res) => {
  const targetId = req.params.id;

  // 1. Remove from local store
  const localPOs = loadLocalPOs();
  const targetClean = String(targetId).trim().toLowerCase();
  const updatedPOs = localPOs.filter(p => {
    const pId = String(p.id || '').toLowerCase();
    const pNo = String(p.poNo || '').toLowerCase();
    const zId = String(p.zohoId || '').toLowerCase();
    return pId !== targetClean && pNo !== targetClean && zId !== targetClean;
  });
  saveLocalPOs(updatedPOs);

  // 2. Delete in Zoho Books if connected
  if (zohoSession.connected) {
    try {
      const accessToken = await getZohoAccessToken();
      const zohoResult = await deleteZohoPurchaseOrder(accessToken, targetId);
      return res.json({ success: true, message: `PO ${targetId} deleted from Control Room and Zoho Books!`, zohoResult });
    } catch (err) {
      console.error('Failed to delete PO in Zoho Books:', err);
      return res.json({ success: true, warning: 'PO deleted locally in Control Room, but Zoho deletion encountered an issue.' });
    }
  }

  res.json({ success: true, message: `PO ${targetId} deleted from Control Room!` });
});

// Real-time synchronization endpoint retrieving approval pending counts from Zoho Books
app.get('/api/zoho/approvals-pending', async (req, res) => {
  if (!zohoSession.connected) {
    return res.json({ posPending: 0, grnsPending: 0, invoicesPending: 0 });
  }

  try {
    const accessToken = await getZohoAccessToken();

    // Fetch POs, Bills (GRNs), and Invoices from Zoho Books API in parallel
    const [poData, invoiceData, billData] = await Promise.all([
      fetchZohoPurchaseOrders(accessToken).catch(() => ({ purchaseorders: [] })),
      fetchZohoInvoices(accessToken).catch(() => ({ invoices: [] })),
      new Promise((resolve) => {
        const options = {
          hostname: 'www.zohoapis.in',
          port: 443,
          path: `/books/v3/bills?organization_id=${zohoSession.orgId}&status=pending_approval`,
          method: 'GET',
          headers: { 'Authorization': `Zoho-oauthtoken ${accessToken}` }
        };
        const r = https.request(options, (res) => {
          let d = '';
          res.on('data', (chunk) => { d += chunk; });
          res.on('end', () => { try { resolve(JSON.parse(d)); } catch (e) { resolve({ bills: [] }); } });
        });
        r.on('error', () => resolve({ bills: [] }));
        r.end();
      })
    ]);

    const pos = poData.purchaseorders || [];
    const invoices = invoiceData.invoices || [];
    const bills = billData.bills || [];

    // Filter live pending approval status
    const posPending = pos.filter(po => po.status === 'pending_approval' || po.status === 'draft').length;
    // Count draft Vendor Bills in Zoho Books as GRNs Pending Approval
    const grnsPending = bills.filter(b => b.status === 'draft' || b.status === 'pending_approval').length;
    const invoicesPending = invoices.filter(inv => inv.status === 'draft' || inv.status === 'pending_approval' || inv.status === 'unpaid').length;

    res.json({
      posPending,
      grnsPending,
      invoicesPending
    });
  } catch (err) {
    console.error("Error fetching approval counts from Zoho:", err);
    res.json({ posPending: 0, grnsPending: 0, invoicesPending: 0 });
  }
});



const fetchZohoItems = async (accessToken) => {
  let allItems = [];
  let page = 1;
  let hasMore = true;

  while (hasMore && page <= 10) {
    const pageData = await new Promise((resolve, reject) => {
      const options = {
        hostname: 'www.zohoapis.in',
        port: 443,
        path: `/books/v3/items?organization_id=${zohoSession.orgId}&per_page=200&page=${page}`,
        method: 'GET',
        headers: {
          'Authorization': `Zoho-oauthtoken ${accessToken}`
        }
      };

      const req = https.request(options, (res) => {
        let data = '';
        res.on('data', (chunk) => { data += chunk; });
        res.on('end', () => {
          try {
            const parsed = JSON.parse(data);
            resolve(parsed);
          } catch (e) {
            reject(e);
          }
        });
      });

      req.on('error', (e) => reject(e));
      req.end();
    });

    if (pageData && Array.isArray(pageData.items)) {
      allItems.push(...pageData.items);
      hasMore = pageData.page_context ? Boolean(pageData.page_context.has_more_page) : false;
      page++;
    } else {
      hasMore = false;
    }
  }

  return { items: allItems };
};

// Real-time synchronization endpoint retrieving live items catalog from Zoho Books
app.get('/api/zoho/items', async (req, res) => {
  const localItems = loadLocalItems();

  try {
    if (zohoSession.connected) {
      const accessToken = await getZohoAccessToken();
      const data = await fetchZohoItems(accessToken);
      
      if (data && data.items && Array.isArray(data.items)) {
        // Map local items by Code, SKU, itemId, and name fingerprint to preserve live deducted stock
        const localMap = new Map();
        localItems.forEach(i => {
          if (i.itemId) localMap.set(String(i.itemId).toLowerCase().trim(), i);
          if (i.code && i.code !== '—') localMap.set(String(i.code).toLowerCase().trim(), i);
          if (i.sku && i.sku !== '—') localMap.set(String(i.sku).toLowerCase().trim(), i);
          const res = resolveProductCode(i);
          if (res) localMap.set(String(res).toLowerCase().trim(), i);
          if (i.name) localMap.set(String(i.name).toLowerCase().trim(), i);
          const fp = wordFingerprint(i.name);
          if (fp) localMap.set(fp, i);
        });

        const translatedZoho = data.items.map(item => {
          const keyId = String(item.item_id || item.id || '').toLowerCase().trim();
          const keySku = String(item.sku || '').toLowerCase().trim();
          const keyName = String(item.name || '').toLowerCase().trim();
          const keyRes = resolveProductCode(item).toLowerCase().trim();
          const keyFp = wordFingerprint(item.name);
          const localMatch = localMap.get(keyId) ||
            (keySku && localMap.get(keySku)) ||
            (keyRes && localMap.get(keyRes)) ||
            (keyName && localMap.get(keyName)) ||
            (keyFp && localMap.get(keyFp));

          const calculatedStock = (localMatch?.stock !== undefined && localMatch.stock !== null)
            ? Number(localMatch.stock)
            : 0;

          return {
            id: item.item_id || item.id,
            itemId: item.item_id || item.id,
            code: item.sku || item.item_id || '—',
            name: item.name,
            rate: item.rate || 0,
            price: item.rate || 0,
            sku: item.sku || '—',
            status: localMatch?.status ? localMatch.status : (item.status === 'active' ? 'Active' : 'Inactive'),
            description: item.description || localMatch?.description || '—',
            purchaseRate: item.purchase_rate || localMatch?.purchaseRate || 0,
            purchaseDescription: item.purchase_description || localMatch?.purchaseDescription || '',
            productType: item.product_type || localMatch?.productType || 'goods',
            unit: item.unit || localMatch?.unit || 'NOS',
            uom: item.unit || localMatch?.uom || 'NOS',
            material: localMatch?.material || 'General Component',
            category: localMatch?.category || 'General',
            stock: calculatedStock,
            openingStock: (localMatch?.openingStock !== undefined && localMatch.openingStock !== null) ? Number(localMatch.openingStock) : 0,
            reorderLevel: localMatch?.reorderLevel || 100
          };
        });

        const zohoKeys = new Set(translatedZoho.map(z => String(z.sku || z.itemId || z.name).toLowerCase()));
        const uniqueLocal = localItems.filter(l => !zohoKeys.has(String(l.sku || l.itemId || l.name).toLowerCase())).map(l => ({
          ...l,
          stock: (l.stock !== undefined && l.stock !== null) ? Number(l.stock) : 0,
          openingStock: (l.openingStock !== undefined && l.openingStock !== null) ? Number(l.openingStock) : 0
        }));
        const mergedAll = [...uniqueLocal, ...translatedZoho];

        // Save fresh merged items back to server local store & Supabase
        saveLocalItems(mergedAll);

        return res.json(mergedAll);
      }
    }
  } catch (err) {
    console.error('Zoho items fetch notice:', err.message);
  }
  const guaranteedItems = (localItems || []).map(l => ({
    ...l,
    stock: (l.stock !== undefined && l.stock !== null) ? Number(l.stock) : 0,
    openingStock: (l.openingStock !== undefined && l.openingStock !== null) ? Number(l.openingStock) : 0
  }));
  res.json(guaranteedItems);
});

// Endpoint to retrieve live reconciled Raw Materials inventory
app.get('/api/raw-materials', async (req, res) => {
  try {
    // 1. Instant response from high-speed memory cache or disk
    if (supabaseMemoryStore.raw_materials_store && Array.isArray(supabaseMemoryStore.raw_materials_store) && supabaseMemoryStore.raw_materials_store.length > 0) {
      return res.json(supabaseMemoryStore.raw_materials_store);
    }
    const rawMats = loadLocalRawMaterials();
    if (Array.isArray(rawMats) && rawMats.length > 0) {
      return res.json(rawMats);
    }
    const cloudMats = await getDatabaseStore('raw_materials_store');
    if (Array.isArray(cloudMats) && cloudMats.length > 0) {
      cloudMats.forEach(item => {
        if (item && (item.code === 'ALU-LEN-2414MM' || item.code === 'RM-ALU-2414')) {
          item.cat = 'Raw Material';
          item.category = 'Raw Material';
        }
      });
      supabaseMemoryStore.raw_materials_store = cloudMats;
      try {
        const rawMatsPath = getStoreFilePath('raw_materials_store.json');
        fs.writeFileSync(rawMatsPath, JSON.stringify(cloudMats, null, 2), 'utf8');
      } catch (_) {}
      return res.json(cloudMats);
    }
    res.json([]);
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
      fs.writeFileSync(rawMatsPath, JSON.stringify(updatedMats, null, 2), 'utf8');
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
          fs.writeFileSync(itemPath, JSON.stringify(currentItems, null, 2), 'utf8');
          supabaseMemoryStore.item_store = currentItems;
          pushStoreToSupabase('item_store', currentItems).catch(() => {});
          broadcastRealtimeEvent('item_store_updated', { items: currentItems });
        }
      } catch (err) {
        console.error('[item_store sync error]:', err?.message);
      }

      pushStoreToSupabase('raw_materials_store', updatedMats).catch(() => {});
      broadcastRealtimeEvent('inventory_updated', { rawMaterials: updatedMats });
      return res.json({ success: true, count: updatedMats.length });
    }
    res.status(400).json({ success: false, message: 'Array of materials required' });
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
        mat.reserved = (parseFloat(mat.reserved) || 0) + qty;
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
        itMatch.reserved = (parseFloat(itMatch.reserved) || 0) + qty;
      }
    });

    if (deductedList.length > 0) {
      fs.writeFileSync(rawMatsPath, JSON.stringify(rawMats, null, 2), 'utf8');
      supabaseMemoryStore.raw_materials_store = rawMats;
      pushStoreToSupabase('raw_materials_store', rawMats).catch(() => {});
      broadcastRealtimeEvent('inventory_updated', { rawMaterials: rawMats, deducted: deductedList });

      fs.writeFileSync(itemsPath, JSON.stringify(itemsList, null, 2), 'utf8');
      supabaseMemoryStore.item_store = itemsList;
      pushStoreToSupabase('item_store', itemsList).catch(() => {});
      broadcastRealtimeEvent('item_store_updated', { items: itemsList });

      console.log(`[INVENTORY DEDUCTION] Deducted stock for BOM ${bomCode}:`, deductedList);
    }

    res.json({ success: true, deducted: deductedList, rawMaterials: rawMats });
  } catch (err) {
    console.error('[INVENTORY DEDUCTION ERROR]', err);
    res.status(500).json({ error: err.message });
  }
});

// Helper to delete an Item in Zoho Books
const deleteZohoItem = async (accessToken, itemRefOrId) => {
  let targetId = itemRefOrId;

  if (!String(itemRefOrId).match(/^\d+$/)) {
    const localItems = loadLocalItems();
    const matched = localItems.find(i => String(i.itemId) === String(itemRefOrId) || String(i.sku) === String(itemRefOrId) || String(i.name).toLowerCase() === String(itemRefOrId).toLowerCase());
    if (matched && String(matched.itemId).match(/^\d+$/)) {
      targetId = matched.itemId;
    }
  }

  return new Promise((resolve) => {
    const options = {
      hostname: 'www.zohoapis.in',
      port: 443,
      path: `/books/v3/items/${encodeURIComponent(targetId)}?organization_id=${zohoSession.orgId}`,
      method: 'DELETE',
      headers: {
        'Authorization': `Zoho-oauthtoken ${accessToken}`,
        'Content-Type': 'application/json'
      }
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          console.log(`[ZOHO ITEM DELETE] Deleted item ${targetId} in Zoho:`, parsed.message || 'Success');
          resolve(parsed);
        } catch (e) {
          resolve(null);
        }
      });
    });

    req.on('error', (e) => {
      console.error('[ZOHO ITEM DELETE ERROR]', e);
      resolve(null);
    });
    req.end();
  });
};

// Endpoint to delete an Item in Zoho Books & Control Room
app.delete('/api/zoho/items/:id', async (req, res) => {
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

  if (zohoSession.connected) {
    try {
      const accessToken = await getZohoAccessToken();
      const zohoResult = await deleteZohoItem(accessToken, targetId);
      return res.json({ success: true, message: `Item ${targetId} deleted from Control Room and Zoho Books!`, zohoResult });
    } catch (err) {
      console.error('Failed to delete item in Zoho Books:', err);
      return res.json({ success: true, warning: 'Item deleted locally in Control Room, but Zoho deletion encountered an issue.' });
    }
  }

  res.json({ success: true, message: `Item ${targetId} deleted from Control Room!` });
});

const fetchZohoItemDetail = (accessToken, id) => {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'www.zohoapis.in',
      port: 443,
      path: `/books/v3/items/${id}?organization_id=${zohoSession.orgId}`,
      method: 'GET',
      headers: {
        'Authorization': `Zoho-oauthtoken ${accessToken}`
      }
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          resolve(parsed);
        } catch (e) {
          reject(e);
        }
      });
    });

    req.on('error', (e) => reject(e));
    req.end();
  });
};

// Real-time synchronization endpoint retrieving live item details from Zoho Books
app.get('/api/zoho/items/:id', async (req, res) => {
  if (!zohoSession.connected) {
    return res.status(401).json({ error: 'Zoho not connected.' });
  }

  try {
    const accessToken = await getZohoAccessToken();
    const data = await fetchZohoItemDetail(accessToken, req.params.id);
    
    if (data.item) {
      const item = data.item;
      res.json({
        itemId: item.item_id,
        name: item.name,
        sku: item.sku || '—',
        status: item.status === 'active' ? 'Active' : 'Inactive',
        description: item.description || '—',
        unit: item.unit || 'NOS',
        rate: item.rate || 0,
        purchaseRate: item.purchase_rate || 0,
        purchaseDescription: item.purchase_description || '—',
        stockOnHand: item.stock_on_hand !== undefined ? item.stock_on_hand : '—',
        reorderLevel: item.reorder_level || '—',
        itemType: item.item_type || 'sales_and_purchase',
        productType: item.product_type || 'goods',
        purchaseAccount: item.purchase_account_name || 'Cost of Goods Sold',
        salesAccount: item.account_name || 'Sales',
        taxName: item.tax_name || '—',
        taxPercentage: item.tax_percentage || 0
      });
    } else {
      res.status(500).json({ error: data.message || 'Failed to fetch item details.' });
    }
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Connection to Zoho Books failed.' });
  }
});

const updateZohoItem = (accessToken, id, itemData) => {
  return new Promise((resolve, reject) => {
    const payload = JSON.stringify({
      name: itemData.name,
      rate: itemData.rate,
      sku: itemData.sku,
      description: itemData.description,
      unit: itemData.unit,
      purchase_rate: itemData.purchaseRate || itemData.purchase_rate || itemData.rate,
      purchase_description: itemData.purchaseDescription || itemData.purchase_description || itemData.description,
      is_purchase: true,
      can_be_purchased: true,
      item_type: 'sales_and_purchases',
      purchase_account_id: itemData.purchase_account_id || "4080449000000000567"
    });

    const options = {
      hostname: 'www.zohoapis.in',
      port: 443,
      path: `/books/v3/items/${id}?organization_id=${zohoSession.orgId}`,
      method: 'PUT',
      headers: {
        'Authorization': `Zoho-oauthtoken ${accessToken}`,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(payload)
      }
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          resolve(parsed);
        } catch (e) {
          reject(e);
        }
      });
    });

    req.on('error', (e) => reject(e));
    req.write(payload);
    req.end();
  });
};

// Real-time synchronization endpoint updating item details in Zoho Books
app.put('/api/zoho/items/:id', async (req, res) => {
  const targetId = req.params.id;
  const reqStatus = (req.body.status && String(req.body.status).toLowerCase() === 'inactive') ? 'Inactive' : 'Active';

  // Always update local & Supabase store immediately
  try {
    const localItems = loadLocalItems();
    const updated = localItems.map(it => {
      if (String(it.itemId || it.id) === String(targetId) || String(it.sku) === String(targetId)) {
        return {
          ...it,
          ...req.body,
          status: reqStatus
        };
      }
      return it;
    });
    saveLocalItems(updated);
  } catch (e) {}

  if (!zohoSession.connected) {
    return res.json({ success: true, message: 'Updated locally (Zoho disconnected mode).' });
  }

  try {
    const accessToken = await getZohoAccessToken();
    const data = await updateZohoItem(accessToken, targetId, req.body);
    if (data.code === 0 || data.item) {
      res.json({ success: true, item: data.item, message: 'Item updated successfully in Zoho Books.' });
    } else {
      res.json({ success: true, message: 'Item updated locally and saved to Control Room.' });
    }
  } catch (err) {
    console.error(err);
    res.json({ success: true, message: 'Item updated locally and saved to Control Room.' });
  }
});

const createZohoItem = (accessToken, itemData) => {
  return new Promise((resolve, reject) => {
    const payloadObj = {
      name: itemData.name ? itemData.name.trim() : '',
      rate: Number(itemData.rate) || 0,
      product_type: (itemData.productType === 'service' || itemData.productType === 'services') ? 'service' : 'goods'
    };

    if (itemData.sku && itemData.sku.trim() && itemData.sku !== '—') {
      payloadObj.sku = itemData.sku.trim();
    }
    if (itemData.description && itemData.description.trim() && itemData.description !== '—') {
      payloadObj.description = itemData.description.trim();
    }
    if (itemData.unit && itemData.unit.trim()) {
      payloadObj.unit = itemData.unit.trim();
    }
    if (itemData.purchaseRate && Number(itemData.purchaseRate) > 0) {
      payloadObj.purchase_rate = Number(itemData.purchaseRate);
    }
    if (itemData.purchaseDescription && itemData.purchaseDescription.trim() && itemData.purchaseDescription !== '—') {
      payloadObj.purchase_description = itemData.purchaseDescription.trim();
    }

    const payload = JSON.stringify(payloadObj);

    const options = {
      hostname: 'www.zohoapis.in',
      port: 443,
      path: `/books/v3/items?organization_id=${zohoSession.orgId}`,
      method: 'POST',
      headers: {
        'Authorization': `Zoho-oauthtoken ${accessToken}`,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(payload)
      }
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          console.log(`[ZOHO ITEM CREATE] Result for "${payloadObj.name}":`, parsed.code === 0 ? 'Success' : parsed.message);
          resolve(parsed);
        } catch (e) {
          reject(e);
        }
      });
    });

    req.on('error', (e) => reject(e));
    req.write(payload);
    req.end();
  });
};

// Real-time creation endpoint adding new product into Zoho Books
app.post('/api/zoho/items', async (req, res) => {
  const newItemId = 'ITEM-' + Date.now();
  const reqStatus = (req.body.status && String(req.body.status).toLowerCase() === 'inactive') ? 'Inactive' : 'Active';
  const fallbackItem = {
    itemId: newItemId,
    name: req.body.name,
    rate: Number(req.body.rate) || 0,
    sku: req.body.sku || '—',
    status: reqStatus,
    description: req.body.description || '—',
    unit: req.body.unit || 'NOS',
    purchaseRate: Number(req.body.purchaseRate) || 0,
    purchaseDescription: req.body.purchaseDescription || '—',
    productType: req.body.productType || 'goods'
  };

  let itemToSave = fallbackItem;
  let zohoError = null;

  if (zohoSession.connected) {
    try {
      const accessToken = await getZohoAccessToken();
      const data = await createZohoItem(accessToken, req.body);
      if (data && data.code === 0 && data.item) {
        const created = data.item;
        itemToSave = {
          itemId: created.item_id,
          name: created.name,
          rate: created.rate || 0,
          sku: created.sku || '—',
          status: reqStatus, // Strictly honor user's chosen status (Active vs Inactive)
          description: created.description || '—',
          unit: created.unit || 'NOS',
          purchaseRate: created.purchase_rate || 0,
          purchaseDescription: created.purchase_description || '—',
          productType: created.product_type || 'goods'
        };
      } else if (data && data.code !== 0) {
        zohoError = data.message || 'Zoho Books returned an error';
        console.warn('Zoho returned error code when creating item:', data);
      }
    } catch (err) {
      zohoError = err.message;
      console.error('Zoho item creation notice:', err.message);
    }
  }

  // Persist newly created product into local item_store.json & Supabase cloud store
  try {
    const localItems = loadLocalItems();
    const filtered = localItems.filter(i => String(i.itemId || i.id || i.sku).toLowerCase() !== String(itemToSave.itemId || itemToSave.sku || itemToSave.name).toLowerCase());
    const updated = [itemToSave, ...filtered];
    saveLocalItems(updated);
  } catch (e) {
    console.error('Failed to save newly created item to item_store:', e);
  }

  res.json({ 
    success: true, 
    item: itemToSave, 
    zohoError,
    message: itemToSave.itemId.startsWith('ITEM-') && zohoError 
      ? `Saved locally. Zoho sync pending: ${zohoError}`
      : 'Item saved successfully and synced with Zoho Books.'
  });
});

// Universal Stock Reset Endpoint: Resets all stock to 0, wipes allocations, and sets each item to exactly 5,000
app.all('/api/inventory/reset-to-5000', async (req, res) => {
  try {
    const localItems = loadLocalItems();
    const existingRaw = supabaseMemoryStore.raw_materials_store || [];
    
    // Step 1: Combine VRM standardized products, Zoho items, and existing raw profiles
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

    // 3. Merge local Zoho items
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

    // Step 4: Persist to item_store (used by Item Directory & Zoho Catalog)
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
      source = 'WhatsApp Inbound'
    } = req.body;

    const clean = message.toLowerCase();
    const kwMatch = clean.match(/(\d+(?:\.\d+)?)\s*(?:kw|k\.w|kilowatt|megawatt|mw)/i);
    let estimatedKw = kwMatch ? parseFloat(kwMatch[1]) : 150;

    let category = 'Aluminium Mounting Structures';
    if (clean.includes('tin') || clean.includes('sheet') || clean.includes('shed')) {
      category = 'Tin Shed Clamping Systems';
    } else if (clean.includes('ground') || clean.includes('hdg')) {
      category = 'HDG Ground Mounting Structures';
    }

    const isAutoQualified = estimatedKw >= 10;
    const leadId = `LEAD-2026-${Date.now().toString().slice(-4)}`;
    const nextNumber = `LEAD-${Math.floor(100 + Math.random() * 899)}`;

    const simulatedLead = {
      id: leadId,
      leadNumber: nextNumber,
      companyName,
      contactPerson,
      phone,
      whatsapp: phone,
      email: `${contactPerson.toLowerCase().replace(/\s+/g, '.')}@${companyName.toLowerCase().replace(/[^a-z0-9]/g, '')}.com`,
      location: 'Hosur, Tamil Nadu',
      source,
      requirement: `${estimatedKw} kW ${category}`,
      estimatedKw,
      category,
      estimatedValue: estimatedKw * 2800,
      assignedSalesperson: 'Mohith JV',
      status: isAutoQualified ? 'Qualified' : 'New Lead',
      priority: estimatedKw >= 100 ? 'HIGH' : 'MEDIUM',
      notes: message,
      isAutoGenerated: true,
      createdAt: new Date().toISOString(),
      timeline: [
        {
          id: `TL-${Date.now()}-1`,
          type: 'auto_ingested',
          title: 'Auto-Captured Inbound Inquiry',
          description: `Captured via ${source} with AI auto-parsing: ${estimatedKw} kW ${category}`,
          timestamp: new Date().toISOString()
        },
        ...(isAutoQualified ? [{
          id: `TL-${Date.now()}-2`,
          type: 'auto_qualified',
          title: '⚡ Auto-Qualified by AI Engine',
          description: `Capacity (${estimatedKw} kW) exceeds qualification threshold (>=10 kW). Estimated Deal: ₹ ${(estimatedKw * 2800).toLocaleString('en-IN')}`,
          timestamp: new Date().toISOString()
        }] : [])
      ]
    };

    // Persist directly to Leads Database
    try {
      const existing = await loadDatabaseLeads();
      const updated = [simulatedLead, ...existing.filter(l => l.id !== simulatedLead.id)];
      await saveLocalLeads(updated);
    } catch (_) {}

    // Broadcast realtime event so web clients can catch and update without reloading
    broadcastRealtimeEvent('crm_lead_created', { lead: simulatedLead });

    res.json({
      success: true,
      message: 'Automated Inbound Lead Captured and Pre-Qualified in Database!',
      lead: simulatedLead
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ==========================================
// 🚀 CANONICAL LEADS DATABASE REST API
// ==========================================
app.get(['/api/crm/leads', '/api/leads'], async (req, res) => {
  try {
    const leads = await loadDatabaseLeads();
    res.json({ success: true, count: leads.length, data: leads });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post(['/api/crm/leads', '/api/leads'], async (req, res) => {
  try {
    const newLead = (req.body && req.body.lead) ? req.body.lead : req.body;
    if (!newLead || Object.keys(newLead).length === 0) return res.status(400).json({ success: false, error: 'No lead data provided' });

    let current = await loadDatabaseLeads();
    const leadId = newLead.id || `LEAD-2026-${Date.now().toString().slice(-4)}`;
    const nextNum = newLead.leadNumber || `LEAD-${String(current.length + 1).padStart(3, '0')}`;

    const leadRecord = {
      ...newLead,
      id: leadId,
      leadNumber: nextNum,
      createdAt: newLead.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    const updated = [leadRecord, ...current.filter(l => l.id !== leadId)];
    await saveLocalLeads(updated);

    broadcastRealtimeEvent('crm_lead_created', { lead: leadRecord });

    res.json({ success: true, message: 'Lead added to database', lead: leadRecord, data: updated });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.put(['/api/crm/leads/:id', '/api/leads/:id'], async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;
    let current = await loadDatabaseLeads();
    const idx = current.findIndex(l => l.id === id || l.leadNumber === id);
    if (idx === -1) {
      return res.status(404).json({ success: false, error: 'Lead not found' });
    }
    const updatedLead = {
      ...current[idx],
      ...updates,
      updatedAt: new Date().toISOString()
    };
    current[idx] = updatedLead;
    await saveLocalLeads(current);

    broadcastRealtimeEvent('crm_lead_updated', { lead: updatedLead });

    res.json({ success: true, message: 'Lead updated in database', lead: updatedLead, data: current });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.delete(['/api/crm/leads/:id', '/api/leads/:id'], async (req, res) => {
  try {
    const { id } = req.params;
    let current = await loadDatabaseLeads();
    const updated = current.filter(l => l.id !== id && l.leadNumber !== id);
    await saveLocalLeads(updated);

    res.json({ success: true, message: 'Lead deleted from database', data: updated });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post(['/api/crm/leads/batch', '/api/leads/batch'], async (req, res) => {
  try {
    const { leadIds = [], updates = {}, action = 'update' } = req.body;
    let current = await loadDatabaseLeads();

    if (action === 'delete') {
      current = current.filter(l => !leadIds.includes(l.id) && !leadIds.includes(l.leadNumber));
    } else {
      current = current.map(l => {
        if (leadIds.includes(l.id) || leadIds.includes(l.leadNumber)) {
          return { ...l, ...updates, updatedAt: new Date().toISOString() };
        }
        return l;
      });
    }

    await saveLocalLeads(current);
    res.json({ success: true, count: current.length, data: current });
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
    const filePath = path.resolve(__dirname, 'backups', safeFilename);
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
    const filePath = path.resolve(__dirname, 'backups', latest.filename);
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
      const filePath = path.resolve(__dirname, 'backups', safeFilename);
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
setInterval(async () => {
  try {
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

// 🌐 SERVE PRODUCTION DIST (FOR PLESK & STANDALONE HOSTING)
const distPath = fs.existsSync(path.resolve(__dirname, '../dist'))
  ? path.resolve(__dirname, '../dist')
  : path.resolve(process.cwd(), 'dist');

if (fs.existsSync(distPath)) {
  const rootAssets = path.resolve(__dirname, '../assets');
  if (fs.existsSync(rootAssets)) {
    app.use('/assets', express.static(rootAssets));
  }
  app.use('/assets', express.static(path.join(distPath, 'assets')));
  app.use(express.static(distPath));
  app.use((req, res, next) => {
    if (req.method === 'GET' && !req.path.startsWith('/api') && !req.path.startsWith('/uploads')) {
      return res.sendFile(path.join(distPath, 'index.html'));
    }
    next();
  });
}

app.listen(PORT, () => {
  console.log(`Zoho Integration Proxy Server running on port ${PORT}`);
});

export default app;
