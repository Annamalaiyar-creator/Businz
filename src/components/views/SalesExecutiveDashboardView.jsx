import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import {
  ArrowUpRight, ArrowDownRight, Clock, Sparkles, RefreshCw,
  Edit3, X, Check, Eye, ArrowUpDown, Plus, CheckCircle, CheckCircle2, Flame, ArrowRight, Target,
  TrendingUp, MapPin, Users, Receipt, Factory, ShoppingCart, Truck, FileCheck, Wallet,
  FileSpreadsheet, DollarSign, Building2, Award, UserCheck, Package
} from 'lucide-react';
import { fetchCloudStore } from '../../utils/supabaseDataSync';
import { fetchWithTimeout } from '../../utils/fetchWithTimeout';
import { fetchCustomersDeduplicated } from '../../services/customerService';
import { CeoKpiGrid } from './CeoExecutiveDashboardView';

// Fast shallow list equality check to prevent unnecessary React re-renders and visual data flickering
function areItemListsEqual(prev, next, idKey = 'id') {
  if (prev === next) return true;
  if (!Array.isArray(prev) || !Array.isArray(next)) return false;
  if (prev.length !== next.length) return false;
  for (let i = 0; i < prev.length; i++) {
    const a = prev[i];
    const b = next[i];
    if (a === b) continue;
    if (!a || !b) return false;
    const idA = a[idKey] || a.invNo || a.piNo || a.bomCode || a.code || a.customerCode || a.quoteNumber;
    const idB = b[idKey] || b.invNo || b.piNo || b.bomCode || b.code || b.customerCode || b.quoteNumber;
    if (idA !== idB) return false;
    if ((a.updatedAt || a.date || a.status || a.dealValue || a.total || a.grandTotal || a.amount) !==
        (b.updatedAt || b.date || b.status || b.dealValue || b.total || b.grandTotal || b.amount)) {
      return false;
    }
  }
  return true;
}

// Safe numeric amount parser
function parseAmt(val) {
  if (typeof val === 'number') return isNaN(val) ? 0 : val;
  if (!val) return 0;
  const str = String(val).trim();
  if (str.includes('Cr')) {
    const num = parseFloat(str.replace(/[^0-9.]/g, '')) || 0;
    return num * 10000000;
  }
  if (str.includes('L') || str.includes('Lakh')) {
    const num = parseFloat(str.replace(/[^0-9.]/g, '')) || 0;
    return num * 100000;
  }
  const clean = str.replace(/[^0-9.]/g, '');
  return parseFloat(clean) || 0;
}

// Indian Lakhs and Crores formatter
function formatLakhsCr(amt) {
  const num = Number(amt) || 0;
  if (num >= 10000000) {
    return `₹ ${(num / 10000000).toFixed(2)} Cr`;
  }
  if (num >= 100000) {
    return `₹ ${(num / 100000).toFixed(1)} L`;
  }
  if (num === 0) return '₹ 0.00';
  return `₹ ${Math.round(num).toLocaleString('en-IN')}`;
}

// Helper to determine if a date falls in the selected period
function isDateInPeriod(dateVal, period) {
  if (period === 'All Time') return true;
  if (!dateVal) return true;
  const d = new Date(dateVal);
  if (isNaN(d.getTime())) return true;
  const now = new Date();

  if (period === 'This Month') {
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  }
  if (period === 'Last Month') {
    const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    return d.getMonth() === lastMonth.getMonth() && d.getFullYear() === lastMonth.getFullYear();
  }
  if (period === 'This Quarter') {
    const currentQuarter = Math.floor(now.getMonth() / 3);
    const dateQuarter = Math.floor(d.getMonth() / 3);
    return currentQuarter === dateQuarter && d.getFullYear() === now.getFullYear();
  }
  if (period === 'Financial Year (YTD)') {
    const fyStartYear = now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1;
    const fyStartDate = new Date(fyStartYear, 3, 1);
    return d >= fyStartDate && d <= now;
  }
  return true;
}

// Categorize items by product line
function categorizeProduct(item) {
  const text = `${item.name || ''} ${item.description || ''} ${item.code || ''} ${item.category || ''} ${item.structure || ''} ${item.productCategory || ''} ${item.module || ''}`.toLowerCase();
  if (text.includes('panel') || text.includes('module') || text.includes('solar panel') || text.includes('pv')) {
    return 'Solar Panels / Modules';
  }
  if (text.includes('profile') || text.includes('aluminium') || text.includes('channel') || text.includes('extrusion') || text.includes('rail')) {
    return 'Aluminium Profiles';
  }
  if (text.includes('bos') || text.includes('fastener') || text.includes('bolt') || text.includes('nut') || text.includes('hardware') || text.includes('kit')) {
    return 'BOS Kits';
  }
  if (text.includes('walkway') || text.includes('handrail') || text.includes('grating') || text.includes('ladder')) {
    return 'Walkway / Handrail';
  }
  if (text.includes('clamp') || text.includes('accessory') || text.includes('bracket') || text.includes('cable') || text.includes('tie') || text.includes('earthing')) {
    return 'Accessories';
  }
  return 'Solar Structures';
}

// Indian GST 2-digit state code mapping
const GST_STATE_MAP = {
  '33': 'Tamil Nadu', '37': 'Andhra Pradesh', '28': 'Andhra Pradesh', '36': 'Telangana',
  '32': 'Kerala', '29': 'Karnataka', '27': 'Maharashtra', '24': 'Gujarat',
  '07': 'Delhi', '08': 'Rajasthan', '09': 'Uttar Pradesh', '19': 'West Bengal',
  '23': 'Madhya Pradesh', '06': 'Haryana', '03': 'Punjab', '34': 'Puducherry',
  '21': 'Odisha', '10': 'Bihar', '02': 'Himachal Pradesh', '01': 'Jammu and Kashmir',
  '12': 'Arunachal Pradesh', '18': 'Assam', '16': 'Tripura', '14': 'Manipur',
  '17': 'Meghalaya', '15': 'Mizoram', '13': 'Nagaland', '11': 'Sikkim',
  '22': 'Chhattisgarh', '20': 'Jharkhand', '30': 'Goa', '04': 'Chandigarh',
  '31': 'Lakshadweep', '35': 'Andaman and Nicobar', '26': 'Dadra and Nagar Haveli and Daman and Diu',
  '38': 'Ladakh'
};

function normalizeRegionName(raw) {
  const s = String(raw || '').toLowerCase();
  if (s.includes('tamil') || s.includes('tn') || s.includes('chennai') || s.includes('coimbatore') || s.includes('madurai') || s.includes('salem') || s.includes('trichy') || s.includes('hosur') || s.includes('tirupur') || s.includes('erode') || s.includes('vellore') || s.includes('kanchipuram')) return 'Tamil Nadu';
  if (s.includes('andhra') || s.includes('ap') || s.includes('visakhapatnam') || s.includes('vijayawada') || s.includes('tirupati') || s.includes('guntur') || s.includes('nellore') || s.includes('kurnool')) return 'Andhra Pradesh';
  if (s.includes('telangana') || s.includes('ts') || s.includes('hyderabad') || s.includes('warangal') || s.includes('secunderabad') || s.includes('karimnagar') || s.includes('nizamabad')) return 'Telangana';
  if (s.includes('kerala') || s.includes('kl') || s.includes('kochi') || s.includes('thiruvananthapuram') || s.includes('calicut') || s.includes('cochin') || s.includes('thrissur') || s.includes('kannur') || s.includes('kollam') || s.includes('palakkad')) return 'Kerala';
  if (s.includes('karnataka') || s.includes('ka') || s.includes('bangalore') || s.includes('bengaluru') || s.includes('mysore') || s.includes('mysuru') || s.includes('hubli') || s.includes('mangalore') || s.includes('belgaum')) return 'Karnataka';
  return 'Other States';
}

function resolveOrderState(order, custMap) {
  if (!order) return 'Other States';

  // 1. Direct state properties
  const directState = order.state || order.placeOfSupply || order.deliveryState;
  if (directState && typeof directState === 'string' && directState.trim()) {
    const match = normalizeRegionName(directState);
    if (match !== 'Other States') return match;
  }

  // 2. GST number prefix (first 2 digits)
  const gstin = String(order.gstNo || order.gstin || order.gstNumber || '').trim().toUpperCase();
  if (gstin.length >= 2 && GST_STATE_MAP[gstin.substring(0, 2)]) {
    return normalizeRegionName(GST_STATE_MAP[gstin.substring(0, 2)]);
  }

  // 3. Object-based addresses (billingAddressObj, deliveryAddressObj)
  const objList = [
    order.billingAddressObj,
    order.deliveryAddressObj,
    typeof order.billingAddress === 'object' ? order.billingAddress : null,
    typeof order.deliveryAddress === 'object' ? order.deliveryAddress : null
  ];
  for (const obj of objList) {
    if (obj && typeof obj === 'object') {
      for (const f of [obj.state, obj.city, obj.street]) {
        if (f) {
          const match = normalizeRegionName(f);
          if (match !== 'Other States') return match;
        }
      }
    }
  }

  // 4. String-based addresses (billingAddress, deliveryAddress, destination)
  const strList = [
    typeof order.billingAddress === 'string' ? order.billingAddress : '',
    typeof order.deliveryAddress === 'string' ? order.deliveryAddress : '',
    typeof order.destination === 'string' ? order.destination : ''
  ];
  for (const s of strList) {
    if (s) {
      const match = normalizeRegionName(s);
      if (match !== 'Other States') return match;
    }
  }

  // 5. Customer store lookup
  const custName = (order.customerName || order.companyName || order.customer || order.vendor || '').toLowerCase().trim();
  if (custName && custMap) {
    const c = custMap.get(custName);
    if (c) {
      if (c.state) {
        const match = normalizeRegionName(c.state);
        if (match !== 'Other States') return match;
      }
      const cGst = String(c.gstin || c.gstNo || '').trim().toUpperCase();
      if (cGst.length >= 2 && GST_STATE_MAP[cGst.substring(0, 2)]) {
        return normalizeRegionName(GST_STATE_MAP[cGst.substring(0, 2)]);
      }
      const cAddr = typeof c.billing_address === 'string' ? c.billing_address : (c.address || '');
      if (cAddr) {
        const match = normalizeRegionName(cAddr);
        if (match !== 'Other States') return match;
      }
    }
  }

  return 'Other States';
}

export default function SalesExecutiveDashboardView({ userRole = 'Sales Executive', onNavigateTab }) {
  const getCached = (key) => {
    try {
      const val = localStorage.getItem(key);
      return val ? JSON.parse(val) : [];
    } catch { return []; }
  };

  const isCeoOrMd = userRole === 'CEO' || userRole === 'MD' || userRole === 'Managing Director' || userRole === 'Technical Administrator' || userRole === 'Super Admin' || userRole === 'Admin';
  const isManagementRole = userRole === 'Sales Head' || userRole === 'Management' || isCeoOrMd;
  const loggedUserName = (() => {
    if (typeof localStorage === 'undefined') return userRole || 'Sales Executive';
    const stored = localStorage.getItem('controlroom_logged_user_name');
    if (stored && stored.trim() && stored !== 'undefined' && stored !== 'null' && stored.toLowerCase() !== 'vijay') {
      return stored.trim();
    }
    try {
      const emps = JSON.parse(localStorage.getItem('controlroom_employees_list') || '[]');
      const cloudEmps = JSON.parse(localStorage.getItem('controlroom_employees_store') || '[]');
      const allEmps = [...(Array.isArray(emps) ? emps : []), ...(Array.isArray(cloudEmps) ? cloudEmps : [])];
      const match = allEmps.find(e => e && e.role === userRole && e.employee_name && e.employee_name.toLowerCase() !== 'vijay');
      if (match && (match.employee_name || match.name)) {
        return match.employee_name || match.name;
      }
    } catch (_) {}
    if (stored && stored.trim() && stored !== 'undefined' && stored !== 'null') {
      return stored.trim();
    }
    return userRole === 'Sales Head' ? 'Sales Head' : 'Mohit JV';
  })();

  // Dynamic mobile viewport detection (<= 768px)
  const [isMobile, setIsMobile] = useState(() => {
    if (typeof window === 'undefined') return false;
    return window.innerWidth <= 768 || (window.matchMedia && window.matchMedia('(max-width: 768px)').matches);
  });

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const mediaQuery = window.matchMedia ? window.matchMedia('(max-width: 768px)') : null;
    const updateMobile = () => {
      setIsMobile((mediaQuery && mediaQuery.matches) || window.innerWidth <= 768);
    };
    if (mediaQuery) {
      if (mediaQuery.addEventListener) mediaQuery.addEventListener('change', updateMobile);
      else if (mediaQuery.addListener) mediaQuery.addListener(updateMobile);
    }
    window.addEventListener('resize', updateMobile);
    return () => {
      if (mediaQuery) {
        if (mediaQuery.removeEventListener) mediaQuery.removeEventListener('change', updateMobile);
        else if (mediaQuery.removeListener) mediaQuery.removeListener(updateMobile);
      }
      window.removeEventListener('resize', updateMobile);
    };
  }, []);

  // CEO Target State
  const getCachedObj = (key, fallback = {}) => {
    try {
      const val = localStorage.getItem(key);
      return val ? JSON.parse(val) : fallback;
    } catch { return fallback; }
  };

  const [ceoTargetStore, setCeoTargetStore] = useState(() => getCachedObj('controlroom_ceo_target_store', {
    monthlyCompanyTarget: 18000000,
    repTargets: {
      'All': 18000000,
      'Mohith JV': 18000000,
      'Mohith J V': 18000000
    }
  }));

  const [showTargetModal, setShowTargetModal] = useState(false);
  const [targetModalRep, setTargetModalRep] = useState('All');
  const [targetModalValue, setTargetModalValue] = useState('18000000');
  const [isSavingTarget, setIsSavingTarget] = useState(false);

  // Live Collection States (hydrated immediately from local cache with zero delay)
  const [quotations, setQuotations] = useState(() => getCached('controlroom_crm_quotations'));
  const [opportunities, setOpportunities] = useState(() => getCached('controlroom_crm_opportunities'));
  const [leads, setLeads] = useState(() => getCached('controlroom_crm_leads'));
  const [followups, setFollowups] = useState(() => getCached('controlroom_crm_followups'));
  const [proformaInvoices, setProformaInvoices] = useState(() => getCached('controlroom_sales_pi_store'));
  const [invoices, setInvoices] = useState(() => getCached('controlroom_invoice_store'));
  const [customers, setCustomers] = useState(() => getCached('controlroom_customer_store'));
  const [boms, setBoms] = useState(() => getCached('controlroom_bom_store'));
  const [purchaseOrders, setPurchaseOrders] = useState(() => getCached('po_store') || getCached('controlroom_po_store') || []);
  const [dispatches, setDispatches] = useState(() => getCached('dispatch_orders') || getCached('dispatch_store') || getCached('controlroom_dispatch_orders') || []);
  const [payments, setPayments] = useState(() => getCached('payment_store') || getCached('controlroom_payments_store') || []);
  const [isCloudConnected, setIsCloudConnected] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastSyncedTime, setLastSyncedTime] = useState(new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }));

  // Filter States: Executive view defaults to logged user; management sees All
  const [selectedExecutive, setSelectedExecutive] = useState(isManagementRole ? 'All' : loggedUserName);
  const [selectedPeriod, setSelectedPeriod] = useState('This Month');

  // Table interactive selection states
  const [selectedFollowups, setSelectedFollowups] = useState([]);
  const [followupPage, setFollowupPage] = useState(1);
  const [followupRowsPerPage, setFollowupRowsPerPage] = useState(5);
  const [followupGoTo, setFollowupGoTo] = useState('');

  // Outstanding table pagination
  const [outstandingPage, setOutstandingPage] = useState(1);
  const [outstandingRowsPerPage, setOutstandingRowsPerPage] = useState(5);

  // Hover states
  const [hoveredTrendMonth, setHoveredTrendMonth] = useState(null);

  // Concurrency guard to prevent racing requests
  const isFetchingRef = useRef(false);

  // Authoritative real-time data loader
  const loadSalesData = useCallback(async () => {
    if (isFetchingRef.current) return;
    isFetchingRef.current = true;
    try {
      // 1. Fetch connection status
      fetchWithTimeout('/api/health', { timeout: 3000 })
        .then(r => r.json())
        .then(st => {
          if (st && st.connected !== undefined) setIsCloudConnected(Boolean(st.connected));
        })
        .catch(() => setIsCloudConnected(true));

      // 2. Fetch all collections in parallel from authoritative cloud stores with timeout protection
      const [
        cloudQuotes,
        cloudOpps,
        cloudLeads,
        cloudFollowups,
        cloudSalesPis,
        cloudProformaPis,
        cloudInvoices,
        cloudCustomers,
        liveBoms,
        cloudPos,
        cloudDispatches,
        cloudPayments
      ] = await Promise.all([
        fetchCloudStore('crm_quotations', []).catch(() => []),
        fetchCloudStore('crm_opportunities', []).catch(() => []),
        fetchCloudStore('crm_leads', []).catch(() => []),
        fetchCloudStore('crm_followups', []).catch(() => []),
        fetchCloudStore('sales_pi_store', []).catch(() => []),
        fetchCloudStore('proforma_invoice_store', []).catch(() => []),
        fetchWithTimeout('/api/invoices', { timeout: 8000 })
          .then(r => r.json())
          .then(j => {
            if (Array.isArray(j)) return j;
            if (Array.isArray(j?.data)) return j.data;
            if (j && typeof j === 'object' && (j.id || j.invNo)) return [j];
            return [];
          })
          .catch(() => fetchCloudStore('invoice_store', [])),
        fetchCustomersDeduplicated('/api/customers')
          .then(j => Array.isArray(j) ? j : (Array.isArray(j?.data) ? j.data : []))
          .catch(() => fetchCloudStore('customer_store', [])),
        fetchWithTimeout('/api/boms', { timeout: 5000 })
          .then(r => r.json())
          .then(j => Array.isArray(j?.data) ? j.data : (Array.isArray(j) ? j : []))
          .catch(() => []),
        fetchWithTimeout('/api/purchaseorders', { timeout: 5000 })
          .then(r => r.json())
          .catch(() => fetchCloudStore('po_store', [])),
        fetchCloudStore('dispatch_orders', []).catch(() => fetchCloudStore('dispatch_store', [])).catch(() => []),
        fetchCloudStore('payment_store', []).catch(() => [])
      ]);

      // 3. Merge with local storage caches for zero-data-loss protection
      const getCached = (key) => {
        try {
          const val = localStorage.getItem(key);
          return val ? JSON.parse(val) : null;
        } catch { return null; }
      };

      // Merge Quotations
      const localQuotes = getCached('controlroom_crm_quotations') || getCached('quotations_store') || [];
      const quoteMap = new Map();
      (Array.isArray(cloudQuotes) ? cloudQuotes : []).forEach(q => {
        const id = q.quoteNumber || q.id || q.code;
        if (id) quoteMap.set(String(id).trim().toLowerCase(), q);
      });
      (Array.isArray(localQuotes) ? localQuotes : []).forEach(q => {
        const id = q.quoteNumber || q.id || q.code;
        if (id && !quoteMap.has(String(id).trim().toLowerCase())) {
          quoteMap.set(String(id).trim().toLowerCase(), q);
        }
      });
      const unifiedQuotes = Array.from(quoteMap.values());
      setQuotations(prev => (unifiedQuotes.length === 0 && prev.length > 0) ? prev : (areItemListsEqual(prev, unifiedQuotes) ? prev : unifiedQuotes));

      // Merge Opportunities
      const localOpps = getCached('controlroom_crm_opportunities') || [];
      const oppMap = new Map();
      (Array.isArray(cloudOpps) ? cloudOpps : []).forEach(o => {
        const id = o.oppNumber || o.id;
        if (id) oppMap.set(String(id).trim().toLowerCase(), o);
      });
      (Array.isArray(localOpps) ? localOpps : []).forEach(o => {
        const id = o.oppNumber || o.id;
        if (id && !oppMap.has(String(id).trim().toLowerCase())) {
          oppMap.set(String(id).trim().toLowerCase(), o);
        }
      });
      const unifiedOpps = Array.from(oppMap.values());
      setOpportunities(prev => (unifiedOpps.length === 0 && prev.length > 0) ? prev : (areItemListsEqual(prev, unifiedOpps) ? prev : unifiedOpps));

      // Merge Leads
      const localLeads = getCached('controlroom_crm_leads') || [];
      const leadMap = new Map();
      (Array.isArray(cloudLeads) ? cloudLeads : []).forEach(l => {
        const id = l.leadNumber || l.id;
        if (id) leadMap.set(String(id).trim().toLowerCase(), l);
      });
      (Array.isArray(localLeads) ? localLeads : []).forEach(l => {
        const id = l.leadNumber || l.id;
        if (id && !leadMap.has(String(id).trim().toLowerCase())) {
          leadMap.set(String(id).trim().toLowerCase(), l);
        }
      });
      const unifiedLeads = Array.from(leadMap.values());
      setLeads(prev => (unifiedLeads.length === 0 && prev.length > 0) ? prev : (areItemListsEqual(prev, unifiedLeads) ? prev : unifiedLeads));

      // Merge Followups
      const localFollowups = getCached('controlroom_crm_followups') || [];
      const followupMap = new Map();
      (Array.isArray(cloudFollowups) ? cloudFollowups : []).forEach(f => {
        const id = f.id;
        if (id) followupMap.set(String(id).trim().toLowerCase(), f);
      });
      (Array.isArray(localFollowups) ? localFollowups : []).forEach(f => {
        const id = f.id;
        if (id && !followupMap.has(String(id).trim().toLowerCase())) {
          followupMap.set(String(id).trim().toLowerCase(), f);
        }
      });
      const unifiedFollowups = Array.from(followupMap.values());
      setFollowups(prev => (unifiedFollowups.length === 0 && prev.length > 0) ? prev : (areItemListsEqual(prev, unifiedFollowups) ? prev : unifiedFollowups));

      // Merge Proforma Invoices (sales_pi_store & proforma_invoice_store)
      const localPis = getCached('controlroom_sales_pi_store') || getCached('sales_pi_store') || getCached('proforma_invoice_store') || [];
      const piMap = new Map();
      [...(Array.isArray(cloudSalesPis) ? cloudSalesPis : []), ...(Array.isArray(cloudProformaPis) ? cloudProformaPis : []), ...(Array.isArray(localPis) ? localPis : [])].forEach(p => {
        const id = p?.piNo || p?.id || p?.estimate_number;
        if (id) {
          const k = String(id).trim().toLowerCase();
          if (!piMap.has(k)) piMap.set(k, p);
        }
      });
      const unifiedPis = Array.from(piMap.values());
      setProformaInvoices(prev => (unifiedPis.length === 0 && prev.length > 0) ? prev : (areItemListsEqual(prev, unifiedPis) ? prev : unifiedPis));

      // Merge Invoices
      const localInvoices = getCached('controlroom_invoice_store') || [];
      const invMap = new Map();
      [...(Array.isArray(cloudInvoices) ? cloudInvoices : []), ...(Array.isArray(localInvoices) ? localInvoices : [])].forEach(inv => {
        const id = inv?.invNo || inv?.invoiceNo || inv?.invoiceNumber || inv?.id;
        if (id) {
          const k = String(id).trim().toLowerCase();
          if (!invMap.has(k)) invMap.set(k, inv);
        }
      });
      const unifiedInvoices = Array.from(invMap.values());
      setInvoices(prev => (unifiedInvoices.length === 0 && prev.length > 0) ? prev : (areItemListsEqual(prev, unifiedInvoices) ? prev : unifiedInvoices));

      // Merge Customers
      const localCustomers = getCached('controlroom_customer_store') || getCached('controlroom_crm_customers') || [];
      const custMap = new Map();
      [...(Array.isArray(cloudCustomers) ? cloudCustomers : []), ...(Array.isArray(localCustomers) ? localCustomers : [])].forEach(c => {
        const id = c?.customerCode || c?.id || c?.customerName;
        if (id) {
          const k = String(id).trim().toLowerCase();
          if (!custMap.has(k)) custMap.set(k, c);
        }
      });
      const unifiedCustomers = Array.from(custMap.values());
      setCustomers(prev => (unifiedCustomers.length === 0 && prev.length > 0) ? prev : (areItemListsEqual(prev, unifiedCustomers) ? prev : unifiedCustomers));

      // BOMs
      const localBoms = getCached('controlroom_bom_store') || [];
      const bomMap = new Map();
      [...(Array.isArray(liveBoms) ? liveBoms : []), ...(Array.isArray(localBoms) ? localBoms : [])].forEach(b => {
        const id = b?.bomCode || b?.code || b?.id;
        if (id) {
          const k = String(id).trim().toLowerCase();
          if (!bomMap.has(k)) bomMap.set(k, b);
        }
      });
      const unifiedBoms = Array.from(bomMap.values());
      setBoms(prev => (unifiedBoms.length === 0 && prev.length > 0) ? prev : (areItemListsEqual(prev, unifiedBoms) ? prev : unifiedBoms));

      // Purchase Orders
      const localPos = getCached('po_store') || getCached('controlroom_po_store') || [];
      const poMap = new Map();
      [...(Array.isArray(cloudPos) ? cloudPos : []), ...(Array.isArray(localPos) ? localPos : [])].forEach(po => {
        const id = po?.poNumber || po?.poNo || po?.id;
        if (id) {
          const k = String(id).trim().toLowerCase();
          if (!poMap.has(k)) poMap.set(k, po);
        }
      });
      const unifiedPos = Array.from(poMap.values());
      setPurchaseOrders(prev => (unifiedPos.length === 0 && prev.length > 0) ? prev : unifiedPos);

      // Dispatches
      const localDispatches = getCached('dispatch_orders') || getCached('dispatch_store') || getCached('controlroom_dispatch_orders') || [];
      const dispMap = new Map();
      [...(Array.isArray(cloudDispatches) ? cloudDispatches : []), ...(Array.isArray(localDispatches) ? localDispatches : [])].forEach(d => {
        const id = d?.dispatchNo || d?.orderNo || d?.id;
        if (id) {
          const k = String(id).trim().toLowerCase();
          if (!dispMap.has(k)) dispMap.set(k, d);
        }
      });
      const unifiedDispatches = Array.from(dispMap.values());
      setDispatches(prev => (unifiedDispatches.length === 0 && prev.length > 0) ? prev : unifiedDispatches);

      // Payments
      const localPayments = getCached('payment_store') || getCached('controlroom_payments_store') || [];
      const payMap = new Map();
      [...(Array.isArray(cloudPayments) ? cloudPayments : []), ...(Array.isArray(localPayments) ? localPayments : [])].forEach(p => {
        const id = p?.paymentId || p?.receiptNo || p?.id;
        if (id) {
          const k = String(id).trim().toLowerCase();
          if (!payMap.has(k)) payMap.set(k, p);
        }
      });
      const unifiedPayments = Array.from(payMap.values());
      setPayments(prev => (unifiedPayments.length === 0 && prev.length > 0) ? prev : unifiedPayments);

      setLastSyncedTime(new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }));
    } catch (err) {
      console.error('[SalesExecutiveDashboard] Error loading live sales data:', err);
    } finally {
      setIsRefreshing(false);
      isFetchingRef.current = false;
    }
  }, []);

  // Initial load and live real-time auto-synchronization (with debounced burst protection)
  useEffect(() => {
    loadSalesData();

    let debounceTimer = null;
    const handleSync = () => {
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        loadSalesData();
      }, 600);
    };

    // Also sync CEO targets from backend store
    fetchWithTimeout('/api/store/ceo_target_store', { timeout: 3000 })
      .then(r => r.json())
      .then(res => {
        if (res?.data && typeof res.data === 'object' && !Array.isArray(res.data) && Object.keys(res.data).length > 0) {
          setCeoTargetStore(res.data);
          try { localStorage.setItem('controlroom_ceo_target_store', JSON.stringify(res.data)); } catch (_) {}
        }
      })
      .catch(() => {});

    window.addEventListener('controlroom_storage_update', handleSync);
    window.addEventListener('controlroom_crm_updated', handleSync);
    window.addEventListener('controlroom_pi_updated', handleSync);
    window.addEventListener('controlroom_invoice_updated', handleSync);
    window.addEventListener('controlroom_bom_store_updated', handleSync);
    window.addEventListener('storage', handleSync);

    const handleTargetUpdated = (e) => {
      if (e?.detail && typeof e.detail === 'object') {
        setCeoTargetStore(e.detail);
      }
    };
    window.addEventListener('controlroom_ceo_targets_updated', handleTargetUpdated);

    return () => {
      clearTimeout(debounceTimer);
      window.removeEventListener('controlroom_storage_update', handleSync);
      window.removeEventListener('controlroom_crm_updated', handleSync);
      window.removeEventListener('controlroom_pi_updated', handleSync);
      window.removeEventListener('controlroom_invoice_updated', handleSync);
      window.removeEventListener('controlroom_bom_store_updated', handleSync);
      window.removeEventListener('storage', handleSync);
      window.removeEventListener('controlroom_ceo_targets_updated', handleTargetUpdated);
    };
  }, [loadSalesData]);

  // Handler for CEO / MD to save monthly targets directly
  const handleSaveCeoTarget = async (rep, amountNum) => {
    setIsSavingTarget(true);
    try {
      const updatedRepTargets = {
        ...(ceoTargetStore?.repTargets || {}),
        [rep]: amountNum
      };
      if (rep === 'All') {
        updatedRepTargets['All'] = amountNum;
      }
      const updatedStore = {
        ...(ceoTargetStore || {}),
        monthlyCompanyTarget: rep === 'All' ? amountNum : (ceoTargetStore?.monthlyCompanyTarget || 18000000),
        repTargets: updatedRepTargets,
        updatedAt: new Date().toISOString(),
        updatedBy: userRole || 'CEO'
      };

      setCeoTargetStore(updatedStore);
      try {
        localStorage.setItem('controlroom_ceo_target_store', JSON.stringify(updatedStore));
      } catch (_) {}

      // Broadcast event so CEO dashboard & open tabs update immediately
      window.dispatchEvent(new CustomEvent('controlroom_ceo_targets_updated', {
        detail: updatedStore
      }));

      // Persist to server backend storage
      await fetch('/api/store/ceo_target_store', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updatedStore)
      }).catch(err => console.warn('Could not post to /api/store/ceo_target_store:', err));

      setShowTargetModal(false);
    } catch (e) {
      console.error('Error saving CEO target:', e);
    } finally {
      setIsSavingTarget(false);
    }
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await loadSalesData();
  };

  // Extract distinct dynamic list of sales executives from real data
  const availableExecutives = useMemo(() => {
    const names = new Set();
    const addName = (n) => {
      if (n && typeof n === 'string' && n.trim() && n.trim() !== '—' && n.trim() !== 'Customer' && n.trim() !== 'Sales Rep') {
        names.add(n.trim());
      }
    };
    opportunities.forEach(o => addName(o.assignedSalesperson || o.salesperson));
    quotations.forEach(q => addName(q.salesperson || q.salesRep || q.salesPerson));
    proformaInvoices.forEach(p => addName(p.salesPerson || p.salesPersonName));
    customers.forEach(c => addName(c.assignedSalesperson || c.salesPerson));

    const loggedName = localStorage.getItem('controlroom_logged_user_name');
    if (loggedName) addName(loggedName);

    // Default core reps if dataset is empty
    if (names.size === 0) {
      addName('Mohith J V');
      if (loggedName) addName(loggedName);
      addName('Sanjai Kumar');
      addName('Kalaiselvi T');
    }

    return ['All', ...Array.from(names)];
  }, [opportunities, quotations, proformaInvoices, customers]);

  // Executive matching filter helper
  const matchesExecutive = useCallback((repName) => {
    if (selectedExecutive === 'All') return true;
    if (!repName) return false;
    const target = selectedExecutive.toLowerCase().trim();
    const cur = String(repName).toLowerCase().trim();
    return cur.includes(target) || target.includes(cur);
  }, [selectedExecutive]);

  // Filtered collections by Executive and Period
  const filteredQuotations = useMemo(() => {
    return quotations.filter(q => {
      const rep = q.salesperson || q.salesRep || q.salesPerson || '';
      if (!matchesExecutive(rep)) return false;
      const d = q.date || q.createdAt;
      return isDateInPeriod(d, selectedPeriod);
    });
  }, [quotations, matchesExecutive, selectedPeriod]);

  const filteredOpportunities = useMemo(() => {
    return opportunities.filter(o => {
      const rep = o.assignedSalesperson || o.salesperson || '';
      if (!matchesExecutive(rep)) return false;
      const d = o.createdAt || o.targetCloseDate || o.expectedClosingDate;
      return isDateInPeriod(d, selectedPeriod);
    });
  }, [opportunities, matchesExecutive, selectedPeriod]);

  const filteredPis = useMemo(() => {
    return proformaInvoices.filter(p => {
      const rep = p.salesPerson || p.salesPersonName || '';
      if (!matchesExecutive(rep)) return false;
      const d = p.date || p.piDate || p.createdAt;
      return isDateInPeriod(d, selectedPeriod);
    });
  }, [proformaInvoices, matchesExecutive, selectedPeriod]);

  const filteredInvoices = useMemo(() => {
    return invoices.filter(inv => {
      const d = inv.date || inv.invoiceDate || inv.createdAt;
      return isDateInPeriod(d, selectedPeriod);
    });
  }, [invoices, selectedPeriod]);

  const filteredLeads = useMemo(() => {
    return leads.filter(l => {
      const rep = l.assignedSalesperson || '';
      if (!matchesExecutive(rep)) return false;
      const d = l.createdAt;
      return isDateInPeriod(d, selectedPeriod);
    });
  }, [leads, matchesExecutive, selectedPeriod]);

  const filteredBoms = useMemo(() => {
    return boms.filter(b => {
      const rep = b.salesPerson || b.salesPersonName || b.c3 || '';
      if (!matchesExecutive(rep)) return false;
      const d = b.date || b.bomDate || b.createdAt;
      return isDateInPeriod(d, selectedPeriod);
    });
  }, [boms, matchesExecutive, selectedPeriod]);

  const filteredPos = useMemo(() => {
    return purchaseOrders.filter(po => {
      const d = po.date || po.poDate || po.createdAt;
      return isDateInPeriod(d, selectedPeriod);
    });
  }, [purchaseOrders, selectedPeriod]);

  const filteredDispatches = useMemo(() => {
    return dispatches.filter(disp => {
      const d = disp.date || disp.dispatchDate || disp.createdAt;
      return isDateInPeriod(d, selectedPeriod);
    });
  }, [dispatches, selectedPeriod]);

  const filteredCustomers = useMemo(() => {
    return customers.filter(c => {
      const rep = c.assignedSalesperson || c.salesPerson || '';
      if (!matchesExecutive(rep)) return false;
      return true;
    });
  }, [customers, matchesExecutive]);

  // Computed Real KPIs
  const totalQuotesValue = useMemo(() => {
    return filteredQuotations.reduce((sum, q) => sum + parseAmt(q.grandTotal || q.total || q.amount || q.subtotal), 0);
  }, [filteredQuotations]);

  const totalPiValue = useMemo(() => {
    return filteredPis.reduce((sum, p) => sum + parseAmt(p.total || p.grandTotal || p.invAmt || p.amount), 0);
  }, [filteredPis]);

  const totalBomOrderValue = useMemo(() => {
    return filteredBoms
      .filter(b => b && !b.cancelled && !String(b.status || '').toLowerCase().includes('cancel'))
      .reduce((sum, b) => sum + parseAmt(b.grandTotal || b.totalAmount || b.amount || b.value || 0), 0);
  }, [filteredBoms]);

  const totalPoSpend = useMemo(() => {
    return filteredPos.reduce((sum, po) => sum + parseAmt(po.amount || po.total), 0);
  }, [filteredPos]);

  const pendingMdPOs = useMemo(() => {
    return filteredPos.filter(po => {
      const stage = String(po.stage || po.status || po.statusType || '').toLowerCase();
      return stage.includes('draft') || stage.includes('pending') || stage.includes('approval');
    });
  }, [filteredPos]);

  const completedDispatchesCount = useMemo(() => {
    const completedBoms = filteredBoms.filter(b => {
      if (!b || b.cancelled) return false;
      const st = String(b.status || '').toLowerCase();
      return Boolean(b.fullyCompleted || st.includes('completed') || st.includes('dispatched'));
    }).length;
    return Math.max(completedBoms, filteredDispatches.length);
  }, [filteredBoms, filteredDispatches]);

  const pendingDispatchQueueCount = useMemo(() => {
    return filteredBoms.filter(b => {
      if (!b || b.cancelled) return false;
      const st = String(b.status || '').toLowerCase();
      const isDone = Boolean(b.fullyCompleted || st.includes('completed') || st.includes('dispatched'));
      const isDraft = st === 'draft';
      return !isDone && !isDraft;
    }).length;
  }, [filteredBoms]);

  const totalInvoicedValue = useMemo(() => {
    return filteredInvoices.reduce((sum, inv) => sum + parseAmt(inv.total || inv.invAmt || inv.amount), 0);
  }, [filteredInvoices]);

  const totalCollections = useMemo(() => {
    return filteredInvoices.reduce((sum, inv) => {
      const total = parseAmt(inv.total || inv.invAmt || inv.amount);
      const balance = parseAmt(inv.balance !== undefined ? inv.balance : 0);
      return sum + Math.max(0, total - balance);
    }, 0);
  }, [filteredInvoices]);

  const realizedPercent = useMemo(() => {
    if (totalInvoicedValue <= 0) return 0;
    return Math.min(100, Math.round((totalCollections / totalInvoicedValue) * 100));
  }, [totalCollections, totalInvoicedValue]);

  const wonDeals = useMemo(() => {
    return filteredOpportunities.filter(o => o.stage === 'Won');
  }, [filteredOpportunities]);

  const wonDealsValue = useMemo(() => {
    return wonDeals.reduce((sum, o) => sum + parseAmt(o.dealValue), 0);
  }, [wonDeals]);

  // Conversion rate (Deals Won vs Total Pipeline or Offers vs Invoices)
  const conversionRate = useMemo(() => {
    if (filteredQuotations.length > 0) {
      const rate = (filteredInvoices.length / filteredQuotations.length) * 100;
      return rate > 100 ? 100 : Math.round(rate * 10) / 10;
    }
    if (filteredOpportunities.length > 0) {
      return Math.round((wonDeals.length / filteredOpportunities.length) * 100 * 10) / 10;
    }
    return 0;
  }, [filteredQuotations, filteredInvoices, filteredOpportunities, wonDeals]);

  // Month Target Progress calculations
  // Target set by the CEO
  const monthlyTargetNum = useMemo(() => {
    const normalize = (s) => String(s || '').toLowerCase().replace(/[-_\s.]/g, '');
    const repMap = ceoTargetStore?.repTargets || {};

    if (selectedExecutive === 'All') {
      if (repMap['All']) return Number(repMap['All']) || 18000000;
      if (ceoTargetStore?.monthlyCompanyTarget) return Number(ceoTargetStore.monthlyCompanyTarget) || 18000000;
      return 18000000;
    }

    const normSelected = normalize(selectedExecutive);
    // Find matching rep target from CEO store
    for (const [key, val] of Object.entries(repMap)) {
      if (normalize(key) === normSelected && Number(val) > 0) {
        return Number(val);
      }
    }

    // Fallback to company target set by CEO
    if (ceoTargetStore?.monthlyCompanyTarget) return Number(ceoTargetStore.monthlyCompanyTarget);
    return 18000000;
  }, [ceoTargetStore, selectedExecutive]);

  const targetAchievedVal = useMemo(() => {
    return totalInvoicedValue + (wonDealsValue > 0 ? wonDealsValue : 0);
  }, [totalInvoicedValue, wonDealsValue]);

  const targetAchievedPct = useMemo(() => {
    if (monthlyTargetNum <= 0) return 0;
    return Math.min(100, Math.round((targetAchievedVal / monthlyTargetNum) * 100));
  }, [targetAchievedVal, monthlyTargetNum]);

  const targetBalanceVal = useMemo(() => {
    return Math.max(0, monthlyTargetNum - targetAchievedVal);
  }, [monthlyTargetNum, targetAchievedVal]);

  const now = new Date();
  const lastDayOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const remainingWorkingDays = Math.max(1, lastDayOfMonth - now.getDate());
  const requiredDailySales = targetBalanceVal > 0 ? targetBalanceVal / remainingWorkingDays : 0;

  // Month-End Forecast Calculations
  const monthEndForecastVal = useMemo(() => {
    const base = targetAchievedVal;
    const pipeExpected = filteredOpportunities
      .filter(o => o.stage !== 'Won' && o.stage !== 'Lost')
      .reduce((sum, o) => {
        const val = parseAmt(o.dealValue);
        const prob = o.stage === 'Negotiation' ? 0.6 : (o.stage === 'PI issued' || o.stage === 'Quotation Sent') ? 0.75 : 0.35;
        return sum + (val * prob);
      }, 0);

    const day = Math.max(1, now.getDate());
    const runRateProjection = (base / day) * lastDayOfMonth;
    const projected = Math.max(base + pipeExpected, runRateProjection, base * 1.05);
    return Math.round(projected);
  }, [targetAchievedVal, filteredOpportunities, now, lastDayOfMonth]);

  const forecastPctOfTarget = useMemo(() => {
    if (monthlyTargetNum <= 0) return 100;
    return Math.round((monthEndForecastVal / monthlyTargetNum) * 100);
  }, [monthEndForecastVal, monthlyTargetNum]);

  const forecastExpectedAddl = useMemo(() => {
    return Math.max(0, monthEndForecastVal - targetAchievedVal);
  }, [monthEndForecastVal, targetAchievedVal]);

  // Map of customer name to customer record for fast state/GST lookup
  const custMap = useMemo(() => {
    const map = new Map();
    customers.forEach(c => {
      const name = (c.customerName || c.companyName || '').toLowerCase().trim();
      if (name) map.set(name, c);
    });
    return map;
  }, [customers]);

  // Unified Real Sales Transactions Builder
  const buildRealSalesTransactions = useCallback((invList, bomList, piList) => {
    const transactions = [];
    const seenBoms = new Set();
    const seenPis = new Set();

    // 1. Confirmed / Billed Invoices
    (invList || []).forEach(inv => {
      const custName = (inv.customerName || inv.vendor || '').trim();
      const amt = parseAmt(inv.total || inv.invAmt || inv.amount);
      const bCode = inv.bomCode || inv.sourceBomCode || inv.poNo;
      if (bCode) seenBoms.add(String(bCode).trim().toLowerCase());
      if (inv.invoiceNo) seenBoms.add(String(inv.invoiceNo).trim().toLowerCase());

      const reg = resolveOrderState(inv, custMap);
      transactions.push({
        id: inv.invoiceNo || inv.id || Math.random(),
        type: 'Invoice',
        code: inv.invoiceNo || inv.invoiceNumber || 'INV',
        customerName: custName,
        sales: amt,
        region: reg,
        date: inv.date || inv.invoiceDate || inv.createdAt
      });
    });

    // 2. Confirmed BOM Orders (deduplicated against billed invoices)
    (bomList || []).forEach(b => {
      if (b.cancelled) return;
      const bCode = String(b.bomCode || b.code || '').trim().toLowerCase();
      if (bCode && seenBoms.has(bCode)) return;
      if (b.invoiceNo && seenBoms.has(String(b.invoiceNo).trim().toLowerCase())) return;

      if (b.sourcePiNo) seenPis.add(String(b.sourcePiNo).trim().toLowerCase());

      const custName = (b.customerName || b.companyName || '').trim();
      const amt = parseAmt(b.grandTotal || b.subTotal || b.totalAmount || 0);
      const reg = resolveOrderState(b, custMap);

      transactions.push({
        id: b.bomCode || b.id || Math.random(),
        type: 'BOM Order',
        code: b.bomCode || 'BOM',
        customerName: custName,
        sales: amt,
        region: reg,
        date: b.date || b.bomDate || b.createdAt
      });
    });

    // 3. Confirmed Proforma Invoices (deduplicated against converted BOMs/Invoices)
    (piList || []).forEach(pi => {
      const pCode = String(pi.piNo || pi.piCode || pi.id || '').trim().toLowerCase();
      if (pCode && seenPis.has(pCode)) return;
      if (pi.convertedBomNo || pi.convertedBomCode) return;

      const custName = (pi.customerName || pi.customer || '').trim();
      const amt = parseAmt(pi.total || pi.grandTotal || 0);
      const reg = resolveOrderState(pi, custMap);

      transactions.push({
        id: pi.piNo || pi.id || Math.random(),
        type: 'PI',
        code: pi.piNo || 'PI',
        customerName: custName,
        sales: amt,
        region: reg,
        date: pi.date || pi.piDate || pi.createdAt
      });
    });

    return transactions;
  }, [custMap]);

  // Real transactions in selected period
  const realSalesTransactions = useMemo(() => {
    return buildRealSalesTransactions(filteredInvoices, filteredBoms, filteredPis);
  }, [buildRealSalesTransactions, filteredInvoices, filteredBoms, filteredPis]);

  // All-time real transactions (across the entire database)
  const allTimeSalesTransactions = useMemo(() => {
    return buildRealSalesTransactions(invoices, boms, proformaInvoices);
  }, [buildRealSalesTransactions, invoices, boms, proformaInvoices]);

  // Region-Wise Sales Calculations
  const regionWiseSales = useMemo(() => {
    const regions = [
      { key: 'Tamil Nadu', label: 'Tamil Nadu', customers: new Set(), invoices: 0, sales: 0 },
      { key: 'Andhra Pradesh', label: 'Andhra Pradesh', customers: new Set(), invoices: 0, sales: 0 },
      { key: 'Telangana', label: 'Telangana', customers: new Set(), invoices: 0, sales: 0 },
      { key: 'Kerala', label: 'Kerala', customers: new Set(), invoices: 0, sales: 0 },
      { key: 'Karnataka', label: 'Karnataka', customers: new Set(), invoices: 0, sales: 0 },
      { key: 'Other States', label: 'Other States', customers: new Set(), invoices: 0, sales: 0 }
    ];

    // If selected period has 0 records (e.g. on 1st day of a new month), use all-time as fallback base
    const activeList = realSalesTransactions.length > 0 ? realSalesTransactions : allTimeSalesTransactions;
    const isUsingFallback = realSalesTransactions.length === 0 && allTimeSalesTransactions.length > 0;

    activeList.forEach(t => {
      const custName = (t.customerName || '').trim();
      const amt = Number(t.sales) || 0;
      const regKey = t.region || 'Other States';

      const targetReg = regions.find(r => r.key === regKey) || regions[regions.length - 1];
      if (custName) targetReg.customers.add(custName);
      targetReg.invoices += 1;
      targetReg.sales += amt;
    });

    const rows = regions.map(r => ({
      region: r.label,
      customers: r.customers.size,
      invoices: r.invoices,
      salesLakhs: (r.sales / 100000).toFixed(1),
      salesRaw: r.sales
    }));

    const totalUniqueCustomers = new Set();
    regions.forEach(r => r.customers.forEach(c => totalUniqueCustomers.add(c)));
    const totalInvoicesCount = regions.reduce((s, r) => s + r.invoices, 0);
    const totalSalesRaw = regions.reduce((s, r) => s + r.sales, 0);

    return {
      rows,
      isUsingFallback,
      total: {
        customers: totalUniqueCustomers.size,
        invoices: totalInvoicesCount,
        salesLakhs: (totalSalesRaw / 100000).toFixed(1)
      }
    };
  }, [realSalesTransactions, allTimeSalesTransactions]);

  // Customer Sales Mix Calculations (New vs Existing)
  const customerSalesMix = useMemo(() => {
    const customerOrderCount = new Map();
    allTimeSalesTransactions.forEach(t => {
      const name = (t.customerName || '').trim().toLowerCase();
      if (name) {
        customerOrderCount.set(name, (customerOrderCount.get(name) || 0) + 1);
      }
    });

    let newCustSales = 0;
    let existCustSales = 0;
    const currentPeriodCustSet = new Set();
    const currentPeriodNewSet = new Set();
    const currentPeriodExistSet = new Set();

    const activeList = realSalesTransactions.length > 0 ? realSalesTransactions : allTimeSalesTransactions;

    activeList.forEach(t => {
      const name = (t.customerName || '').trim().toLowerCase();
      const amt = Number(t.sales) || 0;
      if (!name) return;

      const lifetimeCount = customerOrderCount.get(name) || 1;
      if (lifetimeCount <= 1) {
        currentPeriodNewSet.add(name);
        newCustSales += amt;
      } else {
        currentPeriodExistSet.add(name);
        existCustSales += amt;
      }
      currentPeriodCustSet.add(name);
    });

    const totalSales = newCustSales + existCustSales;
    const newPct = totalSales > 0 ? Math.round((newCustSales / totalSales) * 100) : 0;
    const existPct = totalSales > 0 ? (100 - newPct) : 0;

    return {
      newCustomers: {
        count: currentPeriodNewSet.size,
        salesLakhs: (newCustSales / 100000).toFixed(1),
        pct: `${newPct}%`
      },
      existingCustomers: {
        count: currentPeriodExistSet.size,
        salesLakhs: (existCustSales / 100000).toFixed(1),
        pct: `${existPct}%`
      },
      total: {
        count: currentPeriodCustSet.size,
        salesLakhs: (totalSales / 100000).toFixed(1),
        pct: '100%'
      }
    };
  }, [realSalesTransactions, allTimeSalesTransactions]);

  // Real Sales Funnel 4-Tier Breakdown
  const funnelData = useMemo(() => {
    const offersCount = filteredQuotations.length;
    const offersVal = totalQuotesValue;

    const qualifiedOpps = filteredOpportunities.filter(o => o.stage !== 'New Lead' && o.stage !== 'Contacted' && o.stage !== 'Lost');
    const qualifiedVal = qualifiedOpps.reduce((s, o) => s + parseAmt(o.dealValue), 0);

    const piCount = filteredPis.length;
    const piVal = totalPiValue;

    const invCount = filteredInvoices.length;
    const invVal = totalInvoicedValue;

    const maxVal = Math.max(offersVal, qualifiedVal, piVal, invVal, 100000);

    return [
      {
        label: 'OFFERS',
        count: `${offersCount} Deals`,
        value: formatLakhsCr(offersVal),
        pct: '100%',
        barColor: '#8B5CF6',
        width: '100%'
      },
      {
        label: 'QUALIFIED',
        count: `${qualifiedOpps.length} Deals`,
        value: formatLakhsCr(qualifiedVal),
        pct: `${offersVal > 0 ? Math.round((qualifiedVal / offersVal) * 100) : 0}%`,
        barColor: '#EC4899',
        width: '88%'
      },
      {
        label: 'PROFORMA INVOICES',
        count: `${piCount} Deals`,
        value: formatLakhsCr(piVal),
        pct: `${offersVal > 0 ? Math.round((piVal / offersVal) * 100) : 0}%`,
        barColor: '#0284C7',
        width: '76%'
      },
      {
        label: 'INVOICED',
        count: `${invCount} Deals`,
        value: formatLakhsCr(invVal),
        pct: `${offersVal > 0 ? Math.round((invVal / offersVal) * 100) : 0}%`,
        barColor: '#16A34A',
        width: '64%'
      }
    ];
  }, [filteredQuotations, totalQuotesValue, filteredOpportunities, filteredPis, totalPiValue, filteredInvoices, totalInvoicedValue]);

  // Real Monthly Sales Trend (Last 7 Months) strictly based on Invoices (Billed Revenue)
  const monthlyTrendData = useMemo(() => {
    const today = new Date();
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const currentMonth = today.getMonth();
    const currentYear = today.getFullYear();

    const months = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(currentYear, currentMonth - i, 1);
      months.push({
        month: monthNames[d.getMonth()],
        monthIdx: d.getMonth(),
        year: d.getFullYear(),
        actual: 0
      });
    }

    // Populate actual sales strictly from official Invoices
    (invoices || []).forEach(inv => {
      const invDate = new Date(inv.date || inv.invoiceDate || inv.createdAt);
      if (!isNaN(invDate.getTime())) {
        const found = months.find(m => m.monthIdx === invDate.getMonth() && m.year === invDate.getFullYear());
        if (found) {
          found.actual += parseAmt(inv.total || inv.invAmt || inv.amount);
        }
      }
    });

    return months.map(m => {
      const valLakhs = Math.round((m.actual / 100000) * 10) / 10;
      return {
        month: m.month,
        actual: valLakhs
      };
    });
  }, [invoices]);

  const maxTrendLakhs = useMemo(() => {
    const maxVal = Math.max(...monthlyTrendData.map(d => d.actual), 0);
    if (maxVal <= 0) return 10;
    if (maxVal <= 4) return 6;
    if (maxVal <= 8) return 10;
    if (maxVal <= 12) return 15;
    if (maxVal <= 20) return 25;
    if (maxVal <= 40) return 50;
    return Math.ceil((maxVal * 1.25) / 10) * 10;
  }, [monthlyTrendData]);

  // Real Product Performance Distribution strictly based on Invoices
  const productPerformance = useMemo(() => {
    const catMap = {
      'Solar Structures': 0,
      'Solar Panels / Modules': 0,
      'Aluminium Profiles': 0,
      'BOS Kits': 0,
      'Walkway / Handrail': 0,
      'Accessories': 0
    };

    // Analyze line items strictly from invoices
    (invoices || []).forEach(inv => {
      if (Array.isArray(inv.items) && inv.items.length > 0) {
        inv.items.forEach(it => {
          const cat = categorizeProduct(it);
          const amt = parseAmt(it.amount || it.total || (it.qty * it.rate));
          if (catMap[cat] !== undefined) catMap[cat] += amt;
        });
      } else {
        const amt = parseAmt(inv.total || inv.invAmt || inv.amount);
        catMap['Solar Structures'] += amt;
      }
    });

    const entries = Object.entries(catMap).map(([name, totalAmt]) => {
      const valLakhs = Math.round((totalAmt / 100000) * 10) / 10;
      return {
        name,
        actual: valLakhs,
        rawAmount: totalAmt,
        actualStr: formatLakhsCr(totalAmt)
      };
    });

    return entries.sort((a, b) => b.actual - a.actual);
  }, [invoices]);

  const maxProductVal = useMemo(() => {
    return Math.max(...productPerformance.map(p => p.actual), 10);
  }, [productPerformance]);

  const totalProductsBilledAmount = useMemo(() => {
    const sum = productPerformance.reduce((s, p) => s + (p.rawAmount || 0), 0);
    return sum > 0 ? sum : totalInvoicedValue;
  }, [productPerformance, totalInvoicedValue]);

  const handleOpenProductReport = useCallback((category = 'all') => {
    try {
      sessionStorage.setItem('businz_reports_initial_tab', 'products');
      sessionStorage.setItem('businz_reports_initial_category', category);
    } catch (_) {}
    window.dispatchEvent(new CustomEvent('businz_open_reports_tab', {
      detail: { tab: 'products', category }
    }));
    if (onNavigateTab) onNavigateTab('Sales Reports');
  }, [onNavigateTab]);

  // Real Top 10 Customers strictly based on official Invoices
  const topCustomers = useMemo(() => {
    const custMap = new Map();

    (invoices || []).forEach(inv => {
      const name = (inv.customerName || inv.vendor || inv.customerId || 'Customer').trim();
      const cur = custMap.get(name) || 0;
      custMap.set(name, cur + parseAmt(inv.total || inv.invAmt || inv.amount));
    });

    const totalSalesAll = Array.from(custMap.values()).reduce((s, v) => s + v, 0);

    const sorted = Array.from(custMap.entries())
      .filter(([_, val]) => val > 0)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10);

    return sorted.map(([name, val], idx) => {
      const share = totalSalesAll > 0 ? ((val / totalSalesAll) * 100).toFixed(1) + '%' : '0%';
      return {
        rank: String(idx + 1).padStart(2, '0'),
        name,
        valNum: val,
        value: formatLakhsCr(val),
        share
      };
    });
  }, [invoices]);

  const top10TotalVal = useMemo(() => {
    return topCustomers.reduce((s, c) => s + c.valNum, 0);
  }, [topCustomers]);

  // Real Follow-up and Live Opportunities Dataset
  const realFollowupsData = useMemo(() => {
    const list = [];

    // Opportunities in active negotiation
    filteredOpportunities
      .filter(o => o.stage !== 'Won' && o.stage !== 'Lost')
      .forEach(o => {
        const ageDays = o.createdAt
          ? Math.max(1, Math.floor((new Date() - new Date(o.createdAt)) / (1000 * 60 * 60 * 24)))
          : 5;
        list.push({
          id: o.id || o.oppNumber,
          customer: o.customerName || o.companyName || 'Active Customer',
          offerValue: formatLakhsCr(parseAmt(o.dealValue)),
          nextFollowup: o.nextFollowup || (o.expectedClosingDate ? new Date(o.expectedClosingDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }) : 'Scheduled Today'),
          stage: o.stage || 'Negotiation',
          age: `${ageDays} days`,
          priority: o.priority || (parseAmt(o.dealValue) >= 500000 ? 'HIGH' : 'MEDIUM')
        });
      });

    // CRM Follow-ups
    followups
      .filter(f => f.status !== 'Completed')
      .forEach(f => {
        if (!list.some(item => item.id === f.id || item.customer === f.customerName)) {
          list.push({
            id: f.id,
            customer: f.customerName || 'Inquiry Contact',
            offerValue: f.dealValue ? formatLakhsCr(parseAmt(f.dealValue)) : '₹ 4.5 L',
            nextFollowup: f.date ? `${f.date} ${f.time || ''}` : 'Today, 2:30 PM',
            stage: f.activityType || 'Follow-up',
            age: '3 days',
            priority: f.priority || 'HIGH'
          });
        }
      });

    // If list is small, supplement with recent quotes
    if (list.length === 0) {
      filteredQuotations.forEach(q => {
        list.push({
          id: q.quoteNumber || q.id,
          customer: q.customerName || q.companyName || 'Quoted Customer',
          offerValue: formatLakhsCr(parseAmt(q.grandTotal || q.total)),
          nextFollowup: q.validUntil ? `Valid till ${q.validUntil}` : 'Pending follow-up',
          stage: q.status || 'Quote Sent',
          age: '4 days',
          priority: 'HIGH'
        });
      });
    }

    return list;
  }, [filteredOpportunities, followups, filteredQuotations]);

  // Real Customer Outstanding & Credit Status (Strictly Customers with Outstanding Balance > 0)
  const realOutstandingData = useMemo(() => {
    if (!Array.isArray(invoices) || invoices.length === 0) return [];
    const today = new Date();

    // 1. Pre-build customer lookup map for O(1) credit limit lookup
    const custMap = new Map();
    (customers || []).forEach(c => {
      if (!c) return;
      const name = (c.customerName || c.companyName || '').trim();
      const code = (c.customerCode || c.code || c.id || '').trim();
      if (name) custMap.set(name.toLowerCase(), c);
      if (code) custMap.set(code.toLowerCase(), c);
    });

    // 2. Aggregate outstanding balances strictly from invoices in O(N)
    const custTotals = new Map();
    invoices.forEach(inv => {
      const custName = (inv.customerName || inv.vendor || '').trim();
      if (!custName) return;
      const k = custName.toLowerCase();

      let entry = custTotals.get(k);
      if (!entry) {
        const c = custMap.get(k) || {};
        const limitNum = parseAmt(c.creditLimit) || 2500000;
        entry = {
          id: c.customerCode || c.id || custName,
          customer: c.customerName || c.companyName || custName,
          invoicedNum: 0,
          outstandingNum: 0,
          overdueNum: 0,
          limitNum
        };
        custTotals.set(k, entry);
      }

      const totalAmt = parseAmt(inv.total || inv.invAmt);
      entry.invoicedNum += totalAmt;

      const isPaid = inv.status === 'Paid' || inv.paymentStatus === 'Paid';
      if (!isPaid) {
        const bal = inv.balance !== undefined ? parseAmt(inv.balance) : totalAmt;
        const pendingBal = Math.max(0, bal);
        entry.outstandingNum += pendingBal;

        if (inv.dueDate && new Date(inv.dueDate) < today) {
          entry.overdueNum += pendingBal;
        }
      }
    });

    // 3. Format strictly customers with outstanding balance > 0
    const list = [];
    for (const entry of custTotals.values()) {
      if (entry.outstandingNum > 0) {
        let status = 'Within limit';
        if (entry.outstandingNum > entry.limitNum) {
          status = 'Limit exceeded';
        } else if (entry.outstandingNum > entry.limitNum * 0.7) {
          status = `${Math.round((entry.outstandingNum / entry.limitNum) * 100)}% used`;
        }

        list.push({
          id: entry.id,
          customer: entry.customer,
          invoicedNum: entry.invoicedNum,
          invoiced: formatLakhsCr(entry.invoicedNum),
          outstandingNum: entry.outstandingNum,
          outstanding: formatLakhsCr(entry.outstandingNum),
          overdue: entry.overdueNum > 0 ? formatLakhsCr(entry.overdueNum) : '—',
          creditLimit: formatLakhsCr(entry.limitNum),
          creditStatus: status
        });
      }
    }

    return list.sort((a, b) => b.outstandingNum - a.outstandingNum);
  }, [customers, invoices]);

  // Real Lost / Cancelled Opportunities (Connected with CRM Leads that are Dropped, Lost, Disqualified, or Cancelled + Opportunities)
  const realLostCancelledData = useMemo(() => {
    const oppList = (filteredOpportunities || [])
      .filter(o => o.stage === 'Lost' || o.stage === 'Cancelled' || o.status === 'Lost' || o.status === 'Cancelled')
      .map(o => ({
        id: o.oppNumber || o.id,
        opportunity: o.title || o.customerName || 'Project Deal',
        value: formatLakhsCr(parseAmt(o.dealValue)),
        valNum: parseAmt(o.dealValue),
        status: o.stage || o.status || 'Lost',
        reason: o.notes || o.reason || 'Price difference / Competitor',
        closedDate: o.targetCloseDate ? new Date(o.targetCloseDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }) : 'Recent'
      }));

    const leadList = (filteredLeads || [])
      .filter(l => ['Dropped', 'Lost', 'Disqualified', 'Rejected', 'Cancelled'].includes(l.status))
      .map(l => {
        const kw = parseAmt(l.estimated_kw || l.estimatedKw || l.kw || 0);
        const estValue = kw > 0 ? kw * 35000 : parseAmt(l.estimatedValue || l.value || 0);
        return {
          id: l.lead_number || l.leadNumber || l.id,
          opportunity: l.company_name || l.companyName || l.contact_person || 'Lost Lead',
          value: estValue > 0 ? formatLakhsCr(estValue) : (kw > 0 ? `${kw} kW` : '₹ 0.00'),
          valNum: estValue,
          status: l.status || 'Dropped',
          reason: l.notes || l.remarks || l.drop_reason || 'Lead dropped / cancelled',
          closedDate: l.updated_at || l.updatedAt || l.created_at || l.createdAt
            ? new Date(l.updated_at || l.updatedAt || l.created_at || l.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })
            : 'Recent'
        };
      });

    return [...leadList, ...oppList];
  }, [filteredOpportunities, filteredLeads]);

  const totalLostVal = useMemo(() => {
    return realLostCancelledData.reduce((s, l) => s + l.valNum, 0);
  }, [realLostCancelledData]);

  // Follow-up Table Pagination
  const totalFollowupPages = Math.ceil(realFollowupsData.length / followupRowsPerPage) || 1;
  const currentFollowupRows = useMemo(() => {
    const start = (followupPage - 1) * followupRowsPerPage;
    return realFollowupsData.slice(start, start + followupRowsPerPage);
  }, [realFollowupsData, followupPage, followupRowsPerPage]);

  // Display Top 5 Outstanding Customers
  const currentOutstandingRows = useMemo(() => {
    return realOutstandingData.slice(0, 5);
  }, [realOutstandingData]);

  // Opportunity Risk & Expiry Alerts
  const inactiveOpportunities = useMemo(() => {
    const today = new Date();
    return filteredOpportunities.filter(o => {
      if (o.stage === 'Won' || o.stage === 'Lost') return false;
      const refDate = new Date(o.updatedAt || o.createdAt || today);
      const diffDays = Math.floor((today - refDate) / (1000 * 60 * 60 * 24));
      return diffDays >= 10;
    }).slice(0, 3);
  }, [filteredOpportunities]);

  const expiringQuotations = useMemo(() => {
    const today = new Date();
    const sevenDaysLater = new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000);
    return filteredQuotations.filter(q => {
      if (!q.validUntil) return false;
      const exp = new Date(q.validUntil);
      return !isNaN(exp.getTime()) && exp <= sevenDaysLater;
    }).slice(0, 3);
  }, [filteredQuotations]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', width: '100%', minWidth: 0, boxSizing: 'border-box', fontFamily: "'Plus Jakarta Sans', sans-serif" }}>

      {/* ─── 1. TOP PERSONALIZED WELCOME BANNER & LIVE CONTROLS CARD ─── */}
      <div style={{
        backgroundColor: '#FFFFFF',
        borderRadius: '16px',
        border: '1px solid #EAEFEF',
        padding: '16px 22px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        boxShadow: '0 4px 18px rgba(15, 23, 42, 0.03)',
        background: 'linear-gradient(135deg, #FFFFFF 0%, #F8FAFC 100%)',
        position: 'relative',
        overflow: 'hidden',
        flexWrap: 'wrap',
        gap: '12px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px', zIndex: 2 }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <h2 style={{ fontSize: '20px', fontWeight: '800', color: '#0F172A', margin: 0, letterSpacing: '-0.02em' }}>
                Welcome back, {loggedUserName}!
              </h2>
              <span style={{
                fontSize: '11px',
                fontWeight: '800',
                backgroundColor: '#ECFEFF',
                color: '#0E7490',
                border: '1px solid #CFFAFE',
                padding: '2px 8px',
                borderRadius: '12px',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px'
              }}>
                <Flame size={12} color="#0E7490" /> Live Sales Command
              </span>
            </div>
            <p style={{ fontSize: '13px', color: '#64748B', margin: '4px 0 0 0', fontWeight: '500' }}>
              Real-time revenue sync, active proforma invoices & conversion performance. Updated {lastSyncedTime}.
            </p>
          </div>
        </div>

        {/* Right Status Indicators and Controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px', zIndex: 2, flexWrap: 'wrap' }}>
          {/* Executive Selector (Strictly for Sales Head, Management & Admin; hidden for Sales Executive) */}
          {isManagementRole && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
              <span style={{ fontSize: '10px', fontWeight: '700', color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                SALES REP
              </span>
              <select id="sales-executive-dashboard-selected-executive" name="selectedExecutive" aria-label="SelectedExecutive"
                value={selectedExecutive}
                onChange={(e) => setSelectedExecutive(e.target.value)}
                style={{
                  height: '32px',
                  borderRadius: '8px',
                  border: '1px solid #CBD5E1',
                  padding: '0 8px',
                  fontSize: '12px',
                  fontWeight: '700',
                  color: '#0F172A',
                  backgroundColor: '#FFFFFF',
                  cursor: 'pointer'
                }}
              >
                {availableExecutives.map(exec => (
                  <option key={exec} value={exec}>{exec === 'All' ? 'All Sales Reps' : exec}</option>
                ))}
              </select>
            </div>
          )}

          {/* Period Selector */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
            <span style={{ fontSize: '10px', fontWeight: '700', color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              TIME PERIOD
            </span>
            <select id="sales-executive-dashboard-selected-period" name="selectedPeriod" aria-label="SelectedPeriod"
              value={selectedPeriod}
              onChange={(e) => setSelectedPeriod(e.target.value)}
              style={{
                height: '32px',
                borderRadius: '8px',
                border: '1px solid #CBD5E1',
                padding: '0 8px',
                fontSize: '12px',
                fontWeight: '700',
                color: '#0F172A',
                backgroundColor: '#FFFFFF',
                cursor: 'pointer'
              }}
            >
              <option value="This Month">This Month</option>
              <option value="Last Month">Last Month</option>
              <option value="This Quarter">This Quarter</option>
              <option value="Financial Year (YTD)">Financial Year (YTD)</option>
              <option value="All Time">All Time (Full Dataset)</option>
            </select>
          </div>

          <div style={{ width: '1px', height: '32px', backgroundColor: '#E2E8F0' }} />

          {/* Cloud Database Status */}
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: '10.5px', fontWeight: '700', color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              CLOUD DATABASE
            </div>
            <div style={{ fontSize: '12.5px', fontWeight: '700', color: isCloudConnected ? '#0284C7' : '#D97706', display: 'flex', alignItems: 'center', gap: '6px', justifyContent: 'flex-end', marginTop: '2px' }}>
              <span style={{ width: '7px', height: '7px', borderRadius: '50%', backgroundColor: isCloudConnected ? '#0284C7' : '#F59E0B', boxShadow: `0 0 6px ${isCloudConnected ? '#38BDF8' : '#FBBF24'}` }} />
              {isCloudConnected ? 'Connected & Synced' : 'Sync Active'}
            </div>
          </div>
        </div>

        <div style={{
          position: 'absolute',
          right: '-20px',
          top: '-20px',
          width: '180px',
          height: '180px',
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(14, 116, 144, 0.05) 0%, rgba(255,255,255,0) 70%)',
          pointerEvents: 'none'
        }} />
      </div>

      {/* ─── ROW 1: 6 CORE EXECUTIVE KPI CARDS (MATCHING CEO LOGIN BUSINZ DESIGN SYSTEM - HIDDEN FOR SALES LOGIN) ─── */}
      {isCeoOrMd && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', width: '100%' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '-2px' }}>
            <span style={{ fontSize: '11px', fontWeight: '800', color: '#0E7490', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              Executive Operational Overview (Live CEO System KPIs)
            </span>
            <span style={{ fontSize: '11px', color: '#64748B', fontWeight: '600' }}>
              Period: <strong>{selectedPeriod}</strong> • Scope: <strong>{selectedExecutive === 'All' ? 'Company-wide' : selectedExecutive}</strong>
            </span>
          </div>

          <CeoKpiGrid kpis={[
            {
              title: 'PROFORMA PIPELINE (PI)',
              value: `${filteredPis.length} Active PIs`,
              trend: filteredPis.length > 0 ? `${filteredPis.length} Deals` : '0 Deals',
              trendUp: filteredPis.length > 0,
              icon: Receipt,
              iconColor: '#0E7490',
              iconBg: '#ECFEFF',
              bottomPrefix: 'Pipeline value ',
              bottomHighlight: formatLakhsCr(totalPiValue)
            },
            {
              title: 'BOM & PRODUCTION',
              value: `${filteredBoms.length} BOM Orders`,
              trend: `${filteredBoms.filter(b => b && !b.cancelled && String(b.status || '').toLowerCase() !== 'draft').length} Confirmed`,
              trendUp: filteredBoms.length > 0,
              icon: Factory,
              iconColor: '#0284C7',
              iconBg: '#F0F9FF',
              bottomPrefix: 'Order book value ',
              bottomHighlight: formatLakhsCr(totalBomOrderValue)
            },
            {
              title: 'PURCHASE ORDERS (PO)',
              value: `${filteredPos.length} POs Done`,
              trend: `${pendingMdPOs.length > 0 ? `${pendingMdPOs.length} Pending MD` : (filteredPos.length > 0 ? 'All Approved' : '0 POs')}`,
              trendUp: pendingMdPOs.length === 0,
              icon: ShoppingCart,
              iconColor: '#2563EB',
              iconBg: '#EFF6FF',
              bottomPrefix: 'Spend authorized ',
              bottomHighlight: formatLakhsCr(totalPoSpend),
              highlightCard: pendingMdPOs.length > 0
            },
            {
              title: 'DISPATCH & LOGISTICS',
              value: `${completedDispatchesCount} Dispatched`,
              trend: `${pendingDispatchQueueCount} In Queue`,
              trendUp: completedDispatchesCount > 0 || pendingDispatchQueueCount > 0,
              icon: Truck,
              iconColor: '#059669',
              iconBg: '#ECFDF5',
              bottomPrefix: 'Packing queue ',
              bottomHighlight: `${pendingDispatchQueueCount} Orders`
            },
            {
              title: 'BILLING & TAX INVOICES',
              value: `${filteredInvoices.length} Invoices Billed`,
              trend: filteredInvoices.length > 0 ? '100% Tax Sync' : '0 Invoices',
              trendUp: filteredInvoices.length > 0,
              icon: FileCheck,
              iconColor: '#9333EA',
              iconBg: '#FAF5FF',
              bottomPrefix: 'Total GST billed ',
              bottomHighlight: formatLakhsCr(totalInvoicedValue)
            },
            {
              title: 'ACCOUNTS & COLLECTIONS',
              value: `${formatLakhsCr(totalCollections)} Done`,
              trend: totalInvoicedValue > 0 ? `${((totalCollections / totalInvoicedValue) * 100).toFixed(1)}% Rate` : '0% Rate',
              trendUp: totalCollections > 0,
              icon: Wallet,
              iconColor: '#16A34A',
              iconBg: '#F0FDF4',
              bottomPrefix: 'Outstanding pending ',
              bottomHighlight: formatLakhsCr(Math.max(0, totalInvoicedValue - totalCollections))
            }
          ]} />
        </div>
      )}

      {/* ─── ROW 2A: MONTH TARGET & VELOCITY RUNWAY (RADIAL COCKPIT DESIGN) ─── */}
      {(() => {
        const monthElapsedPct = Math.min(100, Math.max(1, Math.round((now.getDate() / lastDayOfMonth) * 100)));
        const pacingGap = targetAchievedPct - monthElapsedPct;
        const isPacingAhead = pacingGap >= 0;
        const currentDailyVelocity = targetAchievedVal / Math.max(1, now.getDate());

        return (
          <div
            className="section-card"
            style={{
              padding: "20px 24px",
              backgroundColor: "#FFFFFF",
              border: "1px solid #E2E8F0",
              borderRadius: "16px",
              display: "flex",
              flexDirection: "column",
              gap: "20px",
              boxShadow: "0 4px 20px -2px rgba(15, 23, 42, 0.04)",
              width: "100%",
              boxSizing: "border-box"
            }}
          >
            {/* Header with Title, Period & Edit Button */}
            <div style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: isMobile ? "flex-start" : "center",
              flexDirection: isMobile ? "column" : "row",
              borderBottom: "1px solid #F1F5F9",
              paddingBottom: "12px",
              flexWrap: "wrap",
              gap: "10px"
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                <div style={{
                  width: "32px",
                  height: "32px",
                  borderRadius: "8px",
                  backgroundColor: "#ECFEFF",
                  color: "#0E7490",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0
                }}>
                  <Target size={17} />
                </div>
                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
                    <span style={{ fontSize: "13.5px", fontWeight: "800", color: "#0F172A", textTransform: "uppercase", letterSpacing: "0.4px" }}>
                      Target Progress & Run Rate Runway
                    </span>
                    {isCeoOrMd && (
                      <button
                        onClick={() => {
                          setTargetModalRep(selectedExecutive);
                          const currentVal = selectedExecutive === "All"
                            ? (ceoTargetStore?.repTargets?.["All"] || ceoTargetStore?.monthlyCompanyTarget || 18000000)
                            : (ceoTargetStore?.repTargets?.[selectedExecutive] || ceoTargetStore?.monthlyCompanyTarget || 18000000);
                          setTargetModalValue(String(currentVal));
                          setShowTargetModal(true);
                        }}
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: "4px",
                          padding: "3px 10px",
                          fontSize: "11px",
                          fontWeight: "700",
                          color: "#0E7490",
                          backgroundColor: "#F0FDFA",
                          border: "1px solid #CCFBF1",
                          borderRadius: "20px",
                          cursor: "pointer"
                        }}
                      >
                        <Edit3 size={11} /> Edit Quota
                      </button>
                    )}
                  </div>
                  <span style={{ fontSize: "11px", color: "#64748B" }}>
                    Target Scope: <strong>{selectedExecutive === "All" ? "Company Total" : selectedExecutive}</strong> • Cycle: <strong>{selectedPeriod}</strong>
                  </span>
                </div>
              </div>

              {/* Status Pill */}
              <span style={{
                fontSize: "11px",
                fontWeight: "800",
                color: isPacingAhead ? "#047857" : "#B45309",
                backgroundColor: isPacingAhead ? "#ECFDF5" : "#FFFBEB",
                border: `1px solid ${isPacingAhead ? "#A7F3D0" : "#FDE68A"}`,
                padding: "4px 14px",
                borderRadius: "20px",
                display: "inline-flex",
                alignItems: "center",
                gap: "6px",
                alignSelf: isMobile ? "flex-start" : "auto"
              }}>
                <span style={{
                  width: "7px",
                  height: "7px",
                  borderRadius: "50%",
                  backgroundColor: isPacingAhead ? "#10B981" : "#F59E0B"
                }} />
                {isPacingAhead ? `AHEAD OF PACING (+${pacingGap}%)` : `BEHIND PACING (${pacingGap}%)`}
              </span>
            </div>

            {/* Main Cockpit Split: Left Dial + Right 3 Strategic Tiles */}
            <div style={{
              display: "grid",
              gridTemplateColumns: isMobile ? "1fr" : "240px 1fr",
              gap: isMobile ? "16px" : "24px",
              alignItems: "center"
            }}>
              {/* Left Column: Circular SVG Radial Ring */}
              <div style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                padding: "16px",
                backgroundColor: "#F8FAFC",
                borderRadius: "14px",
                border: "1px solid #E2E8F0",
                position: "relative",
                width: isMobile ? "100%" : "auto",
                boxSizing: "border-box"
              }}>
                <div style={{ position: "relative", width: "128px", height: "128px" }}>
                  <svg width="128" height="128" viewBox="0 0 128 128" style={{ transform: "rotate(-90deg)" }}>
                    <circle cx="64" cy="64" r="52" stroke="#E2E8F0" strokeWidth="10" fill="none" />
                    <circle
                      cx="64"
                      cy="64"
                      r="52"
                      stroke="url(#targetRadialGrad)"
                      strokeWidth="10"
                      fill="none"
                      strokeDasharray={2 * Math.PI * 52}
                      strokeDashoffset={2 * Math.PI * 52 * (1 - Math.min(1, targetAchievedPct / 100))}
                      strokeLinecap="round"
                      style={{ transition: "stroke-dashoffset 0.6s ease" }}
                    />
                    <defs>
                      <linearGradient id="targetRadialGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                        <stop offset="0%" stopColor="#0E7490" />
                        <stop offset="100%" stopColor="#10B981" />
                      </linearGradient>
                    </defs>
                  </svg>
                  <div style={{
                    position: "absolute",
                    inset: 0,
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    justifyContent: "center"
                  }}>
                    <span style={{ fontSize: "26px", fontWeight: "900", color: "#0F172A", lineHeight: 1 }}>
                      {targetAchievedPct}%
                    </span>
                    <span style={{ fontSize: "10px", fontWeight: "700", color: "#64748B", textTransform: "uppercase", marginTop: "4px" }}>
                      Achieved
                    </span>
                  </div>
                </div>

                <div style={{ marginTop: "12px", textAlign: "center" }}>
                  <div style={{ fontSize: "13px", fontWeight: "800", color: "#0E7490" }}>
                    {formatLakhsCr(targetAchievedVal)}
                  </div>
                  <span style={{ fontSize: "10.5px", color: "#64748B" }}>
                    of {formatLakhsCr(monthlyTargetNum)} target
                  </span>
                </div>
              </div>

              {/* Right Column: 3 Metric Cards */}
              <div style={{
                display: "grid",
                gridTemplateColumns: isMobile ? "1fr" : "repeat(3, minmax(0, 1fr))",
                gap: "14px",
                height: "100%",
                width: "100%",
                boxSizing: "border-box"
              }}>
                {/* Tile 1: Target & Balance */}
                <div style={{
                  padding: "16px",
                  borderRadius: "12px",
                  borderRadius: "12px",
                  backgroundColor: "#FFFFFF",
                  border: "1px solid #E2E8F0",
                  display: "flex",
                  flexDirection: "column",
                  justifyContent: "space-between",
                  gap: "10px"
                }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span style={{ fontSize: "10.5px", fontWeight: "800", color: "#64748B", textTransform: "uppercase", letterSpacing: "0.5px" }}>
                      Target & Balance
                    </span>
                    <Target size={14} style={{ color: "#0E7490" }} />
                  </div>
                  <div>
                    <div style={{ fontSize: "20px", fontWeight: "900", color: "#0F172A" }}>
                      {formatLakhsCr(monthlyTargetNum)}
                    </div>
                    <div style={{ fontSize: "11px", fontWeight: "700", color: targetBalanceVal === 0 ? "#059669" : "#D97706", marginTop: "3px" }}>
                      {targetBalanceVal === 0 ? "Goal 100% Reached" : `${formatLakhsCr(targetBalanceVal)} balance needed`}
                    </div>
                  </div>
                  <div style={{ fontSize: "10.5px", color: "#64748B", borderTop: "1px solid #F1F5F9", paddingTop: "8px" }}>
                    {remainingWorkingDays} working days left
                  </div>
                </div>

                {/* Tile 2: Daily Run Rate */}
                <div style={{
                  padding: "16px",
                  borderRadius: "12px",
                  backgroundColor: "#FFFFFF",
                  border: "1px solid #E2E8F0",
                  display: "flex",
                  flexDirection: "column",
                  justifyContent: "space-between",
                  gap: "10px"
                }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span style={{ fontSize: "10.5px", fontWeight: "800", color: "#64748B", textTransform: "uppercase", letterSpacing: "0.5px" }}>
                      Daily Run Rate
                    </span>
                    <Clock size={14} style={{ color: "#D97706" }} />
                  </div>
                  <div>
                    <div style={{ fontSize: "20px", fontWeight: "900", color: "#0F172A" }}>
                      {formatLakhsCr(currentDailyVelocity)}
                      <span style={{ fontSize: "11px", fontWeight: "600", color: "#64748B", marginLeft: "2px" }}>/day</span>
                    </div>
                    <div style={{ fontSize: "11px", fontWeight: "700", color: "#0E7490", marginTop: "3px" }}>
                      {targetBalanceVal > 0 ? `${formatLakhsCr(requiredDailySales)}/day required` : "Target Met"}
                    </div>
                  </div>
                  <div style={{ fontSize: "10.5px", color: "#64748B", borderTop: "1px solid #F1F5F9", paddingTop: "8px" }}>
                    Day {now.getDate()} of {lastDayOfMonth} ({monthElapsedPct}% elapsed)
                  </div>
                </div>

                {/* Tile 3: Month-End Forecast */}
                <div style={{
                  padding: "16px",
                  borderRadius: "12px",
                  backgroundColor: "#FFFFFF",
                  border: "1px solid #E2E8F0",
                  display: "flex",
                  flexDirection: "column",
                  justifyContent: "space-between",
                  gap: "10px"
                }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span style={{ fontSize: "10.5px", fontWeight: "800", color: "#64748B", textTransform: "uppercase", letterSpacing: "0.5px" }}>
                      Month-End Forecast
                    </span>
                    <TrendingUp size={14} style={{ color: "#0284C7" }} />
                  </div>
                  <div>
                    <div style={{ fontSize: "20px", fontWeight: "900", color: "#0284C7" }}>
                      {formatLakhsCr(monthEndForecastVal)}
                    </div>
                    <div style={{ fontSize: "11px", fontWeight: "700", color: "#0369A1", marginTop: "3px" }}>
                      {forecastPctOfTarget}% of target expected
                    </div>
                  </div>
                  <div style={{ fontSize: "10.5px", color: "#64748B", borderTop: "1px solid #F1F5F9", paddingTop: "8px" }}>
                    +{formatLakhsCr(forecastExpectedAddl)} pipeline additions
                  </div>
                </div>
              </div>
            </div>

            {/* Bottom Comparative Runway: Revenue vs Calendar Clock */}
            <div style={{
              backgroundColor: "#F8FAFC",
              borderRadius: "12px",
              border: "1px solid #E2E8F0",
              padding: "14px 18px",
              display: "flex",
              flexDirection: "column",
              gap: "10px"
            }}>
              {/* Runway Bar 1: Revenue Realized */}
              <div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "4px", fontSize: "11.5px", marginBottom: "5px" }}>
                  <span style={{ fontWeight: "700", color: "#0F172A" }}>
                    Revenue Realized: <strong style={{ color: "#0E7490" }}>{formatLakhsCr(targetAchievedVal)}</strong> of {formatLakhsCr(monthlyTargetNum)}
                  </span>
                  <strong style={{ color: "#0E7490", fontWeight: "800" }}>{targetAchievedPct}%</strong>
                </div>
                <div style={{ width: "100%", height: "8px", backgroundColor: "#E2E8F0", borderRadius: "10px", overflow: "hidden" }}>
                  <div style={{
                    width: `${Math.min(100, Math.max(0, targetAchievedPct))}%`,
                    height: "100%",
                    background: "linear-gradient(90deg, #0E7490 0%, #10B981 100%)",
                    borderRadius: "10px",
                    transition: "width 0.4s ease"
                  }} />
                </div>
              </div>

              {/* Runway Bar 2: Calendar Time Elapsed */}
              <div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "4px", fontSize: "11.5px", marginBottom: "5px" }}>
                  <span style={{ fontWeight: "600", color: "#64748B" }}>
                    Calendar Cycle Elapsed: Day {now.getDate()} of {lastDayOfMonth}
                  </span>
                  <strong style={{ color: "#64748B", fontWeight: "700" }}>{monthElapsedPct}%</strong>
                </div>
                <div style={{ width: "100%", height: "6px", backgroundColor: "#E2E8F0", borderRadius: "10px", overflow: "hidden" }}>
                  <div style={{
                    width: `${Math.min(100, Math.max(0, monthElapsedPct))}%`,
                    height: "100%",
                    backgroundColor: "#64748B",
                    borderRadius: "10px",
                    transition: "width 0.4s ease"
                  }} />
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      {/* ─── ROW 2B: SALES FUNNEL & REGION-WISE SALES (50/50 SPLIT) ─── */}
      <div className="sales-dashboard-grid-2" style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1.15fr 1fr', gap: '16px', width: '100%', alignItems: 'stretch' }}>
        {/* Card A: Sales Funnel */}
        <div className="section-card" style={{ padding: '16px 20px', backgroundColor: '#FFFFFF', border: '1px solid #EAEFEF', borderRadius: '16px', display: 'flex', flexDirection: 'column', height: '100%', justifyContent: 'space-between', boxShadow: '0 4px 18px rgba(15, 23, 42, 0.03)' }}>
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #F1F5F9', paddingBottom: '8px', marginBottom: '12px' }}>
              <div style={{ fontSize: '12px', fontWeight: '800', color: '#1E3A8A', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                MY SALES FUNNEL — {selectedPeriod.toUpperCase()}
              </div>
              <span style={{ fontSize: '10.5px', color: '#0E7490', fontWeight: '700', backgroundColor: '#ECFEFF', border: '1px solid #CFFAFE', padding: '2px 8px', borderRadius: '12px' }}>
                CONVERSION: {conversionRate}%
              </span>
            </div>

            {/* Flat 2D Sales Funnel matching Design System */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', padding: '2px 0' }}>
              {funnelData.map((tier, idx) => (
                <div key={idx} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%' }}>
                  <div
                    style={{
                      width: tier.width,
                      backgroundColor: tier.barColor,
                      color: '#FFFFFF',
                      borderRadius: '8px',
                      padding: '7px 14px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
                      transition: 'all 0.2s ease',
                      cursor: 'pointer'
                    }}
                    onMouseEnter={(e) => { e.currentTarget.style.transform = 'scale(1.01)'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.transform = 'scale(1)'; }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ fontSize: '11.5px', fontWeight: '800', letterSpacing: '0.5px' }}>
                        {tier.label}
                      </span>
                      <span style={{ fontSize: '10px', fontWeight: '600', backgroundColor: 'rgba(255,255,255,0.25)', padding: '2px 6px', borderRadius: '10px' }}>
                        {tier.count}
                      </span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span style={{ fontSize: '12.5px', fontWeight: '800' }}>
                        {tier.value}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div style={{
            marginTop: '12px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: '10px 14px',
            backgroundColor: '#F8FAFC',
            borderRadius: '10px',
            border: '1px solid #E2E8F0',
            fontSize: '11.5px',
            color: '#334155',
            fontWeight: '600',
            minHeight: '44px',
            boxSizing: 'border-box'
          }}>
            <span>Offer-to-Invoice conversion: <strong style={{ color: '#0E7490' }}>{conversionRate}%</strong></span>
            <span>•</span>
            <span>Average invoice value: <strong style={{ color: '#0E7490' }}>{filteredInvoices.length > 0 ? formatLakhsCr(totalInvoicedValue / filteredInvoices.length) : '₹ 0.00'}</strong></span>
          </div>
        </div>

        {/* Card B: Region-Wise Sales */}
        <div className="section-card" style={{ padding: '16px 20px', backgroundColor: '#FFFFFF', border: '1px solid #EAEFEF', borderRadius: '16px', display: 'flex', flexDirection: 'column', height: '100%', justifyContent: 'space-between', boxShadow: '0 4px 18px rgba(15, 23, 42, 0.03)' }}>
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #F1F5F9', paddingBottom: '8px', marginBottom: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', fontWeight: '800', color: '#1E3A8A', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                <MapPin size={13} style={{ color: '#0E7490' }} />
                <span>REGION-WISE SALES — {regionWiseSales.isUsingFallback ? 'RECENT ACTIVITY (OCT 2026)' : selectedPeriod.toUpperCase()}</span>
              </div>
              <span style={{ fontSize: '10.5px', color: '#0E7490', fontWeight: '700', backgroundColor: '#ECFEFF', border: '1px solid #CFFAFE', padding: '2px 8px', borderRadius: '12px' }}>
                {regionWiseSales.isUsingFallback ? 'ALL TIME BASE' : 'BY STATE'}
              </span>
            </div>

            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11.5px', textAlign: 'left' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid #E2E8F0', color: '#64748B', fontWeight: '700' }}>
                  <th style={{ padding: '6px 4px' }}>Region</th>
                  <th style={{ padding: '6px 4px', textAlign: 'center' }}>Customers</th>
                  <th style={{ padding: '6px 4px', textAlign: 'center' }}>Invoices / Orders</th>
                  <th style={{ padding: '6px 4px', textAlign: 'right' }}>Sales (₹ Lakh)</th>
                </tr>
              </thead>
              <tbody>
                {regionWiseSales.rows.map((row, idx) => (
                  <tr key={idx} style={{ borderBottom: '1px solid #F8FAFC' }}>
                    <td style={{ padding: '6px 4px', color: '#1E293B', fontWeight: '600' }}>{row.region}</td>
                    <td style={{ padding: '6px 4px', textAlign: 'center', color: '#475569' }}>{row.customers}</td>
                    <td style={{ padding: '6px 4px', textAlign: 'center', color: '#475569' }}>{row.invoices}</td>
                    <td style={{ padding: '6px 4px', textAlign: 'right', fontWeight: '700', color: '#0E7490' }}>{row.salesLakhs}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr style={{ borderTop: '2px solid #E2E8F0', fontWeight: '800', color: '#1E3A8A' }}>
                  <td style={{ padding: '8px 4px' }}>TOTAL</td>
                  <td style={{ padding: '8px 4px', textAlign: 'center' }}>{regionWiseSales.total.customers}</td>
                  <td style={{ padding: '8px 4px', textAlign: 'center' }}>{regionWiseSales.total.invoices}</td>
                  <td style={{ padding: '8px 4px', textAlign: 'right', color: '#0E7490' }}>{regionWiseSales.total.salesLakhs}</td>
                </tr>
              </tfoot>
            </table>
            {regionWiseSales.isUsingFallback && (
              <div style={{ marginTop: '8px', fontSize: '10.5px', color: '#64748B', fontStyle: 'italic', textAlign: 'right' }}>
                * Showing latest confirmed orders &amp; invoices (0 orders yet for Nov 1). Select any period above to filter.
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ─── ROW 3: SALES TREND, PRODUCT PERFORMANCE, TOP 10 CUSTOMERS (3 COLUMNS) ─── */}
      <div className="sales-dashboard-grid-3" style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1.15fr 1fr 1.15fr', gap: '16px', width: '100%', alignItems: 'stretch' }}>
        {/* Card A: Actual vs Target Trend Chart */}
        <div className="section-card" style={{ padding: '16px 20px', backgroundColor: '#FFFFFF', border: '1px solid #EAEFEF', borderRadius: '16px', display: 'flex', flexDirection: 'column', height: '100%', boxSizing: 'border-box', boxShadow: '0 4px 18px rgba(15, 23, 42, 0.03)' }}>
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #F1F5F9', paddingBottom: '8px', marginBottom: '12px' }}>
              <span style={{ fontSize: '12px', fontWeight: '800', color: '#1E3A8A', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                LIVE SALES TREND (LAST 7 MONTHS)
              </span>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', color: '#0284C7', fontSize: '11px', fontWeight: '700' }}>
                  <span style={{ width: '8px', height: '8px', backgroundColor: '#0284C7', borderRadius: '2px' }}></span> Billed Revenue
                </span>
              </div>
            </div>

            {/* Chart Canvas with Y-Axis, Clean Rounded-Top Bars, and Dynamic Scaling */}
            <div style={{ display: 'flex', position: 'relative' }}>
              {/* Y-Axis Labels */}
              <div style={{
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                paddingRight: '10px',
                fontSize: '10px',
                fontWeight: '600',
                color: '#94A3B8',
                height: '220px',
                userSelect: 'none',
                textAlign: 'right',
                minWidth: '32px'
              }}>
                <span>{maxTrendLakhs} L</span>
                <span>{Math.round(maxTrendLakhs * 0.75)} L</span>
                <span>{Math.round(maxTrendLakhs * 0.5)} L</span>
                <span>{Math.round(maxTrendLakhs * 0.25)} L</span>
                <span>0 L</span>
              </div>

              {/* Bars Area */}
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', position: 'relative' }}>
                {/* Bar Columns Container */}
                <div style={{ height: '220px', display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: '8px', position: 'relative', zIndex: 4, padding: '0 4px' }}>
                  {monthlyTrendData.map((d) => {
                    const heightPct = maxTrendLakhs > 0 ? (d.actual / maxTrendLakhs) * 100 : 0;
                    const isHovered = hoveredTrendMonth === d.month;

                    return (
                      <div
                        key={d.month}
                        onMouseEnter={() => setHoveredTrendMonth(d.month)}
                        onMouseLeave={() => setHoveredTrendMonth(null)}
                        style={{
                          flex: 1,
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'center',
                          height: '100%',
                          justifyContent: 'flex-end',
                          position: 'relative',
                          cursor: 'pointer'
                        }}
                      >
                        {/* Tooltip visible on hover */}
                        {isHovered && (
                          <div style={{
                            position: 'absolute',
                            bottom: `${Math.min(85, Math.max(heightPct + 14, 25))}%`,
                            left: '50%',
                            transform: 'translateX(-50%)',
                            zIndex: 20,
                            backgroundColor: '#0F172A',
                            color: '#FFFFFF',
                            padding: '5px 10px',
                            borderRadius: '6px',
                            textAlign: 'center',
                            boxShadow: '0 4px 12px rgba(15, 23, 42, 0.25)',
                            whiteSpace: 'nowrap',
                            pointerEvents: 'none',
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            fontSize: '11px',
                            fontWeight: '700'
                          }}>
                            <span>₹ {d.actual} L</span>
                            <div style={{
                              position: 'absolute',
                              bottom: '-4px',
                              left: '50%',
                              transform: 'translateX(-50%)',
                              width: 0,
                              height: 0,
                              borderLeft: '4px solid transparent',
                              borderRight: '4px solid transparent',
                              borderTop: '4px solid #0F172A'
                            }} />
                          </div>
                        )}

                        {/* Top Label for non-zero value */}
                        {d.actual > 0 && (
                          <span style={{
                            fontSize: '9.5px',
                            fontWeight: '700',
                            color: isHovered ? '#0284C7' : '#64748B',
                            marginBottom: '4px',
                            userSelect: 'none',
                            transition: 'color 0.15s ease'
                          }}>
                            {d.actual >= 1 ? `${d.actual}L` : `${Math.round(d.actual * 100)}k`}
                          </span>
                        )}

                        {/* Stadium / Rounded-top Bar */}
                        <div
                          style={{
                            width: '26px',
                            maxWidth: '75%',
                            height: `${Math.max(d.actual > 0 ? 6 : 2, heightPct)}%`,
                            backgroundColor: '#0284C7',
                            backgroundImage: isHovered
                              ? 'linear-gradient(180deg, #38BDF8 0%, #0284C7 100%)'
                              : 'linear-gradient(180deg, #0284C7 0%, #0369A1 100%)',
                            borderRadius: d.actual > 0 ? '6px 6px 0 0' : '2px',
                            transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                            boxShadow: isHovered
                              ? '0 6px 14px rgba(2, 132, 199, 0.4)'
                              : d.actual > 0 ? '0 2px 5px rgba(2, 132, 199, 0.15)' : 'none',
                            transform: isHovered ? 'translateY(-2px)' : 'translateY(0)'
                          }}
                        />
                      </div>
                    );
                  })}
                </div>

                <div style={{ width: '100%', height: '2px', backgroundColor: '#E2E8F0', marginTop: '4px' }}></div>

                {/* Month Labels */}
                <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: '8px', paddingLeft: '4px', paddingRight: '4px', fontSize: '11px', color: '#64748B', fontWeight: '600' }}>
                  {monthlyTrendData.map(d => {
                    const isHovered = hoveredTrendMonth === d.month;
                    return (
                      <span
                        key={d.month}
                        onMouseEnter={() => setHoveredTrendMonth(d.month)}
                        onMouseLeave={() => setHoveredTrendMonth(null)}
                        style={{
                          flex: 1,
                          textAlign: 'center',
                          cursor: 'pointer',
                          color: isHovered ? '#0284C7' : '#64748B',
                          fontWeight: isHovered ? '800' : '600',
                          transition: 'color 0.2s ease'
                        }}
                      >
                        {d.month}
                      </span>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>

          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            paddingTop: '10px',
            marginTop: 'auto',
            borderTop: '1.5px solid #F1F5F9',
            fontSize: '11.5px',
            fontWeight: '800',
            color: '#1E3A8A',
            minHeight: '38px',
            boxSizing: 'border-box'
          }}>
            <div>Total 7-Month Sales</div>
            <div style={{ textAlign: 'right', color: '#1E3A8A' }}>
              ₹ {monthlyTrendData.reduce((s, d) => s + d.actual, 0).toFixed(1)} Lakhs
            </div>
          </div>
        </div>

        {/* Card B: Product Sale Comparison (Interactive Click-to-Drilldown to Sales Reports) */}
        <div className="section-card" style={{ padding: '16px 20px', backgroundColor: '#FFFFFF', border: '1px solid #EAEFEF', borderRadius: '16px', display: 'flex', flexDirection: 'column', height: '100%', boxSizing: 'border-box', boxShadow: '0 4px 18px rgba(15, 23, 42, 0.03)' }}>
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #F1F5F9', paddingBottom: '8px', marginBottom: '12px' }}>
              <span style={{ fontSize: '12px', fontWeight: '800', color: '#1E3A8A', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                PRODUCT SALE COMPARISON
              </span>
              <span style={{
                fontSize: '10.5px',
                fontWeight: '800',
                color: '#0E7490',
                backgroundColor: '#ECFEFF',
                border: '1px solid #A5F3FC',
                padding: '2px 8px',
                borderRadius: '12px'
              }}>
                By Category
              </span>
            </div>

            {/* List of Products with clean solid progress bars */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {productPerformance.map((p, idx) => {
                const pct = maxProductVal > 0 ? (p.actual / maxProductVal) * 100 : 0;

                return (
                  <div
                    key={idx}
                    onClick={() => handleOpenProductReport(p.name)}
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '4px',
                      cursor: 'pointer',
                      padding: '4px 6px',
                      borderRadius: '8px',
                      transition: 'background-color 0.15s ease'
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#F8FAFC'}
                    onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: '11.5px', fontWeight: '700', color: '#1E293B', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {p.name}
                      </span>
                      <span style={{ fontSize: '11px', fontWeight: '700', color: '#0E7490', flexShrink: 0 }}>
                        {p.actualStr}
                      </span>
                    </div>

                    {/* Uniform Progress Bar with Subtle Background Track */}
                    <div style={{
                      width: '100%',
                      height: '6px',
                      backgroundColor: '#F1F5F9',
                      borderRadius: '3px',
                      overflow: 'hidden'
                    }}>
                      {pct > 0 && (
                        <div
                          style={{
                            width: `${Math.max(2, Math.min(100, pct))}%`,
                            height: '100%',
                            borderRadius: '3px',
                            background: 'linear-gradient(90deg, #38BDF8 0%, #0284C7 60%, #0369A1 100%)',
                            transition: 'width 0.4s cubic-bezier(0.4, 0, 0.2, 1)'
                          }}
                        />
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div
            onClick={() => handleOpenProductReport('all')}
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              paddingTop: '10px',
              marginTop: 'auto',
              borderTop: '1.5px solid #F1F5F9',
              fontSize: '11.5px',
              fontWeight: '800',
              color: '#1E3A8A',
              cursor: 'pointer',
              minHeight: '38px',
              boxSizing: 'border-box',
              transition: 'color 0.15s ease'
            }}
          >
            <div>Total Products Billed</div>
            <div style={{ textAlign: 'right', color: '#0E7490', display: 'flex', alignItems: 'center', gap: '4px', fontWeight: '800' }}>
              <span>{formatLakhsCr(totalProductsBilledAmount)}</span>
              <ArrowRight size={13} />
            </div>
          </div>
        </div>

        {/* Card C: Top 10 Customers Month Sales Contribution */}
        <div className="section-card" style={{ padding: '16px 20px', backgroundColor: '#FFFFFF', border: '1px solid #EAEFEF', borderRadius: '16px', display: 'flex', flexDirection: 'column', height: '100%', boxSizing: 'border-box', boxShadow: '0 4px 18px rgba(15, 23, 42, 0.03)' }}>
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px', borderBottom: '1px solid #F1F5F9', paddingBottom: '8px' }}>
              <span style={{ fontSize: '12px', fontWeight: '800', color: '#1E3A8A', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                TOP 10 CUSTOMERS — SALES SHARE
              </span>
              <span style={{
                fontSize: '10.5px',
                fontWeight: '800',
                color: '#0E7490',
                backgroundColor: '#ECFEFF',
                border: '1px solid #A5F3FC',
                padding: '2px 8px',
                borderRadius: '12px'
              }}>
                Top 10
              </span>
            </div>

            <div style={{
              display: 'grid',
              gridTemplateColumns: '1.8fr 1fr 0.75fr',
              paddingBottom: '6px',
              paddingRight: '6px',
              borderBottom: '1px solid #E2E8F0',
              fontSize: '10.5px',
              fontWeight: '700',
              color: '#64748B'
            }}>
              <div>Customer</div>
              <div style={{ textAlign: 'right' }}>Sales Value</div>
              <div style={{ textAlign: 'right' }}>% Share</div>
            </div>

            <div 
              className="sleek-thin-scrollbar"
              style={{
                display: 'flex',
                flexDirection: 'column',
                maxHeight: '235px',
                overflowY: 'auto',
                paddingRight: '6px'
              }}
            >
              {topCustomers.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '24px 0', fontSize: '12px', color: '#94A3B8', fontStyle: 'italic' }}>
                  No customer invoices recorded yet for this period
                </div>
              ) : (
                topCustomers.map((c, idx) => {
                  const dotColors = [
                    '#16A34A', '#65A30D', '#84CC16', '#CA8A04', '#EA580C',
                    '#DC2626', '#EF4444', '#EC4899', '#8B5CF6', '#6366F1'
                  ];
                  const dotColor = dotColors[idx] || '#64748B';

                  return (
                    <div
                      key={c.rank}
                      style={{
                        display: 'grid',
                        gridTemplateColumns: '1.8fr 1fr 0.75fr',
                        alignItems: 'center',
                        padding: '4.5px 0',
                        borderBottom: '1px solid #F8FAFC',
                        fontSize: '11px',
                        lineHeight: '1.3'
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '7px', minWidth: 0, paddingRight: '4px' }}>
                        <span style={{
                          width: '6.5px',
                          height: '6.5px',
                          borderRadius: '50%',
                          backgroundColor: dotColor,
                          flexShrink: 0
                        }} />
                        <span 
                          title={c.name}
                          style={{ fontWeight: '600', color: '#1E293B', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}
                        >
                          {c.name}
                        </span>
                      </div>

                      <div style={{ textAlign: 'right', fontWeight: '600', color: '#1E293B', whiteSpace: 'nowrap' }}>
                        {c.value}
                      </div>

                      <div style={{ textAlign: 'right', color: '#64748B', fontWeight: '600', whiteSpace: 'nowrap' }}>
                        {c.share}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {topCustomers.length > 0 && (
            <div style={{
              display: 'grid',
              gridTemplateColumns: '1.8fr 1fr 0.75fr',
              alignItems: 'center',
              paddingTop: '10px',
              paddingRight: '6px',
              marginTop: 'auto',
              borderTop: '1.5px solid #F1F5F9',
              fontSize: '11.5px',
              fontWeight: '800',
              color: '#1E3A8A',
              minHeight: '38px',
              boxSizing: 'border-box'
            }}>
              <div>Total (Top 10)</div>
              <div style={{ textAlign: 'right', color: '#1E3A8A' }}>{formatLakhsCr(top10TotalVal)}</div>
              <div style={{ textAlign: 'right', color: '#1E3A8A' }}>
                {topCustomers.length > 0 ? (Math.min(100, topCustomers.reduce((acc, c) => acc + parseFloat(c.share || 0), 0)).toFixed(1) + '%') : '100%'}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ─── ROW 5: CUSTOMER OUTSTANDING & CREDIT + LOST / CANCELLED (50/50 SPLIT) ─── */}
      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: '16px', width: '100%', alignItems: 'stretch' }}>
        {/* Table A: Customer Outstanding and Credit Status */}
        <div className="section-card" style={{ padding: '16px 20px', backgroundColor: '#FFFFFF', border: '1px solid #EAEFEF', borderRadius: '16px', display: 'flex', flexDirection: 'column', height: '100%', justifyContent: 'space-between', gap: '12px', boxShadow: '0 4px 18px rgba(15, 23, 42, 0.03)' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid #F1F5F9', paddingBottom: '10px', marginBottom: '4px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '12px', fontWeight: '800', color: '#1E3A8A', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  CUSTOMER OUTSTANDING AND CREDIT STATUS
                </span>
                <span style={{
                  fontSize: '10px',
                  fontWeight: '800',
                  letterSpacing: '0.5px',
                  padding: '2px 8px',
                  borderRadius: '10px',
                  backgroundColor: '#EFF6FF',
                  color: '#1E40AF',
                  border: '1px solid #DBEAFE'
                }}>
                  {realOutstandingData.length} CUSTOMERS
                </span>
              </div>
            </div>

            <div style={{ border: '1px solid #F1F5F9', borderRadius: '12px', overflow: 'hidden', backgroundColor: '#FFFFFF' }}>
              {isMobile ? (
                /* Mobile Cards View: Full visibility with no cut-off columns */
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', padding: '10px' }}>
                  {currentOutstandingRows.length === 0 ? (
                    <div style={{ padding: '24px', textAlign: 'center', color: '#94A3B8', fontSize: '12px', fontStyle: 'italic' }}>
                      No customer invoices or outstandings recorded yet.
                    </div>
                  ) : (
                    currentOutstandingRows.map(c => (
                      <div key={c.id} style={{
                        backgroundColor: '#F8FAFC',
                        border: '1px solid #E2E8F0',
                        borderRadius: '12px',
                        padding: '12px 14px',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '8px'
                      }}>
                        {/* Customer Name & Credit Status Pill */}
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px' }}>
                          <span style={{ fontSize: '13px', fontWeight: '800', color: '#0F172A', lineHeight: 1.3 }}>
                            {c.customer}
                          </span>
                          <span style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px',
                            padding: '3px 10px',
                            borderRadius: '14px',
                            fontSize: '11px',
                            fontWeight: '700',
                            flexShrink: 0,
                            backgroundColor: c.creditStatus === 'Within limit' ? '#ECFDF5' : c.creditStatus.includes('used') ? '#FFFBEB' : '#FEF2F2',
                            border: `1px solid ${c.creditStatus === 'Within limit' ? '#D1FAE5' : c.creditStatus.includes('used') ? '#FEF3C7' : '#FEE2E2'}`,
                            color: c.creditStatus === 'Within limit' ? '#059669' : c.creditStatus.includes('used') ? '#D97706' : '#DC2626'
                          }}>
                            {c.creditStatus}
                          </span>
                        </div>

                        {/* All 4 Metrics: Invoiced, Outstanding, Overdue, Credit Limit */}
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '6px', paddingTop: '8px', borderTop: '1px solid #E2E8F0' }}>
                          <div>
                            <div style={{ fontSize: '10px', fontWeight: '700', color: '#64748B', textTransform: 'uppercase' }}>Invoiced</div>
                            <div style={{ fontSize: '12px', fontWeight: '700', color: '#334155', marginTop: '2px' }}>{c.invoiced}</div>
                          </div>
                          <div>
                            <div style={{ fontSize: '10px', fontWeight: '700', color: '#64748B', textTransform: 'uppercase' }}>Outstanding</div>
                            <div style={{ fontSize: '12px', fontWeight: '800', color: '#0F172A', marginTop: '2px' }}>{c.outstanding}</div>
                          </div>
                          <div>
                            <div style={{ fontSize: '10px', fontWeight: '700', color: '#64748B', textTransform: 'uppercase' }}>Overdue</div>
                            <div style={{ fontSize: '12px', fontWeight: '800', color: c.overdue !== '—' ? '#DC2626' : '#64748B', marginTop: '2px' }}>{c.overdue}</div>
                          </div>
                          <div>
                            <div style={{ fontSize: '10px', fontWeight: '700', color: '#64748B', textTransform: 'uppercase' }}>Credit Limit</div>
                            <div style={{ fontSize: '12px', fontWeight: '700', color: '#64748B', marginTop: '2px' }}>{c.creditLimit}</div>
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              ) : (
                <div style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
                  <table style={{ width: '100%', minWidth: '600px', borderCollapse: 'collapse', fontSize: '12px' }}>
                    <thead>
                      <tr style={{ backgroundColor: '#F8FAFC', borderBottom: '1px solid #F1F5F9' }}>
                        <th style={{ padding: '10px 14px', fontWeight: '700', color: '#64748B', fontSize: '11px', textAlign: 'left', minWidth: '180px' }}>
                          Customer
                        </th>
                        <th style={{ padding: '10px 14px', fontWeight: '700', color: '#64748B', fontSize: '11px', textAlign: 'right', minWidth: '80px' }}>Invoiced</th>
                        <th style={{ padding: '10px 14px', fontWeight: '700', color: '#64748B', fontSize: '11px', textAlign: 'right', minWidth: '90px' }}>Outstanding</th>
                        <th style={{ padding: '10px 14px', fontWeight: '700', color: '#64748B', fontSize: '11px', textAlign: 'right', minWidth: '80px' }}>Overdue</th>
                        <th style={{ padding: '10px 14px', fontWeight: '700', color: '#64748B', fontSize: '11px', textAlign: 'right', minWidth: '90px' }}>Credit Limit</th>
                        <th style={{ padding: '10px 14px', fontWeight: '700', color: '#64748B', fontSize: '11px', textAlign: 'center', minWidth: '110px' }}>Credit Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {currentOutstandingRows.length === 0 ? (
                        <tr>
                          <td colSpan={6} style={{ padding: '24px', textAlign: 'center', color: '#94A3B8', fontSize: '12px', fontStyle: 'italic' }}>
                            No customer invoices or outstandings recorded yet.
                          </td>
                        </tr>
                      ) : (
                        currentOutstandingRows.map(c => (
                          <tr key={c.id} className="table-row-hover" style={{ borderBottom: '1px solid #F1F5F9' }}>
                            <td style={{ padding: '10px 14px', fontWeight: '700', color: '#1E293B', minWidth: '180px', whiteSpace: 'normal', wordBreak: 'break-word' }} title={c.customer}>
                              {c.customer}
                            </td>
                            <td style={{ padding: '10px 14px', textAlign: 'right', color: '#475569', whiteSpace: 'nowrap' }}>{c.invoiced}</td>
                            <td style={{ padding: '10px 14px', textAlign: 'right', fontWeight: '700', color: '#1E293B', whiteSpace: 'nowrap' }}>{c.outstanding}</td>
                            <td style={{ padding: '10px 14px', textAlign: 'right', fontWeight: '700', color: c.overdue !== '—' ? '#DC2626' : '#64748B', whiteSpace: 'nowrap' }}>{c.overdue}</td>
                            <td style={{ padding: '10px 14px', textAlign: 'right', color: '#64748B', whiteSpace: 'nowrap' }}>{c.creditLimit}</td>
                            <td style={{ padding: '10px 14px', textAlign: 'center', whiteSpace: 'nowrap' }}>
                              <span style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '4px',
                                padding: '3px 10px',
                                borderRadius: '14px',
                                fontSize: '11px',
                                fontWeight: '700',
                                backgroundColor: c.creditStatus === 'Within limit' ? '#ECFDF5' : c.creditStatus.includes('used') ? '#FFFBEB' : '#FEF2F2',
                                border: `1px solid ${c.creditStatus === 'Within limit' ? '#D1FAE5' : c.creditStatus.includes('used') ? '#FEF3C7' : '#FEE2E2'}`,
                                color: c.creditStatus === 'Within limit' ? '#059669' : c.creditStatus.includes('used') ? '#D97706' : '#DC2626'
                              }}>
                                {c.creditStatus}
                              </span>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Table B: Lost and Cancelled Opportunities */}
        <div className="section-card" style={{ padding: '16px 20px', backgroundColor: '#FFFFFF', border: '1px solid #EAEFEF', borderRadius: '16px', display: 'flex', flexDirection: 'column', height: '100%', justifyContent: 'space-between', gap: '12px', boxShadow: '0 4px 18px rgba(15, 23, 42, 0.03)' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', borderBottom: '1px solid #F1F5F9', paddingBottom: '10px', marginBottom: '4px' }}>
              <span style={{ fontSize: '12px', fontWeight: '800', color: '#1E3A8A', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                LOST AND CANCELLED OPPORTUNITIES — {selectedPeriod.toUpperCase()}
              </span>
              <span style={{
                fontSize: '10px',
                fontWeight: '800',
                letterSpacing: '0.5px',
                padding: '2px 8px',
                borderRadius: '10px',
                backgroundColor: realLostCancelledData.length > 0 ? '#FEF2F2' : '#F0FDF4',
                color: realLostCancelledData.length > 0 ? '#DC2626' : '#166534',
                border: `1px solid ${realLostCancelledData.length > 0 ? '#FEE2E2' : '#BBF7D0'}`
              }}>
                {realLostCancelledData.length} DEALS
              </span>
            </div>

            <div style={{ border: '1px solid #F1F5F9', borderRadius: '12px', overflow: 'hidden', backgroundColor: '#FFFFFF' }}>
              {isMobile ? (
                /* Mobile Cards View for Lost & Cancelled Deals */
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', padding: '10px' }}>
                  {realLostCancelledData.length === 0 ? (
                    <div style={{ padding: '24px 16px', textAlign: 'center', color: '#166534', backgroundColor: '#F0FDF4', borderRadius: '10px' }}>
                      <CheckCircle size={24} style={{ margin: '0 auto 6px auto', display: 'block', color: '#16A34A' }} />
                      <strong style={{ fontSize: '13px' }}>Zero lost or cancelled opportunities in this period!</strong>
                      <p style={{ margin: '4px 0 0 0', fontSize: '11.5px', color: '#15803D' }}>
                        100% active deal conversion velocity across your pipeline.
                      </p>
                    </div>
                  ) : (
                    realLostCancelledData.map(l => (
                      <div key={l.id} style={{
                        backgroundColor: '#F8FAFC',
                        border: '1px solid #E2E8F0',
                        borderRadius: '12px',
                        padding: '12px 14px',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '8px'
                      }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px' }}>
                          <span style={{ fontSize: '13px', fontWeight: '800', color: '#0F172A', lineHeight: 1.3 }}>
                            {l.opportunity}
                          </span>
                          <span style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px',
                            padding: '3px 10px',
                            borderRadius: '14px',
                            fontSize: '11px',
                            fontWeight: '700',
                            flexShrink: 0,
                            backgroundColor: l.status === 'Lost' ? '#FEF2F2' : '#F1F5F9',
                            border: `1px solid ${l.status === 'Lost' ? '#FEE2E2' : '#E2E8F0'}`,
                            color: l.status === 'Lost' ? '#DC2626' : '#64748B'
                          }}>
                            {l.status}
                          </span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '6px', borderTop: '1px solid #E2E8F0', fontSize: '12px' }}>
                          <div>
                            <span style={{ color: '#64748B', fontSize: '11px' }}>Reason: </span>
                            <strong style={{ color: '#334155' }}>{l.reason}</strong>
                          </div>
                          <div>
                            <span style={{ color: '#64748B', fontSize: '11px' }}>Value: </span>
                            <strong style={{ color: '#0F172A', fontSize: '13px' }}>{l.value}</strong>
                          </div>
                        </div>
                        {l.closedDate && (
                          <div style={{ fontSize: '11px', color: '#94A3B8', textAlign: 'right' }}>
                            Date: {l.closedDate}
                          </div>
                        )}
                      </div>
                    ))
                  )}
                  {realLostCancelledData.length > 0 && (
                    <div style={{ padding: '8px 10px', backgroundColor: '#FEF2F2', borderRadius: '8px', textAlign: 'right', fontSize: '11px', color: '#DC2626', fontWeight: '700' }}>
                      Total lost / cancelled value: {formatLakhsCr(totalLostVal)}
                    </div>
                  )}
                </div>
              ) : (
                <div style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
                  <table style={{ width: '100%', minWidth: '560px', borderCollapse: 'collapse', fontSize: '12px' }}>
                    <thead>
                      <tr style={{ backgroundColor: '#F8FAFC', borderBottom: '1px solid #F1F5F9' }}>
                        <th style={{ padding: '10px 14px', fontWeight: '700', color: '#64748B', fontSize: '11px', textAlign: 'left', minWidth: '160px' }}>
                          Opportunity
                        </th>
                        <th style={{ padding: '10px 14px', fontWeight: '700', color: '#64748B', fontSize: '11px', textAlign: 'right', minWidth: '80px' }}>Value</th>
                        <th style={{ padding: '10px 14px', fontWeight: '700', color: '#64748B', fontSize: '11px', textAlign: 'center', minWidth: '90px' }}>Status</th>
                        <th style={{ padding: '10px 14px', fontWeight: '700', color: '#64748B', fontSize: '11px', textAlign: 'left', minWidth: '120px' }}>Reason</th>
                        <th style={{ padding: '10px 14px', fontWeight: '700', color: '#64748B', fontSize: '11px', textAlign: 'right', minWidth: '90px' }}>Date</th>
                      </tr>
                    </thead>
                    <tbody>
                      {realLostCancelledData.length === 0 ? (
                        <tr>
                          <td colSpan={5} style={{ padding: '32px 16px', textAlign: 'center', color: '#166534', backgroundColor: '#F0FDF4' }}>
                            <CheckCircle size={24} style={{ margin: '0 auto 6px auto', display: 'block', color: '#16A34A' }} />
                            <strong style={{ fontSize: '13px' }}>Zero lost or cancelled opportunities in this period!</strong>
                            <p style={{ margin: '4px 0 0 0', fontSize: '11.5px', color: '#15803D' }}>
                              100% active deal conversion velocity across your pipeline.
                            </p>
                          </td>
                        </tr>
                      ) : (
                        realLostCancelledData.map(l => (
                          <tr key={l.id} className="table-row-hover" style={{ borderBottom: '1px solid #F1F5F9' }}>
                            <td style={{ padding: '10px 14px', fontWeight: '700', color: '#1E293B', minWidth: '160px', whiteSpace: 'normal', wordBreak: 'break-word' }}>{l.opportunity}</td>
                            <td style={{ padding: '10px 14px', textAlign: 'right', fontWeight: '700', color: '#1E293B', whiteSpace: 'nowrap' }}>{l.value}</td>
                            <td style={{ padding: '10px 14px', textAlign: 'center', whiteSpace: 'nowrap' }}>
                              <span style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '4px',
                                padding: '3px 10px',
                                borderRadius: '14px',
                                fontSize: '11px',
                                fontWeight: '700',
                                backgroundColor: l.status === 'Lost' ? '#FEF2F2' : '#F1F5F9',
                                border: `1px solid ${l.status === 'Lost' ? '#FEE2E2' : '#E2E8F0'}`,
                                color: l.status === 'Lost' ? '#DC2626' : '#64748B'
                              }}>
                                {l.status}
                              </span>
                            </td>
                            <td style={{ padding: '10px 14px', color: '#64748B', whiteSpace: 'normal', wordBreak: 'break-word' }}>{l.reason}</td>
                            <td style={{ padding: '10px 14px', textAlign: 'right', color: '#94A3B8', whiteSpace: 'nowrap' }}>{l.closedDate}</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                  {realLostCancelledData.length > 0 && (
                    <div style={{ padding: '10px 14px', backgroundColor: '#F8FAFC', borderTop: '1px solid #F1F5F9', textAlign: 'right', fontSize: '11px', color: '#DC2626', fontWeight: '700' }}>
                      Total lost / cancelled value: {formatLakhsCr(totalLostVal)}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ─── ROW 6: OPPORTUNITY RISK & CUSTOMER SALES MIX ─── */}
      <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "repeat(auto-fit, minmax(380px, 1fr))", gap: "16px", width: "100%", alignItems: "stretch" }}>
        {/* Card A: Opportunity Risk & Expiry Alerts */}
          <div className="section-card" style={{ padding: '16px 20px', backgroundColor: '#FFFFFF', border: '1px solid #EAEFEF', borderRadius: '16px', display: 'flex', flexDirection: 'column', gap: '12px', boxShadow: '0 4px 18px rgba(15, 23, 42, 0.03)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', borderBottom: '1px solid #F1F5F9', paddingBottom: '8px', marginBottom: '4px' }}>
              <span style={{ fontSize: '12px', fontWeight: '800', color: '#1E3A8A', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                OPPORTUNITY RISK AND EXPIRY ALERTS
              </span>
              <span style={{
                fontSize: '10px',
                fontWeight: '800',
                letterSpacing: '0.5px',
                padding: '2px 8px',
                borderRadius: '10px',
                backgroundColor: inactiveOpportunities.length + expiringQuotations.length > 0 ? '#FEF2F2' : '#F0FDF4',
                color: inactiveOpportunities.length + expiringQuotations.length > 0 ? '#DC2626' : '#166534',
                border: `1px solid ${inactiveOpportunities.length + expiringQuotations.length > 0 ? '#FEE2E2' : '#BBF7D0'}`
              }}>
                {inactiveOpportunities.length + expiringQuotations.length > 0 ? 'ATTENTION NEEDED' : 'CLEAR'}
              </span>
            </div>

            {/* Inactive Alert Sub-block */}
            <div>
              <div style={{ fontSize: '11px', fontWeight: '800', color: '#DC2626', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                <Clock size={12} /> Inactive Above 10 Days
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                {inactiveOpportunities.length === 0 ? (
                  <div style={{ padding: '8px 12px', backgroundColor: '#F0FDF4', borderRadius: '8px', border: '1px solid #DCFCE7', fontSize: '11.5px', color: '#166534', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <CheckCircle2 size={13} style={{ color: '#16A34A', flexShrink: 0 }} /> All pipeline opportunities have recent activity within the last 10 days.
                  </div>
                ) : (
                  inactiveOpportunities.map((item, idx) => (
                    <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '7px 12px', backgroundColor: '#F8FAFC', borderRadius: '8px', border: '1px solid #F1F5F9' }}>
                      <span style={{ fontWeight: '700', color: '#1E293B', fontSize: '11.5px' }}>{item.customerName || item.title}</span>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <span style={{ fontWeight: '700', color: '#1E293B', fontSize: '11.5px' }}>{formatLakhsCr(parseAmt(item.dealValue))}</span>
                        <span style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '4px',
                          padding: '3px 8px',
                          borderRadius: '12px',
                          backgroundColor: '#FEF2F2',
                          border: '1px solid #FEE2E2',
                          color: '#DC2626',
                          fontSize: '10.5px',
                          fontWeight: '700'
                        }}>
                          <Clock size={10} /> Inactive
                        </span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Expiring Alert Sub-block */}
            <div>
              <div style={{ fontSize: '11px', fontWeight: '800', color: '#D97706', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                <Clock size={12} /> Offers Expiring Soon
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                {expiringQuotations.length === 0 ? (
                  <div style={{ padding: '8px 12px', backgroundColor: '#F0FDF4', borderRadius: '8px', border: '1px solid #DCFCE7', fontSize: '11.5px', color: '#166534', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <CheckCircle2 size={13} style={{ color: '#16A34A', flexShrink: 0 }} /> No active quotations approaching immediate expiration this week.
                  </div>
                ) : (
                  expiringQuotations.map((item, idx) => (
                    <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '7px 12px', backgroundColor: '#F8FAFC', borderRadius: '8px', border: '1px solid #F1F5F9' }}>
                      <span style={{ fontWeight: '700', color: '#1E293B', fontSize: '11.5px' }}>{item.customerName || item.quoteNumber}</span>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <span style={{ fontWeight: '700', color: '#1E293B', fontSize: '11.5px' }}>{formatLakhsCr(parseAmt(item.grandTotal || item.total))}</span>
                        <span style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '4px',
                          padding: '3px 8px',
                          borderRadius: '12px',
                          backgroundColor: '#FFFBEB',
                          border: '1px solid #FEF3C7',
                          color: '#D97706',
                          fontSize: '10.5px',
                          fontWeight: '700'
                        }}>
                          <Clock size={10} /> {item.validUntil || 'Expiring soon'}
                        </span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

          {/* Card B: SEPARATE SECTION CARD — CUSTOMER SALES MIX */}
          <div className="section-card" style={{ padding: '16px 20px', backgroundColor: '#FFFFFF', border: '1px solid #EAEFEF', borderRadius: '16px', display: 'flex', flexDirection: 'column', gap: '10px', boxShadow: '0 4px 18px rgba(15, 23, 42, 0.03)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #F1F5F9', paddingBottom: '8px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', fontWeight: '800', color: '#1E3A8A', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                <Users size={13} style={{ color: '#0E7490' }} />
                <span>CUSTOMER SALES MIX</span>
              </div>
              <button
                type="button"
                onClick={() => onNavigateTab && onNavigateTab('Monthly Customers by Rep')}
                style={{ fontSize: '10.5px', color: '#0E7490', fontWeight: '800', backgroundColor: '#ECFEFF', border: '1px solid #CFFAFE', padding: '2px 8px', borderRadius: '12px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}
                title="View New Monthly Customers report"
              >
                New Monthly Customers ↗
              </button>
            </div>

            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11.5px', textAlign: 'left' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid #E2E8F0', color: '#64748B', fontWeight: '700' }}>
                  <th style={{ padding: '6px 4px' }}>Type</th>
                  <th style={{ padding: '6px 4px', textAlign: 'center' }}>Customers</th>
                  <th style={{ padding: '6px 4px', textAlign: 'right' }}>Sales (₹ Lakh)</th>
                  <th style={{ padding: '6px 4px', textAlign: 'right' }}>% of sales</th>
                </tr>
              </thead>
              <tbody>
                <tr
                  onClick={() => onNavigateTab && onNavigateTab('Monthly Customers by Rep')}
                  style={{ borderBottom: '1px solid #F8FAFC', cursor: onNavigateTab ? 'pointer' : 'default', backgroundColor: '#F0FDFA' }}
                  title="Click to view New Monthly Customers"
                >
                  <td style={{ padding: '6px 4px', color: '#0E7490', fontWeight: '700', textDecoration: 'underline' }}>New customers ↗</td>
                  <td style={{ padding: '6px 4px', textAlign: 'center', color: '#0F766E', fontWeight: '800' }}>{customerSalesMix.newCustomers.count}</td>
                  <td style={{ padding: '6px 4px', textAlign: 'right', fontWeight: '700', color: '#0E7490' }}>{customerSalesMix.newCustomers.salesLakhs}</td>
                  <td style={{ padding: '6px 4px', textAlign: 'right', color: '#64748B', fontWeight: '600' }}>{customerSalesMix.newCustomers.pct}</td>
                </tr>
                <tr style={{ borderBottom: '1px solid #F8FAFC' }}>
                  <td style={{ padding: '6px 4px', color: '#1E293B', fontWeight: '600' }}>Existing customers</td>
                  <td style={{ padding: '6px 4px', textAlign: 'center', color: '#475569' }}>{customerSalesMix.existingCustomers.count}</td>
                  <td style={{ padding: '6px 4px', textAlign: 'right', fontWeight: '700', color: '#0E7490' }}>{customerSalesMix.existingCustomers.salesLakhs}</td>
                  <td style={{ padding: '6px 4px', textAlign: 'right', color: '#64748B', fontWeight: '600' }}>{customerSalesMix.existingCustomers.pct}</td>
                </tr>
              </tbody>
              <tfoot>
                <tr style={{ borderTop: '1.5px solid #E2E8F0', fontWeight: '800', color: '#1E3A8A' }}>
                  <td style={{ padding: '7px 4px' }}>Total</td>
                  <td style={{ padding: '7px 4px', textAlign: 'center' }}>{customerSalesMix.total.count}</td>
                  <td style={{ padding: '7px 4px', textAlign: 'right', color: '#0E7490' }}>{customerSalesMix.total.salesLakhs}</td>
                  <td style={{ padding: '7px 4px', textAlign: 'right' }}>100%</td>
                </tr>
              </tfoot>
            </table>

            <div style={{ fontSize: '10.5px', color: '#94A3B8', fontStyle: 'italic', textAlign: 'right', marginTop: '2px' }}>
              Ratio of first-time vs repeat customer revenue in this period.
            </div>
          </div>
      </div>

      {showTargetModal && (
        <div style={{
          position: 'fixed',
          inset: 0,
          backgroundColor: 'rgba(15, 23, 42, 0.65)',
          backdropFilter: 'blur(4px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 9999,
          padding: '16px'
        }}>
          <div style={{
            backgroundColor: '#FFFFFF',
            borderRadius: '18px',
            width: '100%',
            maxWidth: '480px',
            boxShadow: '0 20px 40px rgba(0,0,0,0.2)',
            overflow: 'hidden',
            border: '1px solid #CBD5E1',
            fontFamily: "'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, sans-serif"
          }}>
            {/* Modal Header */}
            <div style={{
              padding: '16px 20px',
              backgroundColor: '#0E7490',
              color: '#FFFFFF',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center'
            }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '15px', fontWeight: '800', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Target size={18} style={{ color: '#FFFFFF' }} /> Set Monthly Sales Target
                </h3>
                <span style={{ fontSize: '11px', opacity: 0.9, marginTop: '2px', display: 'block' }}>
                  Authorized CEO & MD Target Configuration
                </span>
              </div>
              <button
                type="button"
                onClick={() => setShowTargetModal(false)}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: '#FFFFFF',
                  cursor: 'pointer',
                  padding: '4px',
                  display: 'flex',
                  alignItems: 'center',
                  borderRadius: '6px'
                }}
              >
                <X size={18} />
              </button>
            </div>

            {/* Modal Body */}
            <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <label htmlFor="sales-executive-dashboard-target-modal-rep" style={{ fontSize: '11px', fontWeight: '800', color: '#475569', textTransform: 'uppercase', display: 'block', marginBottom: '6px' }}>
                  Target Scope / Sales Representative
                </label>
                <select id="sales-executive-dashboard-target-modal-rep" name="targetModalRep" aria-label="Target Scope / Sales Representative"
                  value={targetModalRep}
                  onChange={(e) => {
                    const newRep = e.target.value;
                    setTargetModalRep(newRep);
                    const currentVal = newRep === 'All'
                      ? (ceoTargetStore?.repTargets?.['All'] || ceoTargetStore?.monthlyCompanyTarget || 18000000)
                      : (ceoTargetStore?.repTargets?.[newRep] || ceoTargetStore?.monthlyCompanyTarget || 18000000);
                    setTargetModalValue(String(currentVal));
                  }}
                  style={{
                    width: '100%',
                    height: '38px',
                    borderRadius: '10px',
                    border: '1px solid #CBD5E1',
                    padding: '0 12px',
                    fontSize: '13px',
                    fontWeight: '700',
                    color: '#0F172A',
                    backgroundColor: '#F8FAFC'
                  }}
                >
                  <option value="All">All Sales Reps (Company Monthly Target)</option>
                  {availableExecutives.filter(e => e !== 'All').map(e => (
                    <option key={e} value={e}>{e}</option>
                  ))}
                </select>
              </div>

              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                  <label style={{ fontSize: '11px', fontWeight: '800', color: '#475569', textTransform: 'uppercase' }}>
                    Monthly Target Amount (₹)
                  </label>
                  <span style={{ fontSize: '13px', fontWeight: '900', color: '#0E7490' }}>
                    {formatLakhsCr(parseAmt(targetModalValue))}
                  </span>
                </div>
                <input id="sales-executive-dashboard-target-modal-value" name="targetModalValue" aria-label="Enter amount in ₹ ( 18000000)"
                  type="number"
                  value={targetModalValue}
                  onChange={(e) => setTargetModalValue(e.target.value)}
                  placeholder="Enter amount in ₹ (e.g. 18000000)"
                  style={{
                    width: '100%',
                    height: '42px',
                    borderRadius: '10px',
                    border: '2px solid #0E7490',
                    padding: '0 12px',
                    fontSize: '15px',
                    fontWeight: '800',
                    color: '#0F172A',
                    boxSizing: 'border-box'
                  }}
                 />
              </div>

              {/* Quick Presets */}
              <div>
                <span style={{ fontSize: '10.5px', fontWeight: '700', color: '#64748B', display: 'block', marginBottom: '6px' }}>
                  Quick Presets:
                </span>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                  {[
                    { label: '₹ 50 L', val: 5000000 },
                    { label: '₹ 75 L', val: 7500000 },
                    { label: '₹ 1.0 Cr', val: 10000000 },
                    { label: '₹ 1.4 Cr', val: 14000000 },
                    { label: '₹ 1.8 Cr', val: 18000000 },
                    { label: '₹ 2.5 Cr', val: 25000000 },
                    { label: '₹ 3.5 Cr', val: 35000000 },
                    { label: '₹ 5.0 Cr', val: 50000000 }
                  ].map(preset => (
                    <button
                      key={preset.val}
                      type="button"
                      onClick={() => setTargetModalValue(String(preset.val))}
                      style={{
                        padding: '4px 10px',
                        borderRadius: '8px',
                        border: Number(targetModalValue) === preset.val ? '1px solid #0E7490' : '1px solid #E2E8F0',
                        backgroundColor: Number(targetModalValue) === preset.val ? '#ECFEFF' : '#F8FAFC',
                        color: Number(targetModalValue) === preset.val ? '#0E7490' : '#475569',
                        fontSize: '11px',
                        fontWeight: '800',
                        cursor: 'pointer'
                      }}
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div style={{
              padding: '14px 20px',
              backgroundColor: '#F8FAFC',
              borderTop: '1px solid #E2E8F0',
              display: 'flex',
              justifyContent: 'flex-end',
              gap: '10px'
            }}>
              <button
                type="button"
                onClick={() => setShowTargetModal(false)}
                style={{
                  padding: '8px 16px',
                  borderRadius: '10px',
                  border: '1px solid #CBD5E1',
                  backgroundColor: '#FFFFFF',
                  color: '#475569',
                  fontSize: '12px',
                  fontWeight: '700',
                  cursor: 'pointer'
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isSavingTarget || parseAmt(targetModalValue) <= 0}
                onClick={() => handleSaveCeoTarget(targetModalRep, parseAmt(targetModalValue))}
                style={{
                  padding: '8px 20px',
                  borderRadius: '10px',
                  border: 'none',
                  backgroundColor: isSavingTarget ? '#94A3B8' : '#0E7490',
                  color: '#FFFFFF',
                  fontSize: '12px',
                  fontWeight: '800',
                  cursor: isSavingTarget ? 'not-allowed' : 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  boxShadow: '0 2px 6px rgba(14, 116, 144, 0.25)'
                }}
              >
                {isSavingTarget ? (
                  <>
                    <RefreshCw size={13} style={{ animation: 'spin 1s linear infinite' }} /> Saving...
                  </>
                ) : (
                  <>
                    <Check size={14} /> Set & Apply Target
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
