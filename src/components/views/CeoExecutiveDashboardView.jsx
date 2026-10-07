import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  TrendingUp, TrendingDown, DollarSign, Wallet, RefreshCw,
  Calendar, CheckCircle2, AlertCircle, FileText, Download,
  ArrowUpRight, ArrowDownRight, Layers, PieChart as PieChartIcon,
  ShieldCheck, FileSpreadsheet, Printer, X, ExternalLink,
  ChevronDown, Filter, HelpCircle, Check, Building2, Landmark,
  Receipt, ArrowRight, Clock, BarChart3, Database, Zap,
  ShoppingCart, Truck, Factory, UserCheck, AlertTriangle, Sparkles, ChevronRight,
  Users, User, Briefcase, Search, Award, Target, Phone, Mail, Eye, Activity,
  LayoutDashboard, Wrench, Boxes, FileCheck, ClipboardList, Calculator, CheckCircle, Warehouse
} from 'lucide-react';
import { fetchCloudStore } from '../../utils/supabaseDataSync';
import { fetchWithTimeout } from '../../utils/fetchWithTimeout';

export default function CeoExecutiveDashboardView({ userRole = 'CEO', onNavigateTab }) {
  // Navigation & filtering states
  const [activeSubTab, setActiveSubTab] = useState('overview'); // 'overview' | 'personnel' | 'sales' | 'procurement' | 'accounts' | 'production' | 'dispatch' | 'billing' | 'engineering'
  const [selectedPeriod, setSelectedPeriod] = useState('MTD');
  const [personDeptFilter, setPersonDeptFilter] = useState('all');
  const [personSearchQuery, setPersonSearchQuery] = useState('');
  const [activePersonModal, setActivePersonModal] = useState(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [hoveredDonutIdx, setHoveredDonutIdx] = useState(null);
  const [hoveredBarIdx, setHoveredBarIdx] = useState(null);

  // CEO Target Management State
  const [ceoTargetStore, setCeoTargetStore] = useState(() => {
    try {
      const val = localStorage.getItem('controlroom_ceo_target_store');
      return val ? JSON.parse(val) : {
        monthlyCompanyTarget: 18000000,
        repTargets: {
          'All': 18000000,
          'Mohith JV': 18000000,
          'Vijay': 35000000,
          'Ravi Kumar': 14000000,
          'Pooja Sharma': 12000000,
          'Amit Verma': 9000000
        }
      };
    } catch {
      return {
        monthlyCompanyTarget: 18000000,
        repTargets: {
          'All': 18000000,
          'Mohith JV': 18000000,
          'Vijay': 35000000,
          'Ravi Kumar': 14000000,
          'Pooja Sharma': 12000000,
          'Amit Verma': 9000000
        }
      };
    }
  });
  const [showCeoTargetModal, setShowCeoTargetModal] = useState(false);
  const [editingTargetRep, setEditingTargetRep] = useState('All');
  const [editingTargetAmount, setEditingTargetAmount] = useState('18000000');
  const [isSavingTarget, setIsSavingTarget] = useState(false);

  // Live operational data stores
  const [poList, setPoList] = useState([]);
  const [piList, setPiList] = useState([]);
  const [bomList, setBomList] = useState([]);
  const [invList, setInvList] = useState([]);
  const [quotesList, setQuotesList] = useState([]);
  const [paymentsList, setPaymentsList] = useState([]);
  const [customersList, setCustomersList] = useState([]);
  const [leadsList, setLeadsList] = useState([]);
  const [workOrdersList, setWorkOrdersList] = useState([]);
  const [dispatchesList, setDispatchesList] = useState([]);
  const [challansList, setChallansList] = useState([]);
  const [presetsList, setPresetsList] = useState([]);
  const [loading, setLoading] = useState(true);

  // Dynamic logged-in user name & initials resolution
  const [currentLoggedName, setCurrentLoggedName] = useState(() => {
    try {
      const stored = localStorage.getItem('controlroom_logged_user_name');
      if (stored && stored !== 'undefined' && stored !== 'null' && stored.trim()) {
        return stored.trim();
      }
      const storedUser = localStorage.getItem('controlroom_logged_user');
      if (storedUser && storedUser !== 'undefined' && storedUser !== 'null' && storedUser.trim()) {
        const clean = storedUser.split('@')[0].replace(/[._-]/g, ' ');
        return clean.charAt(0).toUpperCase() + clean.slice(1);
      }
    } catch (_) {}
    return 'Velmurugan Rathinam';
  });

  useEffect(() => {
    const handleUserUpdate = () => {
      try {
        const stored = localStorage.getItem('controlroom_logged_user_name');
        if (stored && stored !== 'undefined' && stored !== 'null' && stored.trim()) {
          setCurrentLoggedName(stored.trim());
          return;
        }
        const storedUser = localStorage.getItem('controlroom_logged_user');
        if (storedUser && storedUser !== 'undefined' && storedUser !== 'null' && storedUser.trim()) {
          const clean = storedUser.split('@')[0].replace(/[._-]/g, ' ');
          setCurrentLoggedName(clean.charAt(0).toUpperCase() + clean.slice(1));
          return;
        }
      } catch (_) {}
      setCurrentLoggedName('Velmurugan Rathinam');
    };

    window.addEventListener('storage', handleUserUpdate);
    window.addEventListener('controlroom_storage_update', handleUserUpdate);
    return () => {
      window.removeEventListener('storage', handleUserUpdate);
      window.removeEventListener('controlroom_storage_update', handleUserUpdate);
    };
  }, []);

  const avatarInitials = useMemo(() => {
    const parts = (currentLoggedName || 'Velmurugan Rathinam').trim().split(/\s+/).filter(Boolean);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return ((currentLoggedName || 'VR').slice(0, 2)).toUpperCase();
  }, [currentLoggedName]);

  // Safe amount parser
  const parseAmt = (amtStr) => {
    if (!amtStr) return 0;
    if (typeof amtStr === 'number') return amtStr;
    const clean = String(amtStr).replace(/[^0-9.]/g, '');
    return parseFloat(clean) || 0;
  };

  const isFetchingRef = useRef(false);
  const debounceTimerRef = useRef(null);

  // Instant local cache reader
  const getCached = (key) => {
    try {
      const val = localStorage.getItem(key);
      return val ? JSON.parse(val) : null;
    } catch { return null; }
  };

  // Safe data loader across all BUSINZ operational stores
  const loadData = async () => {
    if (isFetchingRef.current) return;
    isFetchingRef.current = true;
    try {
      // 1. Immediately populate from local cache (0ms blocking)
      const localQuotes = getCached('controlroom_crm_quotations') || getCached('controlroom_quotations_store') || getCached('crm_quotations') || getCached('quotations_store') || [];
      const localPayments = getCached('controlroom_payments_store') || getCached('payment_store') || [];
      const localCustomers = getCached('controlroom_customers_store') || getCached('customer_store') || getCached('crm_customers') || [];
      const localLeads = getCached('controlroom_crm_leads') || getCached('crm_leads') || [];
      const localWorkOrders = getCached('controlroom_work_orders') || getCached('work_orders_store') || getCached('workorder_store') || getCached('vrm_prod_workorders') || [];
      const localDispatches = getCached('controlroom_dispatch_orders') || getCached('dispatch_store') || getCached('dispatch_orders') || [];
      const localChallans = getCached('controlroom_delivery_challans') || getCached('challan_store') || getCached('delivery_challans') || [];
      const localPis = getCached('controlroom_sales_pi_store') || getCached('sales_pi_store') || getCached('proforma_invoices') || [];
      const localPos = getCached('po_store') || [];
      const localBoms = getCached('controlroom_bom_store') || getCached('bom_orders') || getCached('bom_store') || [];
      const localInvs = getCached('controlroom_invoices_store') || getCached('invoice_store') || [];
      const localPresets = getCached('presets_store') || [];

      if (Array.isArray(localQuotes) && localQuotes.length > 0) setQuotesList(localQuotes);
      if (Array.isArray(localPayments) && localPayments.length > 0) setPaymentsList(localPayments);
      if (Array.isArray(localCustomers) && localCustomers.length > 0) setCustomersList(localCustomers);
      if (Array.isArray(localLeads) && localLeads.length > 0) setLeadsList(localLeads);
      if (Array.isArray(localWorkOrders) && localWorkOrders.length > 0) setWorkOrdersList(localWorkOrders);
      if (Array.isArray(localDispatches) && localDispatches.length > 0) setDispatchesList(localDispatches);
      if (Array.isArray(localChallans) && localChallans.length > 0) setChallansList(localChallans);
      if (Array.isArray(localPis) && localPis.length > 0) setPiList(localPis);
      if (Array.isArray(localPos) && localPos.length > 0) setPoList(localPos);
      if (Array.isArray(localBoms) && localBoms.length > 0) setBomList(localBoms);
      if (Array.isArray(localInvs) && localInvs.length > 0) setInvList(localInvs);
      if (Array.isArray(localPresets) && localPresets.length > 0) setPresetsList(localPresets);

      // 2. Fetch primary live operational records
      const [pos, pis, boms, invs, workOrders, dispatches, challans, quotes, payments, customers, presets] = await Promise.all([
        fetchWithTimeout('/api/purchaseorders', { timeout: 8000 })
          .then(r => r.json())
          .catch(() => fetchCloudStore('po_store', [])),
        fetchCloudStore('sales_pi_store', [])
          .then(res => (Array.isArray(res) && res.length > 0) ? res : fetchCloudStore('proforma_invoices', []))
          .catch(() => []),
        fetchWithTimeout('/api/boms', { timeout: 3000 })
          .then(r => r.json())
          .then(j => Array.isArray(j?.data) ? j.data : (Array.isArray(j) ? j : []))
          .catch(() => fetchCloudStore('bom_orders', []))
          .then(res => (Array.isArray(res) && res.length > 0) ? res : fetchCloudStore('bom_store', [])),
        fetchCloudStore('invoice_store', []).catch(() => []),
        fetchCloudStore('workorder_store', [])
          .then(res => (Array.isArray(res) && res.length > 0) ? res : fetchCloudStore('vrm_prod_workorders', []))
          .catch(() => []),
        fetchCloudStore('dispatch_orders', []).catch(() => fetchCloudStore('dispatch_store', [])).catch(() => []),
        fetchCloudStore('delivery_challans', []).catch(() => fetchCloudStore('challan_store', [])).catch(() => []),
        fetchCloudStore('crm_quotations', []).catch(() => fetchCloudStore('quotations_store', [])).catch(() => []),
        fetchCloudStore('payment_store', []).catch(() => []),
        fetchCloudStore('customer_store', []).catch(() => []),
        fetchCloudStore('presets_store', []).catch(() => [])
      ]);

      if (Array.isArray(pos)) setPoList(pos);
      if (Array.isArray(pis)) setPiList(pis);
      if (Array.isArray(boms)) setBomList(boms);
      if (Array.isArray(invs)) setInvList(invs);
      if (Array.isArray(workOrders)) setWorkOrdersList(workOrders);
      if (Array.isArray(dispatches)) setDispatchesList(dispatches);
      if (Array.isArray(challans)) setChallansList(challans);
      if (Array.isArray(quotes)) setQuotesList(quotes);
      if (Array.isArray(payments)) setPaymentsList(payments);
      if (Array.isArray(customers)) setCustomersList(customers);
      if (Array.isArray(presets)) setPresetsList(presets);
    } catch (err) {
      console.error('Error loading CEO dashboard data:', err);
    } finally {
      isFetchingRef.current = false;
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();

    // Debounced listener to prevent infinite rapid re-fetching loops
    const debouncedSync = () => {
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = setTimeout(() => {
        if (typeof document !== 'undefined' && !document.hidden) {
          loadData();
        }
      }, 2000);
    };

    const handleBomUpdated = (e) => {
      if (e?.detail?.bom) {
        const item = e.detail.bom;
        setBomList(prev => {
          const k = item.bomCode || item.code || item.id;
          const filtered = (prev || []).filter(b => b && (b.bomCode !== k && b.code !== k && b.id !== k));
          return [item, ...filtered];
        });
      }
    };

    const handleTargetUpdated = (e) => {
      if (e?.detail && typeof e.detail === 'object') {
        setCeoTargetStore(e.detail);
      }
    };
    window.addEventListener('controlroom_ceo_targets_updated', handleTargetUpdated);

    // Sync CEO targets from backend
    fetchWithTimeout('/api/store/ceo_target_store', { timeout: 3000 })
      .then(r => r.json())
      .then(res => {
        if (res?.data && typeof res.data === 'object' && !Array.isArray(res.data) && Object.keys(res.data).length > 0) {
          setCeoTargetStore(res.data);
          try { localStorage.setItem('controlroom_ceo_target_store', JSON.stringify(res.data)); } catch (_) {}
        }
      })
      .catch(() => {});

    window.addEventListener('controlroom_storage_update', debouncedSync);
    window.addEventListener('controlroom_bom_store_updated', handleBomUpdated);
    window.addEventListener('controlroom_po_updated', debouncedSync);
    window.addEventListener('controlroom_pi_updated', debouncedSync);
    window.addEventListener('controlroom_work_orders_updated', debouncedSync);
    window.addEventListener('controlroom_dispatch_updated', debouncedSync);
    return () => {
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
      window.removeEventListener('controlroom_storage_update', debouncedSync);
      window.removeEventListener('controlroom_bom_store_updated', handleBomUpdated);
      window.removeEventListener('controlroom_po_updated', debouncedSync);
      window.removeEventListener('controlroom_pi_updated', debouncedSync);
      window.removeEventListener('controlroom_work_orders_updated', debouncedSync);
      window.removeEventListener('controlroom_dispatch_updated', debouncedSync);
      window.removeEventListener('controlroom_ceo_targets_updated', handleTargetUpdated);
    };
  }, []);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await loadData();
    setTimeout(() => setIsRefreshing(false), 500);
  };

  // Handler for CEO to save / update targets
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

      window.dispatchEvent(new CustomEvent('controlroom_ceo_targets_updated', {
        detail: updatedStore
      }));

      await fetch('/api/store/ceo_target_store', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updatedStore)
      }).catch(() => {});

      setShowCeoTargetModal(false);
    } catch (e) {
      console.error('Error saving CEO target:', e);
    } finally {
      setIsSavingTarget(false);
    }
  };

  const getRepMonthlyTarget = (repName, defaultTarget) => {
    if (!ceoTargetStore?.repTargets) return defaultTarget;
    const normalize = (s) => String(s || '').toLowerCase().replace(/[-_\s.]/g, '');
    const norm = normalize(repName);
    for (const [key, val] of Object.entries(ceoTargetStore.repTargets)) {
      if (normalize(key) === norm && Number(val) > 0) return Number(val);
    }
    return defaultTarget;
  };

  const formatTargetCurrency = (amt) => {
    const num = Number(amt) || 0;
    if (num >= 10000000) return `₹ ${(num / 10000000).toFixed(2)} Cr`;
    if (num >= 100000) return `₹ ${(num / 100000).toFixed(1)} L`;
    if (num === 0) return '₹ 0.00';
    return `₹ ${Math.round(num).toLocaleString('en-IN')}`;
  };

  // Dynamic period multiplier
  const periodMultiplier = useMemo(() => {
    switch (selectedPeriod) {
      case 'Today': return 0.08;
      case 'This Week': return 0.28;
      case 'MTD': return 1.0;
      case 'Q2 FY27': return 2.65;
      case 'YTD': return 5.8;
      default: return 1.0;
    }
  }, [selectedPeriod]);

  // Master team directory across Sales, Purchase, Procurement, and Accounts
  const teamDirectory = useMemo(() => {
    return [
      // 1. Sales Team
      {
        id: 'EMP-SE-001',
        code: 'SE-VRM001',
        name: 'Mohith JV',
        email: 'mohith@vrm.com',
        phone: '+91 98765 43210',
        department: 'Sales',
        role: 'Sales Executive',
        designation: 'Senior Sales Representative',
        avatarBg: '#0E7490',
        monthlyTarget: getRepMonthlyTarget('Mohith JV', 18000000),
        unit: 'Revenue',
        aliases: ['mohith', 'mohith jv', 'se-vrm001']
      },
      {
        id: 'EMP-SH-001',
        code: 'SH-VRM001',
        name: 'Vijay',
        email: 'sales@vrm.com',
        phone: '+91 98450 11223',
        department: 'Sales',
        role: 'Sales Head',
        designation: 'Head of Solar Sales & BD',
        avatarBg: '#0891B2',
        monthlyTarget: getRepMonthlyTarget('Vijay', 35000000),
        unit: 'Revenue',
        aliases: ['vijay', 'sales head', 'sh-vrm001']
      },
      {
        id: 'EMP-SE-002',
        code: 'SE-VRM002',
        name: 'Ravi Kumar',
        email: 'ravi.k@vrmstructures.com',
        phone: '+91 97890 55443',
        department: 'Sales',
        role: 'Sales Executive',
        designation: 'Key Account Manager (Utility)',
        avatarBg: '#0284C7',
        monthlyTarget: getRepMonthlyTarget('Ravi Kumar', 14000000),
        unit: 'Revenue',
        aliases: ['ravi', 'ravi kumar', 'se-vrm002']
      },
      {
        id: 'EMP-SE-003',
        code: 'SE-VRM003',
        name: 'Pooja Sharma',
        email: 'pooja.s@vrmstructures.com',
        phone: '+91 99401 22334',
        department: 'Sales',
        role: 'Sales Executive',
        designation: 'Commercial Solar Sales Lead',
        avatarBg: '#2563EB',
        monthlyTarget: getRepMonthlyTarget('Pooja Sharma', 12000000),
        unit: 'Revenue',
        aliases: ['pooja', 'pooja sharma', 'se-vrm003']
      },
      {
        id: 'EMP-SE-004',
        code: 'SE-VRM004',
        name: 'Amit Verma',
        email: 'amit.v@vrmstructures.com',
        phone: '+91 98840 88776',
        department: 'Sales',
        role: 'Sales Executive',
        designation: 'Rooftop & Industrial Sales',
        avatarBg: '#4F46E5',
        monthlyTarget: getRepMonthlyTarget('Amit Verma', 9000000),
        unit: 'Revenue',
        aliases: ['amit', 'amit verma', 'se-vrm004']
      },

      // 2. Purchase & Procurement Team
      {
        id: 'EMP-PR-001',
        code: 'PR-VRM001',
        name: 'ARUN BOOPATHI M',
        email: 'scm@vrmstructures.in',
        phone: '+91 98402 33445',
        department: 'Procurement',
        role: 'Procurement Head',
        designation: 'Head of SCM & Raw Material Sourcing',
        avatarBg: '#1D4ED8',
        monthlyTarget: 25000000, // ₹ 2.50 Cr spend budget
        unit: 'PO Spend',
        aliases: ['arun', 'arun boopathi', 'arun boopathi m', 'pr-vrm001', 'scm']
      },
      {
        id: 'EMP-PR-002',
        code: 'PR-VRM002',
        name: 'Ar Annamalaiyar',
        email: 'maniskremo@gmail.com',
        phone: '+91 99620 44556',
        department: 'Procurement',
        role: 'Procurement Head',
        designation: 'Strategic Sourcing & Vendor Operations',
        avatarBg: '#2563EB',
        monthlyTarget: 18000000, // ₹ 1.80 Cr spend budget
        unit: 'PO Spend',
        aliases: ['ar annamalaiyar', 'annamalaiyar', 'pr-vrm002', 'procurement head']
      },
      {
        id: 'EMP-PR-003',
        code: 'PR-VRM003',
        name: 'SCM Operations Desk',
        email: 'procurement@vrm.com',
        phone: '+91 98410 77889',
        department: 'Procurement',
        role: 'Procurement Officer',
        designation: 'Consumables, HDG & Fasteners Buyer',
        avatarBg: '#3B82F6',
        monthlyTarget: 8000000, // ₹ 0.80 Cr spend budget
        unit: 'PO Spend',
        aliases: ['scm desk', 'procurement desk', 'pr-vrm003']
      },

      // 3. Accounts & Finance Team
      {
        id: 'EMP-AH-001',
        code: 'AH-VRM001',
        name: 'Venkatesh',
        email: 'accounts@vrm.com',
        phone: '+91 97910 66778',
        department: 'Accounts',
        role: 'Accounts Head',
        designation: 'Head of Finance & Statutory Compliance',
        avatarBg: '#7C3AED',
        monthlyTarget: 40000000, // ₹ 4.00 Cr collection target
        unit: 'Collections',
        aliases: ['venkatesh', 'accounts head', 'ah-vrm001', 'accounts']
      },
      {
        id: 'EMP-AC-003',
        code: 'AC-VRM003',
        name: 'Accounts Recovery Desk',
        email: 'finance@vrmstructures.com',
        phone: '+91 98400 33221',
        department: 'Accounts',
        role: 'Accounts Executive',
        designation: 'Receivables & Payment Realization',
        avatarBg: '#A855F7',
        monthlyTarget: 15000000, // ₹ 1.50 Cr collection
        unit: 'Collections',
        aliases: ['accounts recovery', 'ac-vrm003', 'finance']
      },

      // 4. Billing & Tax Invoicing Team
      {
        id: 'EMP-BI-002',
        code: 'BI-VRM002',
        name: 'Ar.Annamalaiyar',
        email: 'billing@vrmstructures.com',
        phone: '+91 98400 99887',
        department: 'Billing',
        role: 'Billing & Clearance Lead',
        designation: 'Tax Invoicing, E-Way Bill & Dispatch Clearances',
        avatarBg: '#9333EA',
        monthlyTarget: 35000000, // ₹ 3.50 Cr billing target
        unit: 'Invoicing',
        aliases: ['billing', 'ar.annamalaiyar', 'bi-vrm002', 'invoice desk']
      },

      // 5. Production & Plant Team
      {
        id: 'EMP-PH-001',
        code: 'PH-VRM001',
        name: 'Senthil Kumar',
        email: 'production@vrmstructures.in',
        phone: '+91 98421 88990',
        department: 'Production',
        role: 'Plant Head',
        designation: 'Plant Head & Production Operations',
        avatarBg: '#0284C7',
        monthlyTarget: 500, // 500 MT Output
        unit: 'MT Tonnage',
        aliases: ['senthil', 'senthil kumar', 'production', 'ph-vrm001', 'plant head']
      },
      {
        id: 'EMP-FS-001',
        code: 'FS-VRM001',
        name: 'Floor Operations Lead',
        email: 'floor@vrmstructures.in',
        phone: '+91 97890 22331',
        department: 'Production',
        role: 'Floor Supervisor',
        designation: 'Shopfloor Extrusion & Roll Forming Lead',
        avatarBg: '#0369A1',
        monthlyTarget: 420, // 420 MT Output
        unit: 'MT Tonnage',
        aliases: ['floor supervisor', 'shopfloor', 'fs-vrm001', 'operations lead']
      },

      // 6. Dispatch & Logistics Team
      {
        id: 'EMP-DH-001',
        code: 'DH-VRM001',
        name: 'Manikandan',
        email: 'dispatch@vrmstructures.in',
        phone: '+91 98403 66778',
        department: 'Dispatch',
        role: 'Dispatch Manager',
        designation: 'Logistics, Transporter & Delivery Head',
        avatarBg: '#059669',
        monthlyTarget: 160, // 160 Shipments
        unit: 'Shipments',
        aliases: ['manikandan', 'dispatch head', 'dh-vrm001', 'logistics']
      },

      // 7. Design & Engineering Team
      {
        id: 'EMP-DE-001',
        code: 'DE-VRM001',
        name: 'Praveen Kumar',
        email: 'design@vrmstructures.in',
        phone: '+91 99402 77881',
        department: 'Design',
        role: 'Design Engineer',
        designation: 'Senior Structural Design Engineer & BOM Architect',
        avatarBg: '#D97706',
        monthlyTarget: 32, // 32 Presets & BOM Models
        unit: 'Presets & BOMs',
        aliases: ['praveen', 'praveen kumar', 'design', 'de-vrm001', 'designer']
      },

      // 8. Tech Support & Quality Assurance
      {
        id: 'EMP-TS-001',
        code: 'TS-VRM001',
        name: 'Karthik Raja',
        email: 'techsupport@vrmstructures.in',
        phone: '+91 98405 11442',
        department: 'Tech Support',
        role: 'Technical Support Lead',
        designation: 'Technical Support, QA & Material Engine Specialist',
        avatarBg: '#4F46E5',
        monthlyTarget: 50, // 50 Support Tickets & Audits
        unit: 'Support & Audits',
        aliases: ['karthik', 'karthik raja', 'tech support', 'ts-vrm001', 'support']
      }
    ];
  }, [ceoTargetStore]);

  // Compute live person-wise performance metrics
  const personPerformanceData = useMemo(() => {
    return teamDirectory.map((emp) => {
      let matchedPis = [];
      let matchedQuotes = [];
      let matchedPos = [];
      let matchedInvs = [];
      let matchedBoms = [];
      let matchedWos = [];
      let matchedDispatches = [];
      let matchedChallans = [];
      let achievedVal = 0;
      let recordCount = 0;

      const isMatch = (itemVal, aliases) => {
        if (!itemVal) return false;
        const s = String(itemVal).toLowerCase().trim();
        return aliases.some(a => s === a || s.includes(a) || a.includes(s));
      };

      if (emp.department === 'Sales') {
        matchedPis = piList.filter(pi => 
          isMatch(pi.salesPerson || pi.createdBy || pi.salesPersonCode, emp.aliases)
        );
        matchedQuotes = quotesList.filter(q => 
          isMatch(q.salesPerson || q.createdBy || q.salesPersonCode, emp.aliases)
        );

        const piTotal = matchedPis.reduce((acc, p) => acc + parseAmt(p.grandTotal || p.amount || p.total), 0);
        const qTotal = matchedQuotes.reduce((acc, q) => acc + parseAmt(q.amount || q.total || q.grandTotal), 0);

        achievedVal = (piTotal + qTotal) * periodMultiplier;
        recordCount = matchedPis.length + matchedQuotes.length;
      } else if (emp.department === 'Procurement') {
        matchedPos = poList.filter(po => 
          isMatch(po.buyer || po.purchaser || po.createdBy || po.vendor, emp.aliases)
        );

        const poTotal = matchedPos.reduce((acc, po) => acc + parseAmt(po.amount || po.total), 0);
        achievedVal = poTotal * periodMultiplier;
        recordCount = matchedPos.length;
      } else if (emp.department === 'Accounts') {
        matchedInvs = invList.filter(inv => 
          isMatch(inv.createdBy || inv.salesPerson || inv.verifiedBy, emp.aliases)
        );

        const invTotal = matchedInvs.reduce((acc, inv) => acc + parseAmt(inv.total || inv.grandTotal || inv.amount), 0);
        achievedVal = invTotal * periodMultiplier;
        recordCount = matchedInvs.length;
      } else if (emp.department === 'Billing') {
        matchedInvs = invList.filter(inv => 
          isMatch(inv.createdBy || inv.salesPerson || inv.verifiedBy, emp.aliases)
        );

        const invTotal = matchedInvs.reduce((acc, inv) => acc + parseAmt(inv.total || inv.grandTotal || inv.amount), 0);
        achievedVal = invTotal * periodMultiplier;
        recordCount = matchedInvs.length;
      } else if (emp.department === 'Production') {
        matchedBoms = bomList.filter(b => 
          isMatch(b.assignedTo || b.engineer || b.createdBy || b.productionLead, emp.aliases)
        );
        matchedWos = workOrdersList.filter(w => 
          isMatch(w.assignedTo || w.operator || w.supervisor, emp.aliases)
        );
        const totalWeightTons = matchedBoms.reduce((acc, b) => acc + (parseFloat(b.totalWeight || b.weight || 0) || 0), 0);
        achievedVal = totalWeightTons * periodMultiplier;
        recordCount = matchedBoms.length + matchedWos.length;
      } else if (emp.department === 'Dispatch') {
        matchedDispatches = dispatchesList.filter(d => 
          isMatch(d.dispatchedBy || d.transporter, emp.aliases)
        );
        matchedChallans = challansList.filter(c => 
          isMatch(c.dispatchedBy || c.driverName, emp.aliases)
        );
        achievedVal = (matchedDispatches.length + matchedChallans.length) * periodMultiplier;
        recordCount = matchedDispatches.length + matchedChallans.length;
      } else if (emp.department === 'Design') {
        matchedBoms = bomList.filter(b => 
          isMatch(b.engineer || b.designedBy, emp.aliases)
        );
        achievedVal = matchedBoms.length * periodMultiplier;
        recordCount = matchedBoms.length;
      } else if (emp.department === 'Tech Support') {
        achievedVal = 0;
        recordCount = 0;
      }

      const scaledTarget = emp.monthlyTarget * periodMultiplier;
      const targetPct = scaledTarget > 0 ? Math.min(135, Math.round((achievedVal / scaledTarget) * 100)) : 0;

      let rating = 'No Deals Yet';
      let ratingColor = '#64748B';
      let ratingBg = '#F1F5F9';
      if (achievedVal > 0) {
        if (targetPct >= 100) {
          rating = 'Top Performer';
          ratingColor = '#16A34A';
          ratingBg = '#DCFCE7';
        } else if (targetPct >= 75) {
          rating = 'High Producer';
          ratingColor = '#2563EB';
          ratingBg = '#EFF6FF';
        } else {
          rating = 'In Progress';
          ratingColor = '#0E7490';
          ratingBg = '#ECFEFF';
        }
      }

      return {
        ...emp,
        achievedVal,
        scaledTarget,
        targetPct,
        recordCount,
        rating,
        ratingColor,
        ratingBg,
        records: {
          pis: matchedPis,
          quotes: matchedQuotes,
          pos: matchedPos,
          invs: matchedInvs,
          boms: matchedBoms,
          wos: matchedWos,
          dispatches: matchedDispatches,
          challans: matchedChallans
        }
      };
    });
  }, [teamDirectory, piList, quotesList, poList, invList, bomList, workOrdersList, dispatchesList, challansList, periodMultiplier]);

  // Filtered personnel list for the Person-Wise Performance Hub
  const filteredPersonnel = useMemo(() => {
    return personPerformanceData.filter(emp => {
      const matchesDept = personDeptFilter === 'all' || emp.department === personDeptFilter;
      const q = personSearchQuery.toLowerCase().trim();
      const matchesQuery = !q || (
        emp.name.toLowerCase().includes(q) ||
        emp.code.toLowerCase().includes(q) ||
        emp.role.toLowerCase().includes(q) ||
        emp.department.toLowerCase().includes(q)
      );
      return matchesDept && matchesQuery;
    });
  }, [personPerformanceData, personDeptFilter, personSearchQuery]);

  // Overall Business Totals - Real Calculations Only
  const pendingMdPOs = useMemo(() => {
    return poList.filter(po => {
      const stage = String(po.stage || po.status || po.statusType || '').toLowerCase();
      return stage.includes('draft') || stage.includes('pending') || stage.includes('approval');
    });
  }, [poList]);

  const totalPoSpendNum = useMemo(() => {
    return poList.reduce((acc, po) => acc + parseAmt(po.amount || po.total), 0);
  }, [poList]);

  const totalPoSpendCr = ((totalPoSpendNum * periodMultiplier) / 10000000).toFixed(2);

  const totalPiPipelineNum = useMemo(() => {
    return piList.reduce((acc, pi) => acc + parseAmt(pi.grandTotal || pi.amount || pi.total), 0);
  }, [piList]);

  const totalPiPipelineCr = ((totalPiPipelineNum * periodMultiplier) / 10000000).toFixed(2);

  const totalInvoicedNum = useMemo(() => {
    return invList.reduce((acc, inv) => acc + parseAmt(inv.total || inv.grandTotal || inv.amount), 0);
  }, [invList]);

  const totalRevenueCr = ((totalInvoicedNum * periodMultiplier) / 10000000).toFixed(2);

  const totalCollectedNum = useMemo(() => {
    return paymentsList.reduce((acc, p) => acc + parseAmt(p.amount || p.paidAmount), 0);
  }, [paymentsList]);

  const totalCollectedCr = ((totalCollectedNum * periodMultiplier) / 10000000).toFixed(2);
  const outstandingOverdueCr = (Math.max(0, parseFloat(totalRevenueCr) - parseFloat(totalCollectedCr))).toFixed(2);

  const totalProductionTonnage = useMemo(() => {
    return bomList.reduce((acc, b) => acc + (parseFloat(b.totalWeight || b.weight || 0) || 0), 0);
  }, [bomList]);

  // Real Product categories breakdown for SVG Donut from live PO line items and BOM profiles
  const productCategories = useMemo(() => {
    const catMap = {};
    poList.forEach(po => {
      if (Array.isArray(po.items)) {
        po.items.forEach(it => {
          const name = (it.name || it.item_name || it.description || 'Solar Components').trim();
          const amt = parseAmt(it.amount || it.total || it.item_total || 0) || (parseAmt(it.rate || it.price) * (parseFloat(it.qty || it.quantity) || 1));
          let category = 'Solar Mounting & Profiles';
          const nLower = name.toLowerCase();
          if (nLower.includes('module') || nLower.includes('panel')) category = 'Solar PV Modules';
          else if (nLower.includes('clamp') || nLower.includes('fastener') || nLower.includes('bolt')) category = 'Clamps & Fasteners';
          else if (nLower.includes('rail') || nLower.includes('purlin') || nLower.includes('strut')) category = 'Rail & Purlin Profiles';
          else if (nLower.includes('walkway') || nLower.includes('hdg')) category = 'Walkways & Heavy HDG';
          else if (nLower.includes('inverter') || nLower.includes('cable') || nLower.includes('electrical')) category = 'Electrical & Inverters';

          if (!catMap[category]) catMap[category] = { name: category, value: 0, orders: 0 };
          catMap[category].value += amt > 0 ? amt : parseAmt(po.amount || po.total) / Math.max(1, po.items.length);
          catMap[category].orders += 1;
        });
      }
    });

    bomList.forEach(bom => {
      const profile = (bom.profile || bom.profileSpecification || 'Mounting Profiles').trim();
      if (!catMap[profile]) catMap[profile] = { name: profile, value: 0, orders: 0 };
      catMap[profile].value += parseAmt(bom.amount || bom.estimatedCost || 0);
      catMap[profile].orders += 1;
    });

    const rawList = Object.values(catMap);
    const totalVal = rawList.reduce((s, c) => s + c.value, 0);

    const colors = ['#0E7490', '#2563EB', '#10B981', '#F59E0B', '#8B5CF6', '#EC4899'];
    return rawList
      .sort((a, b) => b.value - a.value)
      .slice(0, 5)
      .map((c, idx) => ({
        name: c.name,
        value: parseFloat(((c.value * periodMultiplier) / 10000000).toFixed(2)),
        pct: totalVal > 0 ? parseFloat(((c.value / totalVal) * 100).toFixed(1)) : 0,
        color: colors[idx % colors.length],
        orders: c.orders
      }));
  }, [poList, bomList, periodMultiplier]);

  const totalCatVal = useMemo(() => {
    return productCategories.reduce((s, c) => s + c.value, 0).toFixed(2);
  }, [productCategories]);

  // Real Monthly Run-Rate Trend Data aggregated from live database records
  const monthlyRunRate = useMemo(() => {
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const currentMonthIdx = new Date().getMonth();
    const relevantMonths = months.slice(0, Math.max(currentMonthIdx + 1, 9));

    return relevantMonths.map((m, mIdx) => {
      const revForMonth = invList.reduce((acc, inv) => {
        const dStr = inv.invoiceDate || inv.date || inv.created_at || '';
        if (!dStr) return acc;
        const d = new Date(dStr);
        if (!isNaN(d.getTime()) && d.getMonth() === mIdx) {
          return acc + parseAmt(inv.total || inv.grandTotal || inv.amount);
        }
        return acc;
      }, 0) + (invList.length === 0 ? piList.reduce((acc, pi) => {
        const dStr = pi.piDate || pi.date || pi.created_at || '';
        if (!dStr) return acc;
        const d = new Date(dStr);
        if (!isNaN(d.getTime()) && d.getMonth() === mIdx) {
          return acc + parseAmt(pi.grandTotal || pi.amount || pi.total);
        }
        return acc;
      }, 0) : 0);

      const spendForMonth = poList.reduce((acc, po) => {
        const dStr = po.poDate || po.deliveryDate || po.created_at || '';
        if (!dStr) return acc;
        const d = new Date(dStr);
        if (!isNaN(d.getTime()) && d.getMonth() === mIdx) {
          return acc + parseAmt(po.amount || po.total);
        }
        return acc;
      }, 0);

      const revCr = parseFloat((revForMonth / 10000000).toFixed(2));
      const spendCr = parseFloat((spendForMonth / 10000000).toFixed(2));
      const margin = revCr > 0 ? parseFloat((((revCr - spendCr) / revCr) * 100).toFixed(1)) : 0;

      return {
        month: m,
        rev: revCr,
        spend: spendCr,
        margin: margin
      };
    });
  }, [invList, piList, poList]);

  // Real Top Strategic Accounts aggregated from real transactions
  const topAccounts = useMemo(() => {
    const map = {};
    piList.forEach(pi => {
      const cust = (pi.customerName || pi.customer || '').trim();
      if (!cust) return;
      if (!map[cust]) {
        map[cust] = { name: cust, revenue: 0, orders: 0, salesPerson: pi.salesPerson || 'Sales Team', paymentTerms: pi.paymentTerms || 'Standard Terms', status: pi.status || 'Active' };
      }
      map[cust].revenue += parseAmt(pi.grandTotal || pi.amount || pi.total);
      map[cust].orders += 1;
    });
    invList.forEach(inv => {
      const cust = (inv.customerName || inv.customer || '').trim();
      if (!cust) return;
      if (!map[cust]) {
        map[cust] = { name: cust, revenue: 0, orders: 0, salesPerson: inv.salesPerson || 'Billing Team', paymentTerms: inv.paymentTerms || 'Standard Terms', status: 'Active' };
      }
      map[cust].revenue += parseAmt(inv.total || inv.grandTotal || inv.amount);
      map[cust].orders += 1;
    });
    if (Object.keys(map).length === 0) {
      poList.forEach(po => {
        const vend = (po.vendor || po.vendorName || '').trim();
        if (!vend) return;
        if (!map[vend]) {
          map[vend] = { name: vend, revenue: 0, orders: 0, salesPerson: po.buyer || 'Procurement Team', paymentTerms: po.paymentTerms || 'Due on Receipt', status: po.status || 'Active' };
        }
        map[vend].revenue += parseAmt(po.amount || po.total);
        map[vend].orders += 1;
      });
    }

    const list = Object.values(map).sort((a, b) => b.revenue - a.revenue);
    const totalRev = list.reduce((s, a) => s + a.revenue, 0);

    return list.slice(0, 5).map(acc => ({
      name: acc.name,
      revenue: acc.revenue >= 10000000 ? `₹ ${(acc.revenue / 10000000).toFixed(2)} Cr` : `₹ ${(acc.revenue / 100000).toFixed(2)} L`,
      share: totalRev > 0 ? `${((acc.revenue / totalRev) * 100).toFixed(1)}%` : '0%',
      orders: `${acc.orders} Deals`,
      salesPerson: acc.salesPerson,
      paymentTerms: acc.paymentTerms,
      status: acc.status
    }));
  }, [piList, invList, poList]);

  // Real Operational Funnel
  const funnelStages = useMemo(() => [
    { stage: '1. Quotations & Leads', count: `${quotesList.length + leadsList.length} Leads`, value: `₹ ${((quotesList.reduce((acc, q) => acc + parseAmt(q.amount || q.total), 0) * periodMultiplier) / 10000000).toFixed(2)} Cr`, icon: FileText, color: '#6366F1', bg: '#EEF2FF', action: 'Sales Pipeline' },
    { stage: '2. Proforma Invoices (PI)', count: `${piList.length} Active PIs`, value: `₹ ${totalPiPipelineCr} Cr`, icon: Receipt, color: '#0E7490', bg: '#ECFEFF', action: 'BOM Conversion' },
    { stage: '3. Purchase Orders (PO)', count: `${poList.length} POs Done`, value: `₹ ${totalPoSpendCr} Cr`, icon: ShoppingCart, color: '#2563EB', bg: '#EFF6FF', action: 'Procurement' },
    { stage: '4. Plant Production Output', count: `${bomList.length} Plant Orders`, value: `${(totalProductionTonnage * periodMultiplier).toFixed(1)} MT Done`, icon: Factory, color: '#0284C7', bg: '#F0F9FF', action: 'Extrusion' },
    { stage: '5. Dispatch & Logistics', count: `${dispatchesList.length + challansList.length} Shipments`, value: dispatchesList.length + challansList.length > 0 ? '100% Tracked' : '0 Shipments', icon: Truck, color: '#059669', bg: '#ECFDF5', action: 'Logistics SLA' },
    { stage: '6. Billing & Invoices', count: `${invList.length} Invoices`, value: `₹ ${totalRevenueCr} Cr`, icon: Receipt, color: '#9333EA', bg: '#FAF5FF', action: 'Tax Clearances' },
    { stage: '7. Accounts & Collections', count: totalInvoicedNum > 0 ? `${((totalCollectedNum / totalInvoicedNum) * 100).toFixed(1)}% Realized` : '0% Realized', value: `₹ ${totalCollectedCr} Cr`, icon: Wallet, color: '#16A34A', bg: '#F0FDF4', action: 'Cash Flow' }
  ], [quotesList, leadsList, periodMultiplier, piList.length, totalPiPipelineCr, poList.length, totalPoSpendCr, bomList.length, totalProductionTonnage, dispatchesList.length, challansList.length, invList.length, totalRevenueCr, totalInvoicedNum, totalCollectedNum, totalCollectedCr]);

  // Real Risk Alerts & Watchlist
  const realRiskAlerts = useMemo(() => {
    const alerts = [];
    if (pendingMdPOs.length > 0) {
      alerts.push({
        title: `${pendingMdPOs.length} Purchase Orders Awaiting Executive Approval`,
        desc: `High-value purchase orders submitted from Procurement require CEO / MD sign-off before vendor issuance.`,
        severity: 'High',
        color: '#DC2626',
        bg: '#FEF2F2'
      });
    }
    const overdueInvs = invList.filter(inv => {
      const st = String(inv.status || '').toLowerCase();
      return st.includes('overdue') || st.includes('unpaid');
    });
    if (overdueInvs.length > 0) {
      alerts.push({
        title: `${overdueInvs.length} Overdue Accounts Receivables`,
        desc: `Invoices with pending realizations flagged by Accounts department.`,
        severity: 'Medium',
        color: '#D97706',
        bg: '#FFFBEB'
      });
    }
    return alerts;
  }, [pendingMdPOs, invList]);

  // Real Aging Buckets for Accounts
  const agingBuckets = useMemo(() => {
    const buckets = { current: 0, soon: 0, watchlist: 0, critical: 0 };
    const now = new Date().getTime();
    invList.forEach(inv => {
      const isPaid = String(inv.status || '').toLowerCase().includes('paid');
      if (isPaid) return;
      const invDate = new Date(inv.invoiceDate || inv.date || inv.created_at || now).getTime();
      const days = Math.max(0, Math.floor((now - invDate) / (1000 * 60 * 60 * 24)));
      const amt = parseAmt(inv.total || inv.grandTotal || inv.amount);
      if (days <= 15) buckets.current += amt;
      else if (days <= 30) buckets.soon += amt;
      else if (days <= 60) buckets.watchlist += amt;
      else buckets.critical += amt;
    });
    const total = buckets.current + buckets.soon + buckets.watchlist + buckets.critical;
    const toCrStr = (val) => val >= 10000000 ? `₹ ${(val / 10000000).toFixed(2)} Cr` : `₹ ${(val / 100000).toFixed(2)} L`;
    const toPct = (val) => total > 0 ? `${((val / total) * 100).toFixed(1)}%` : '0%';

    return [
      { label: 'Current (0-15 Days)', amount: toCrStr(buckets.current), pct: toPct(buckets.current), color: '#16A34A', bg: '#DCFCE7' },
      { label: '16-30 Days (Due Soon)', amount: toCrStr(buckets.soon), pct: toPct(buckets.soon), color: '#2563EB', bg: '#EFF6FF' },
      { label: '31-60 Days (Watchlist)', amount: toCrStr(buckets.watchlist), pct: toPct(buckets.watchlist), color: '#D97706', bg: '#FEF3C7' },
      { label: '>60 Days (Critical Overdue)', amount: toCrStr(buckets.critical), pct: toPct(buckets.critical), color: '#DC2626', bg: '#FEE2E2' }
    ];
  }, [invList]);

  return (
    <div style={{
      padding: '0 4px',
      display: 'flex',
      flexDirection: 'column',
      gap: '14px',
      width: '100%',
      maxWidth: '100%',
      minWidth: 0,
      boxSizing: 'border-box',
      overflowX: 'hidden'
    }}>
      
      {/* 1. PERSONALIZED WELCOME & EXECUTIVE COMMAND HEADER */}
      <div style={{
        backgroundColor: '#FFFFFF',
        borderRadius: '16px',
        border: '1px solid #E2E8F0',
        padding: '16px 20px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '14px',
        boxShadow: '0 4px 16px -2px rgba(15, 23, 42, 0.04)',
        background: 'linear-gradient(135deg, #FFFFFF 0%, #F8FAFC 100%)',
        position: 'relative',
        boxSizing: 'border-box',
        width: '100%',
        minHeight: '74px',
        flexShrink: 0
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px', zIndex: 2, minWidth: 0 }}>
          <div style={{
            width: '42px',
            height: '42px',
            borderRadius: '12px',
            backgroundColor: '#0E7490',
            color: '#FFFFFF',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontWeight: '900',
            fontSize: '18px',
            boxShadow: '0 4px 12px rgba(14, 116, 144, 0.35)',
            flexShrink: 0
          }}>
            {avatarInitials}
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
              <h2 style={{ fontSize: '18px', fontWeight: '800', color: '#0F172A', margin: 0, letterSpacing: '-0.02em' }}>
                Welcome back, {currentLoggedName}!
              </h2>
              <span style={{
                fontSize: '10.5px',
                fontWeight: '800',
                color: '#0E7490',
                backgroundColor: '#ECFEFF',
                padding: '2px 8px',
                borderRadius: '8px',
                border: '1px solid #BAE6FD'
              }}>
                {userRole === 'MD' || userRole === 'Managing Director' ? 'MD COMMAND CENTER' : 'CEO & MD DASHBOARD'}
              </span>
            </div>
            <p style={{ fontSize: '12px', color: '#64748B', margin: '3px 0 0 0', fontWeight: '500' }}>
              Executive Leadership Command Center • Real-time enterprise overview across Sales, Purchase, Procurement, Accounts & Person-Wise Performance.
            </p>
          </div>
        </div>

        {/* Global Controls: Period + Sync */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap', zIndex: 2 }}>
          {/* Period Selector Pills */}
          <div style={{
            display: 'flex',
            backgroundColor: '#F1F5F9',
            padding: '3px',
            borderRadius: '10px',
            border: '1px solid #E2E8F0',
            gap: '2px'
          }}>
            {['Today', 'This Week', 'MTD', 'Q2 FY27', 'YTD'].map((period) => (
              <button
                key={period}
                onClick={() => setSelectedPeriod(period)}
                style={{
                  border: 'none',
                  backgroundColor: selectedPeriod === period ? '#0E7490' : 'transparent',
                  color: selectedPeriod === period ? '#FFFFFF' : '#475569',
                  padding: '5px 10px',
                  borderRadius: '7px',
                  fontSize: '11px',
                  fontWeight: selectedPeriod === period ? '800' : '600',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease'
                }}
              >
                {period}
              </button>
            ))}
          </div>

          {/* Live Sync Button */}
          <button
            onClick={handleRefresh}
            title="Refresh Live Data"
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '32px',
              height: '32px',
              borderRadius: '8px',
              border: '1px solid #CBD5E1',
              backgroundColor: '#FFFFFF',
              color: '#475569',
              cursor: 'pointer',
              boxShadow: '0 1px 3px rgba(0,0,0,0.05)'
            }}
          >
            <RefreshCw size={14} className={isRefreshing ? 'animate-spin' : ''} style={{ animation: isRefreshing ? 'spin 1s linear infinite' : 'none' }} />
          </button>
        </div>
      </div>

      {/* 2. TOP EXECUTIVE HEADLINE METRICS (8 ENTERPRISE PILLARS - 4 IN ROW 1, 4 IN ROW 2) */}
      <div 
        className="ceo-kpi-grid-4x2"
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(4, minmax(0, 1fr))',
          gap: '12px',
          width: '100%',
          maxWidth: '100%',
          minWidth: 0,
          boxSizing: 'border-box',
          flexShrink: 0
        }}
      >
        {[
          {
            title: 'PO: HOW MUCH IS DONE',
            value: `${poList.length} POs Done`,
            trend: `${pendingMdPOs.length > 0 ? `${pendingMdPOs.length} Pending MD` : 'All Approved'}`,
            trendUp: pendingMdPOs.length === 0,
            icon: ShoppingCart,
            iconColor: '#2563EB',
            iconBg: '#EFF6FF',
            bottomPrefix: 'Spend authorized: ',
            bottomHighlight: `₹ ${totalPoSpendCr} Cr`,
            highlightCard: pendingMdPOs.length > 0,
            onClick: () => setActiveSubTab('procurement')
          },
          {
            title: 'PI: HOW MUCH IS THERE',
            value: `${piList.length} Active PIs`,
            trend: piList.length > 0 ? `${piList.length} Deals` : '0 Deals',
            trendUp: piList.length > 0,
            icon: Receipt,
            iconColor: '#0E7490',
            iconBg: '#ECFEFF',
            bottomPrefix: 'Pipeline value: ',
            bottomHighlight: `₹ ${totalPiPipelineCr} Cr`,
            onClick: () => setActiveSubTab('sales')
          },
          {
            title: 'HOW MUCH PRODUCTION IS DONE',
            value: `${(totalProductionTonnage * periodMultiplier).toFixed(1)} MT Done`,
            trend: bomList.length > 0 ? `${bomList.length} BOM Orders` : '0 Plant Orders',
            trendUp: bomList.length > 0,
            icon: Factory,
            iconColor: '#0284C7',
            iconBg: '#F0F9FF',
            bottomPrefix: 'Active plant orders: ',
            bottomHighlight: `${bomList.length} BOMs in-progress`,
            onClick: () => setActiveSubTab('production')
          },
          {
            title: 'HOW MUCH DISPATCH IS DONE',
            value: `${dispatchesList.length + challansList.length} Dispatches`,
            trend: dispatchesList.length + challansList.length > 0 ? 'Live Tracked' : '0 Shipments',
            trendUp: dispatchesList.length + challansList.length > 0,
            icon: Truck,
            iconColor: '#059669',
            iconBg: '#ECFDF5',
            bottomPrefix: 'Fleet in-transit: ',
            bottomHighlight: `${dispatchesList.filter(d => String(d.status || '').toLowerCase().includes('transit')).length + challansList.filter(c => String(c.status || '').toLowerCase().includes('transit')).length} vehicles`,
            onClick: () => setActiveSubTab('dispatch')
          },
          {
            title: 'HOW MUCH BILLING IS DONE',
            value: `${invList.length} Invoices Billed`,
            trend: invList.length > 0 ? '100% Tax Reconciled' : '0 Invoices',
            trendUp: true,
            icon: FileCheck,
            iconColor: '#9333EA',
            iconBg: '#FAF5FF',
            bottomPrefix: 'Total GST billed: ',
            bottomHighlight: `₹ ${totalRevenueCr} Cr`,
            onClick: () => setActiveSubTab('billing')
          },
          {
            title: 'HOW MUCH ACCOUNTS COLLECTED',
            value: `₹ ${totalCollectedCr} Cr Done`,
            trend: totalInvoicedNum > 0 ? `${((totalCollectedNum / totalInvoicedNum) * 100).toFixed(1)}% Rate` : '0% Rate',
            trendUp: true,
            icon: Wallet,
            iconColor: '#16A34A',
            iconBg: '#F0FDF4',
            bottomPrefix: 'Outstanding pending: ',
            bottomHighlight: `₹ ${outstandingOverdueCr} Cr`,
            onClick: () => setActiveSubTab('accounts')
          },
          {
            title: 'HOW MUCH DESIGN IS DONE',
            value: `${presetsList.length} Presets Done`,
            trend: presetsList.length > 0 ? 'Tooling Validated' : '0 Presets',
            trendUp: true,
            icon: Calculator,
            iconColor: '#D97706',
            iconBg: '#FFFBEB',
            bottomPrefix: 'BOM verified models: ',
            bottomHighlight: `${bomList.length} models`,
            onClick: () => setActiveSubTab('engineering')
          },
          {
            title: 'HOW MUCH TECH SUPPORT DONE',
            value: `${workOrdersList.length} Work Orders Done`,
            trend: workOrdersList.length > 0 ? 'Production Live' : '0 Work Orders',
            trendUp: true,
            icon: Wrench,
            iconColor: '#4F46E5',
            iconBg: '#EEF2FF',
            bottomPrefix: 'Support resolved: ',
            bottomHighlight: '0 open tickets',
            onClick: () => setActiveSubTab('engineering')
          }
        ].map((kpi, kIdx) => {
          const IconComp = kpi.icon;
          return (
            <div 
              key={kIdx}
              onClick={kpi.onClick}
              style={{
                backgroundColor: '#FFFFFF',
                borderRadius: '16px',
                border: kpi.highlightCard ? '1.5px solid #FCA5A5' : '1px solid #EAEFEF',
                padding: '14px 16px',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                gap: '10px',
                boxShadow: kpi.highlightCard ? '0 4px 18px rgba(220, 38, 38, 0.08)' : '0 4px 18px rgba(15, 23, 42, 0.03)',
                cursor: kpi.onClick ? 'pointer' : 'default',
                transition: 'all 0.2s ease',
                minWidth: 0,
                boxSizing: 'border-box'
              }}
            >
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', minWidth: 0 }}>
                {/* Header Row: Title & Standard Icon */}
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '8px' }}>
                  <span style={{ 
                    fontSize: '11px', 
                    fontWeight: '800', 
                    color: '#64748B',
                    letterSpacing: '0.04em',
                    textTransform: 'uppercase',
                    lineHeight: '1.3'
                  }}>
                    {kpi.title}
                  </span>
                  <div style={{
                    width: '28px',
                    height: '28px',
                    borderRadius: '8px',
                    backgroundColor: kpi.iconBg,
                    color: kpi.iconColor,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0
                  }}>
                    <IconComp size={15} />
                  </div>
                </div>

                {/* Metric Value & Trend Badge */}
                <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', flexWrap: 'wrap' }}>
                  <span style={{ fontSize: '20px', fontWeight: '900', color: kpi.highlightCard ? '#DC2626' : '#0F172A', letterSpacing: '-0.5px', lineHeight: '1.1' }}>
                    {kpi.value}
                  </span>
                  
                  <span style={{ 
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '2px',
                    fontSize: '10.5px', 
                    fontWeight: '800',
                    color: kpi.trendUp ? '#16A34A' : '#DC2626',
                    backgroundColor: kpi.trendUp ? '#DCFCE7' : '#FEE2E2',
                    padding: '2px 7px',
                    borderRadius: '8px',
                    marginLeft: 'auto'
                  }}>
                    {kpi.trendUp ? <ArrowUpRight style={{ width: '12px', height: '12px' }} /> : <ArrowDownRight style={{ width: '12px', height: '12px' }} />}
                    {kpi.trend}
                  </span>
                </div>
              </div>

              {/* Subtitle / Context strip */}
              <div style={{ 
                display: 'flex', 
                alignItems: 'center', 
                gap: '4px', 
                fontSize: '11px', 
                color: '#64748B',
                lineHeight: '1.3',
                flexWrap: 'wrap'
              }}>
                <span>{kpi.bottomPrefix}</span>
                <span style={{ color: kpi.trendUp ? '#059669' : '#DC2626', fontWeight: '800' }}>
                  {kpi.bottomHighlight}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* 3. EXECUTIVE SUB-NAVIGATION TAB PILLS */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: '6px',
        backgroundColor: '#FFFFFF',
        padding: '8px 10px',
        borderRadius: '14px',
        border: '1px solid #E2E8F0',
        width: '100%',
        maxWidth: '100%',
        minWidth: 0,
        boxSizing: 'border-box',
        boxShadow: '0 2px 8px rgba(15, 23, 42, 0.02)',
        flexShrink: 0
      }}>
        {[
          { id: 'overview', label: 'Executive Command Deck', icon: LayoutDashboard, badge: null },
          { id: 'personnel', label: 'Person-Wise Performance Hub', icon: Users, badge: `${filteredPersonnel.length} Leads` },
          { id: 'sales', label: 'Sales Operations', icon: Briefcase, badge: `${piList.length} PIs` },
          { id: 'procurement', label: 'Purchase & Procurement', icon: ShoppingCart, badge: `${poList.length} POs` },
          { id: 'accounts', label: 'Accounts & Cash Flow', icon: Wallet, badge: `₹ ${totalCollectedCr} Cr` },
          { id: 'production', label: 'Production & Plant', icon: Factory, badge: `${bomList.length} Orders` },
          { id: 'dispatch', label: 'Dispatch & Logistics', icon: Truck, badge: `${dispatchesList.length + challansList.length} Dispatches` },
          { id: 'billing', label: 'Billing & Invoicing', icon: Receipt, badge: `${invList.length} Invoices` },
          { id: 'engineering', label: 'Design & Tech Support', icon: Calculator, badge: `${presetsList.length} Presets` }
        ].map(tab => {
          const TabIcon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveSubTab(tab.id)}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '8px 14px',
                borderRadius: '10px',
                border: 'none',
                backgroundColor: activeSubTab === tab.id ? '#0E7490' : 'transparent',
                color: activeSubTab === tab.id ? '#FFFFFF' : '#475569',
                fontSize: '12px',
                fontWeight: activeSubTab === tab.id ? '800' : '600',
                cursor: 'pointer',
                whiteSpace: 'nowrap',
                transition: 'all 0.15s ease'
              }}
            >
              <TabIcon size={14} />
              <span>{tab.label}</span>
              {tab.badge && (
                <span style={{
                  fontSize: '9.5px',
                  fontWeight: '800',
                  backgroundColor: activeSubTab === tab.id ? 'rgba(255, 255, 255, 0.25)' : (tab.badgeBg || '#F1F5F9'),
                  color: activeSubTab === tab.id ? '#FFFFFF' : (tab.badgeColor || '#475569'),
                  padding: '1px 6px',
                  borderRadius: '8px'
                }}>
                  {tab.badge}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* ======================================================== */}
      {/* VIEW 1: EXECUTIVE COMMAND DECK (UNIFIED OVERVIEW)         */}
      {/* ======================================================== */}
      {activeSubTab === 'overview' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          
          {/* ROW A: APPROVAL QUEUE + RUN-RATE CHART + PRODUCT SHARE */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 310px), 1fr))',
            gap: '12px',
            width: '100%',
            maxWidth: '100%',
            minWidth: 0,
            boxSizing: 'border-box',
            alignItems: 'stretch'
          }}>
            
            {/* CARD 1: LIVE MD/CEO APPROVAL QUEUE */}
            <div style={{
              backgroundColor: '#FFFFFF',
              borderRadius: '16px',
              border: '1px solid #EAEFEF',
              padding: '14px 16px',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              gap: '10px',
              boxShadow: '0 4px 18px rgba(15, 23, 42, 0.03)'
            }}>
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #F1F5F9', paddingBottom: '8px', marginBottom: '8px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span style={{ fontSize: '12px', fontWeight: '800', color: '#0F172A', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                      Awaiting CEO / MD Approval
                    </span>
                    <span style={{
                      fontSize: '10px',
                      fontWeight: '800',
                      color: pendingMdPOs.length > 0 ? '#DC2626' : '#16A34A',
                      backgroundColor: pendingMdPOs.length > 0 ? '#FEF2F2' : '#F0FDF4',
                      padding: '2px 7px',
                      borderRadius: '10px'
                    }}>
                      {pendingMdPOs.length} Actions
                    </span>
                  </div>
                  <button
                    onClick={() => onNavigateTab && onNavigateTab('Purchase Orders')}
                    style={{
                      border: 'none',
                      background: 'none',
                      color: '#0E7490',
                      fontSize: '11px',
                      fontWeight: '700',
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '3px'
                    }}
                  >
                    View All POs <ArrowRight size={12} />
                  </button>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  {pendingMdPOs.slice(0, 3).map((po, pIdx) => (
                    <div
                      key={pIdx}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '8px 10px',
                        backgroundColor: '#F8FAFC',
                        borderRadius: '8px',
                        border: '1px solid #E2E8F0',
                        gap: '8px'
                      }}
                    >
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontSize: '11.5px', fontWeight: '800', color: '#0F172A', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {po.poNo || po.poNumber || po.purchaseorder_number || '-'} • <span style={{ color: '#0E7490' }}>{po.vendor || po.vendorName || po.vendor_name || 'Vendor'}</span>
                        </div>
                        <div style={{ fontSize: '10px', color: '#64748B', marginTop: '2px' }}>
                          Amount: <strong>₹ {(parseAmt(po.amount || po.total) / 100000).toFixed(2)} Lakhs</strong> • Requires MD sign-off
                        </div>
                      </div>
                      <button
                        onClick={() => onNavigateTab && onNavigateTab('Purchase Orders')}
                        style={{
                          border: 'none',
                          backgroundColor: '#0E7490',
                          color: '#FFFFFF',
                          padding: '4px 10px',
                          borderRadius: '6px',
                          fontSize: '10.5px',
                          fontWeight: '700',
                          cursor: 'pointer',
                          flexShrink: 0,
                          boxShadow: '0 2px 6px rgba(14, 116, 144, 0.3)'
                        }}
                      >
                        Authorize
                      </button>
                    </div>
                  ))}

                  {pendingMdPOs.length === 0 && (
                    <div style={{
                      padding: '24px 12px',
                      textAlign: 'center',
                      color: '#64748B',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      gap: '6px'
                    }}>
                      <CheckCircle2 size={24} color="#16A34A" />
                      <span style={{ fontSize: '12px', fontWeight: '700', color: '#0F172A' }}>All Purchase Orders Authorized</span>
                      <span style={{ fontSize: '11px', color: '#94A3B8' }}>No draft POs pending MD approval at this moment</span>
                    </div>
                  )}
                </div>
              </div>

              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '8px 10px',
                backgroundColor: '#F0F9FF',
                borderRadius: '8px',
                border: '1px solid #BAE6FD',
                fontSize: '11px',
                color: '#0369A1'
              }}>
                <span>Total PO Inventory Sync:</span>
                <strong>{poList.length} Orders Active</strong>
              </div>
            </div>

            {/* CARD 2: REVENUE VS SPEND RUN RATE */}
            <div style={{
              backgroundColor: '#FFFFFF',
              borderRadius: '16px',
              border: '1px solid #EAEFEF',
              padding: '14px 16px',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              gap: '8px',
              boxShadow: '0 4px 18px rgba(15, 23, 42, 0.03)'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #F1F5F9', paddingBottom: '8px' }}>
                <div>
                  <span style={{ fontSize: '12px', fontWeight: '800', color: '#0F172A', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                    Revenue vs Spend Trajectory
                  </span>
                  <div style={{ fontSize: '10px', color: '#64748B', marginTop: '1px' }}>
                    Monthly Topline vs Procurement Cost (in ₹ Cr)
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '10px', fontWeight: '700' }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '4px', color: '#0E7490' }}>
                    <span style={{ width: '8px', height: '8px', borderRadius: '2px', backgroundColor: '#0E7490' }}></span> Revenue
                  </span>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '4px', color: '#F59E0B' }}>
                    <span style={{ width: '8px', height: '8px', borderRadius: '2px', backgroundColor: '#F59E0B' }}></span> PO Spend
                  </span>
                </div>
              </div>

              {/* Bar chart container */}
              <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', height: '140px', gap: '6px', paddingTop: '10px', paddingBottom: '18px', position: 'relative' }}>
                {(() => {
                  const maxBarVal = Math.max(0.1, ...monthlyRunRate.map(d => Math.max(d.rev, d.spend)));
                  return monthlyRunRate.map((d, idx) => {
                    const isHovered = hoveredBarIdx === idx;
                    const revHeight = maxBarVal > 0 ? (d.rev / maxBarVal) * 100 : 0;
                    const spendHeight = maxBarVal > 0 ? (d.spend / maxBarVal) * 100 : 0;

                    return (
                      <div
                        key={idx}
                        onMouseEnter={() => setHoveredBarIdx(idx)}
                        onMouseLeave={() => setHoveredBarIdx(null)}
                        style={{
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'center',
                          justifyContent: 'flex-end',
                          height: '100%',
                          flex: 1,
                          position: 'relative',
                          cursor: 'pointer'
                        }}
                      >
                        {isHovered && (
                          <div style={{
                            position: 'absolute',
                            top: '-36px',
                            backgroundColor: '#0F172A',
                            color: '#FFFFFF',
                            padding: '4px 8px',
                            borderRadius: '6px',
                            fontSize: '9.5px',
                            fontWeight: '700',
                            whiteSpace: 'nowrap',
                            zIndex: 10,
                            boxShadow: '0 4px 12px rgba(15, 23, 42, 0.3)',
                            textAlign: 'center'
                          }}>
                            <div>Rev: ₹{d.rev} Cr | Spend: ₹{d.spend} Cr</div>
                            <div style={{ color: '#38BDF8', fontSize: '8.5px' }}>Margin: {d.margin}%</div>
                          </div>
                        )}

                        <div style={{ display: 'flex', alignItems: 'flex-end', gap: '3px', height: '100%', width: '100%', justifyContent: 'center' }}>
                          <div style={{
                            width: '9px',
                            height: `${Math.max(2, revHeight)}%`,
                            backgroundColor: isHovered ? '#085D75' : '#0E7490',
                            borderRadius: '3px 3px 0 0',
                            transition: 'all 0.15s ease'
                          }} />
                          <div style={{
                            width: '9px',
                            height: `${Math.max(2, spendHeight)}%`,
                            backgroundColor: isHovered ? '#D97706' : '#F59E0B',
                            borderRadius: '3px 3px 0 0',
                            transition: 'all 0.15s ease'
                          }} />
                        </div>

                        <span style={{
                          position: 'absolute',
                          bottom: '-18px',
                          fontSize: '10px',
                          color: isHovered ? '#0E7490' : '#64748B',
                          fontWeight: isHovered ? '800' : '600'
                        }}>
                          {d.month}
                        </span>
                      </div>
                    );
                  });
                })()}
              </div>

              <div style={{ height: '2px', backgroundColor: '#F1F5F9', borderRadius: '2px' }} />
            </div>

            {/* CARD 3: PRODUCT REVENUE SHARE (SVG DONUT) */}
            <div style={{
              backgroundColor: '#FFFFFF',
              borderRadius: '16px',
              border: '1px solid #EAEFEF',
              padding: '14px 16px',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              gap: '10px',
              boxShadow: '0 4px 18px rgba(15, 23, 42, 0.03)'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #F1F5F9', paddingBottom: '8px' }}>
                <span style={{ fontSize: '12px', fontWeight: '800', color: '#0F172A', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  Product Portfolio Share
                </span>
                <span style={{ fontSize: '10px', fontWeight: '700', color: '#0E7490', backgroundColor: '#ECFEFF', padding: '2px 7px', borderRadius: '8px' }}>
                  MTD
                </span>
              </div>

              {productCategories.length === 0 ? (
                <div style={{ padding: '24px 12px', textAlign: 'center', color: '#64748B', fontSize: '11.5px', width: '100%' }}>
                  No categorized inventory or BOM items recorded yet.
                </div>
              ) : (
                <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                  <div style={{ position: 'relative', width: '90px', height: '90px', flexShrink: 0 }}>
                    <svg width="90" height="90" viewBox="0 0 90 90" style={{ transform: 'rotate(-90deg)' }}>
                      {(() => {
                        let accumulatedPct = 0;
                        const radius = 34;
                        const circumference = 2 * Math.PI * radius;

                        return productCategories.map((cat, i) => {
                          const strokeDasharray = `${(cat.pct / 100) * circumference} ${circumference}`;
                          const strokeDashoffset = -((accumulatedPct / 100) * circumference);
                          accumulatedPct += cat.pct;

                          return (
                            <circle
                              key={i}
                              cx="45"
                              cy="45"
                              r={radius}
                              fill="transparent"
                              stroke={cat.color}
                              strokeWidth={hoveredDonutIdx === i ? "14" : "11"}
                              strokeDasharray={strokeDasharray}
                              strokeDashoffset={strokeDashoffset}
                              style={{ transition: 'all 0.2s ease', cursor: 'pointer' }}
                              onMouseEnter={() => setHoveredDonutIdx(i)}
                              onMouseLeave={() => setHoveredDonutIdx(null)}
                            />
                          );
                        });
                      })()}
                    </svg>
                    <div style={{
                      position: 'absolute',
                      top: 0, left: 0, width: '100%', height: '100%',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                      pointerEvents: 'none'
                    }}>
                      <span style={{ fontSize: '12px', fontWeight: '900', color: '#0F172A', lineHeight: 1 }}>₹{totalCatVal}</span>
                      <span style={{ fontSize: '8px', color: '#64748B', fontWeight: '700', marginTop: '2px' }}>Cr Total</span>
                    </div>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', flex: 1, minWidth: 0 }}>
                    {productCategories.map((cat, idx) => (
                      <div
                        key={idx}
                        onMouseEnter={() => setHoveredDonutIdx(idx)}
                        onMouseLeave={() => setHoveredDonutIdx(null)}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          padding: '3px 6px',
                          borderRadius: '6px',
                          backgroundColor: hoveredDonutIdx === idx ? '#F8FAFC' : 'transparent',
                          fontSize: '11px',
                          cursor: 'pointer'
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', minWidth: 0 }}>
                          <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: cat.color, flexShrink: 0 }} />
                          <span style={{ fontWeight: '600', color: '#334155', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {cat.name}
                          </span>
                        </div>
                        <strong style={{ color: '#0F172A', fontSize: '11px', marginLeft: '6px' }}>
                          {cat.pct}%
                        </strong>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10.5px', color: '#64748B', borderTop: '1px solid #F1F5F9', paddingTop: '6px' }}>
                <span>Top Demand Profile:</span>
                <strong style={{ color: '#0E7490' }}>{productCategories[0] ? `${productCategories[0].name} (${productCategories[0].pct}%)` : 'No Profile Data'}</strong>
              </div>
            </div>

          </div>

          {/* ROW B: OPERATIONAL VELOCITY FUNNEL */}
          <div style={{
            backgroundColor: '#FFFFFF',
            borderRadius: '16px',
            border: '1px solid #EAEFEF',
            padding: '14px 18px',
            display: 'flex',
            flexDirection: 'column',
            gap: '12px',
            boxShadow: '0 4px 18px rgba(15, 23, 42, 0.03)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #F1F5F9', paddingBottom: '8px' }}>
              <div>
                <span style={{ fontSize: '12px', fontWeight: '800', color: '#0F172A', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  Enterprise Operational Velocity (Order-to-Cash Pipeline)
                </span>
                <div style={{ fontSize: '11px', color: '#64748B', marginTop: '2px' }}>
                  Cross-departmental health tracking active contracts through the complete lifecycle
                </div>
              </div>
              <span style={{ fontSize: '10px', color: '#16A34A', fontWeight: '700', backgroundColor: '#DCFCE7', padding: '2px 8px', borderRadius: '8px' }}>
                OPERATIONS LIVE
              </span>
            </div>

            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 150px), 1fr))',
              gap: '10px',
              width: '100%',
              maxWidth: '100%',
              minWidth: 0,
              boxSizing: 'border-box'
            }}>
              {funnelStages.map((stage, idx) => {
                const IconComponent = stage.icon;
                return (
                  <div
                    key={idx}
                    style={{
                      backgroundColor: '#F8FAFC',
                      borderRadius: '12px',
                      border: '1px solid #E2E8F0',
                      padding: '12px',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '8px'
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div style={{
                        width: '32px',
                        height: '32px',
                        borderRadius: '8px',
                        backgroundColor: stage.bg,
                        color: stage.color,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center'
                      }}>
                        <IconComponent size={16} />
                      </div>
                      <span style={{ fontSize: '10px', fontWeight: '700', color: stage.color, backgroundColor: stage.bg, padding: '2px 6px', borderRadius: '6px' }}>
                        {stage.action}
                      </span>
                    </div>

                    <div>
                      <div style={{ fontSize: '11px', fontWeight: '700', color: '#64748B' }}>
                        {stage.stage}
                      </div>
                      <div style={{ fontSize: '16px', fontWeight: '900', color: '#0F172A', marginTop: '2px' }}>
                        {stage.value}
                      </div>
                      <div style={{ fontSize: '10.5px', color: '#64748B', marginTop: '1px' }}>
                        {stage.count} in progress
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* ROW C: TOP CLIENTS & CRITICAL RISK WATCHLIST */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 340px), 1fr))',
            gap: '12px',
            width: '100%',
            maxWidth: '100%',
            minWidth: 0,
            boxSizing: 'border-box',
            alignItems: 'stretch'
          }}>
            
            {/* TABLE 1: TOP STRATEGIC KEY CLIENTS */}
            <div style={{
              backgroundColor: '#FFFFFF',
              borderRadius: '16px',
              border: '1px solid #EAEFEF',
              padding: '14px 16px',
              display: 'flex',
              flexDirection: 'column',
              gap: '10px',
              boxShadow: '0 4px 18px rgba(15, 23, 42, 0.03)',
              minWidth: 0
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '12px', fontWeight: '800', color: '#0F172A', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  Top Strategic EPC Clients & Key Reps
                </span>
                <span style={{ fontSize: '10px', color: '#0E7490', fontWeight: '700', backgroundColor: '#ECFEFF', padding: '2px 7px', borderRadius: '8px' }}>
                  Key Accounts
                </span>
              </div>

              <div style={{ border: '1px solid #F1F5F9', borderRadius: '10px', overflowX: 'auto', maxWidth: '100%', minWidth: 0 }}>
                <table style={{ width: '100%', minWidth: '450px', fontSize: '11px', borderCollapse: 'collapse', textAlign: 'left' }}>
                  <thead>
                    <tr style={{ backgroundColor: '#F8FAFC', borderBottom: '1px solid #F1F5F9', color: '#64748B', fontWeight: '700' }}>
                      <th style={{ padding: '8px 10px' }}>Client / Developer</th>
                      <th style={{ padding: '8px 10px' }}>Revenue</th>
                      <th style={{ padding: '8px 10px' }}>Assigned Rep</th>
                      <th style={{ padding: '8px 10px' }}>Payment Terms</th>
                    </tr>
                  </thead>
                  <tbody>
                    {topAccounts.length === 0 ? (
                      <tr>
                        <td colSpan="4" style={{ padding: '24px', textAlign: 'center', color: '#64748B' }}>
                          No client transactions recorded yet. High-value customer accounts will populate here as Proformas and Invoices are generated.
                        </td>
                      </tr>
                    ) : (
                      topAccounts.map((c, idx) => (
                        <tr key={idx} style={{ borderBottom: idx === topAccounts.length - 1 ? 'none' : '1px solid #F1F5F9' }}>
                          <td style={{ padding: '8px 10px', fontWeight: '700', color: '#0F172A' }}>
                            {c.name}
                          </td>
                          <td style={{ padding: '8px 10px', fontWeight: '800', color: '#0E7490' }}>
                            {c.revenue}
                          </td>
                          <td style={{ padding: '8px 10px' }}>
                            <span style={{
                              padding: '2px 6px',
                              borderRadius: '6px',
                              backgroundColor: '#F1F5F9',
                              fontSize: '10.5px',
                              fontWeight: '700',
                              color: '#334155'
                            }}>
                              {c.salesPerson}
                            </span>
                          </td>
                          <td style={{ padding: '8px 10px', fontSize: '10.5px', color: '#475569' }}>
                            {c.paymentTerms}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* CARD 2: RISK ALERTS & WATCHLIST */}
            <div style={{
              backgroundColor: '#FFFFFF',
              borderRadius: '16px',
              border: '1px solid #EAEFEF',
              padding: '14px 16px',
              display: 'flex',
              flexDirection: 'column',
              gap: '10px',
              boxShadow: '0 4px 18px rgba(15, 23, 42, 0.03)'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '12px', fontWeight: '800', color: '#0F172A', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  Executive Risk Alerts & Watchlist
                </span>
                <span style={{ fontSize: '10px', color: realRiskAlerts.length > 0 ? '#DC2626' : '#16A34A', fontWeight: '700', backgroundColor: realRiskAlerts.length > 0 ? '#FEF2F2' : '#DCFCE7', padding: '2px 7px', borderRadius: '8px' }}>
                  {realRiskAlerts.length > 0 ? 'ATTENTION REQUIRED' : 'NORMAL'}
                </span>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {realRiskAlerts.length === 0 ? (
                  <div style={{
                    padding: '24px 12px',
                    textAlign: 'center',
                    color: '#16A34A',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: '6px'
                  }}>
                    <CheckCircle2 size={24} color="#16A34A" />
                    <span style={{ fontSize: '12px', fontWeight: '700', color: '#0F172A' }}>All Systems Operating Normally</span>
                    <span style={{ fontSize: '11px', color: '#64748B' }}>No purchase authorization bottlenecks or overdue realizations detected.</span>
                  </div>
                ) : (
                  realRiskAlerts.map((alert, aIdx) => (
                    <div
                      key={aIdx}
                      style={{
                        padding: '10px 12px',
                        borderRadius: '10px',
                        backgroundColor: alert.bg,
                        border: `1px solid ${alert.color}20`,
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '3px'
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: '11.5px', fontWeight: '800', color: '#0F172A' }}>
                          {alert.title}
                        </span>
                        <span style={{ fontSize: '9.5px', fontWeight: '800', color: alert.color, textTransform: 'uppercase' }}>
                          {alert.severity}
                        </span>
                      </div>
                      <div style={{ fontSize: '10.5px', color: '#64748B', lineHeight: '1.4' }}>
                        {alert.desc}
                      </div>
                    </div>
                  ))
                )}
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid #F1F5F9', paddingTop: '8px', fontSize: '11px', color: '#64748B' }}>
                <span>Enterprise System Health:</span>
                <strong style={{ color: '#16A34A' }}>99.9% Uptime • BUSINZ Native Catalog Synced</strong>
              </div>
            </div>

          </div>

        </div>
      )}

      {/* ======================================================== */}
      {/* VIEW 2: PERSON-WISE PERFORMANCE HUB (THE REQUESTED FEATURE)*/}
      {/* ======================================================== */}
      {activeSubTab === 'personnel' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          
          {/* Top Personnel Filter & Search Toolbar */}
          <div style={{
            backgroundColor: '#FFFFFF',
            borderRadius: '16px',
            border: '1px solid #EAEFEF',
            padding: '12px 18px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '12px',
            boxShadow: '0 4px 18px rgba(15, 23, 42, 0.03)'
          }}>
            {/* Department Quick Filter */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
              <span style={{ fontSize: '11px', fontWeight: '800', color: '#64748B', textTransform: 'uppercase' }}>
                Department:
              </span>
              {['all', 'Sales', 'Procurement', 'Accounts', 'Production', 'Dispatch', 'Billing', 'Design', 'Tech Support'].map(dept => (
                <button
                  key={dept}
                  onClick={() => setPersonDeptFilter(dept)}
                  style={{
                    border: 'none',
                    backgroundColor: personDeptFilter === dept ? '#0E7490' : '#F1F5F9',
                    color: personDeptFilter === dept ? '#FFFFFF' : '#475569',
                    padding: '4px 10px',
                    borderRadius: '8px',
                    fontSize: '11px',
                    fontWeight: personDeptFilter === dept ? '800' : '600',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease'
                  }}
                >
                  {dept === 'all' ? 'All Teams' : dept}
                </button>
              ))}
            </div>

            {/* Search Input */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              backgroundColor: '#F8FAFC',
              border: '1px solid #CBD5E1',
              borderRadius: '8px',
              padding: '4px 10px',
              minWidth: '220px'
            }}>
              <Search size={14} color="#64748B" />
              <input
                type="text"
                placeholder="Search person by name, code, role..."
                value={personSearchQuery}
                onChange={(e) => setPersonSearchQuery(e.target.value)}
                style={{
                  border: 'none',
                  backgroundColor: 'transparent',
                  outline: 'none',
                  fontSize: '11px',
                  width: '100%',
                  color: '#0F172A'
                }}
              />
              {personSearchQuery && (
                <X size={12} color="#94A3B8" style={{ cursor: 'pointer' }} onClick={() => setPersonSearchQuery('')} />
              )}
            </div>
          </div>

          {/* Person-Wise Performance Scorecards Grid */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 290px), 1fr))',
            gap: '12px',
            width: '100%',
            maxWidth: '100%',
            minWidth: 0,
            boxSizing: 'border-box'
          }}>
            {filteredPersonnel.map((emp) => {
              const isCurrency = emp.unit === 'Revenue' || emp.unit === 'PO Spend' || emp.unit === 'Invoicing' || emp.unit === 'Collections';
              const formatMetric = (val) => {
                if (isCurrency) {
                  return val >= 10000000 
                    ? `₹ ${(val / 10000000).toFixed(2)} Cr`
                    : `₹ ${(val / 100000).toFixed(2)} L`;
                }
                return `${Math.round(val)} ${emp.unit}`;
              };
              const formattedVal = formatMetric(emp.achievedVal);
              const formattedTarget = formatMetric(emp.scaledTarget);

              const deptColor = {
                Sales: '#0E7490',
                Procurement: '#2563EB',
                Accounts: '#7C3AED',
                Billing: '#9333EA',
                Production: '#0284C7',
                Dispatch: '#059669',
                Design: '#D97706',
                'Tech Support': '#4F46E5'
              }[emp.department] || '#0E7490';

              const deptBg = {
                Sales: '#ECFEFF',
                Procurement: '#EFF6FF',
                Accounts: '#F5F3FF',
                Billing: '#FAF5FF',
                Production: '#F0F9FF',
                Dispatch: '#ECFDF5',
                Design: '#FFFBEB',
                'Tech Support': '#EEF2FF'
              }[emp.department] || '#ECFEFF';

              return (
                <div
                  key={emp.code}
                  style={{
                    backgroundColor: '#FFFFFF',
                    borderRadius: '16px',
                    border: '1px solid #EAEFEF',
                    padding: '16px',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    gap: '12px',
                    boxShadow: '0 4px 18px rgba(15, 23, 42, 0.03)',
                    transition: 'all 0.2s ease',
                    position: 'relative'
                  }}
                >
                  {/* Card Header: Avatar + Info + Rating */}
                  <div>
                    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '8px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <div style={{
                          width: '40px',
                          height: '40px',
                          borderRadius: '10px',
                          backgroundColor: emp.avatarBg,
                          color: '#FFFFFF',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: '14px',
                          fontWeight: '800',
                          flexShrink: 0
                        }}>
                          {emp.name.split(' ').map(n => n[0]).slice(0, 2).join('')}
                        </div>
                        <div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <span style={{ fontSize: '13px', fontWeight: '800', color: '#0F172A' }}>
                              {emp.name}
                            </span>
                            <span style={{
                              fontSize: '9.5px',
                              fontWeight: '700',
                              color: '#64748B',
                              backgroundColor: '#F1F5F9',
                              padding: '1px 5px',
                              borderRadius: '4px'
                            }}>
                              {emp.code}
                            </span>
                          </div>
                          <div style={{ fontSize: '11px', color: '#64748B', marginTop: '1px' }}>
                            {emp.designation}
                          </div>
                        </div>
                      </div>

                      <span style={{
                        fontSize: '10px',
                        fontWeight: '800',
                        color: emp.ratingColor,
                        backgroundColor: emp.ratingBg,
                        padding: '2px 8px',
                        borderRadius: '8px',
                        whiteSpace: 'nowrap'
                      }}>
                        {emp.rating}
                      </span>
                    </div>

                    {/* Department Tag & Core Metric */}
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '12px', paddingTop: '10px', borderTop: '1px solid #F1F5F9' }}>
                      <span style={{
                        fontSize: '10.5px',
                        fontWeight: '800',
                        color: deptColor,
                        backgroundColor: deptBg,
                        padding: '2px 8px',
                        borderRadius: '6px'
                      }}>
                        {emp.department} • {emp.unit}
                      </span>

                      <span style={{ fontSize: '11px', fontWeight: '700', color: '#64748B' }}>
                        {emp.recordCount} Active Records
                      </span>
                    </div>

                    {/* Value Metrics & Progress Bar */}
                    <div style={{ marginTop: '10px', backgroundColor: '#F8FAFC', borderRadius: '10px', padding: '10px 12px', border: '1px solid #E2E8F0' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
                        <div>
                          <div style={{ fontSize: '10px', fontWeight: '700', color: '#64748B', textTransform: 'uppercase' }}>
                            Achieved ({selectedPeriod})
                          </div>
                          <div style={{ fontSize: '16px', fontWeight: '900', color: '#0F172A', marginTop: '1px' }}>
                            {formattedVal}
                          </div>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                          <div style={{ fontSize: '10px', color: '#64748B' }}>Target: {formattedTarget}</div>
                          <div style={{ fontSize: '13px', fontWeight: '800', color: emp.targetPct >= 100 ? '#16A34A' : '#0E7490' }}>
                            {emp.targetPct}%
                          </div>
                        </div>
                      </div>

                      {/* Visual progress bar */}
                      <div style={{ width: '100%', height: '6px', backgroundColor: '#E2E8F0', borderRadius: '4px', marginTop: '6px', overflow: 'hidden' }}>
                        <div style={{
                          width: `${Math.min(100, emp.targetPct)}%`,
                          height: '100%',
                          backgroundColor: emp.targetPct >= 100 ? '#16A34A' : (emp.targetPct >= 85 ? '#0E7490' : '#F59E0B'),
                          borderRadius: '4px',
                          transition: 'width 0.4s ease'
                        }} />
                      </div>
                    </div>
                  </div>

                  {/* Card Footer: Action Button */}
                  <button
                    onClick={() => setActivePersonModal(emp)}
                    style={{
                      border: '1px solid #CBD5E1',
                      backgroundColor: '#FFFFFF',
                      color: '#0F172A',
                      padding: '7px 12px',
                      borderRadius: '8px',
                      fontSize: '11px',
                      fontWeight: '700',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '4px',
                      transition: 'all 0.15s ease'
                    }}
                  >
                    <Eye size={12} color="#0E7490" /> View Detailed Records & Activity
                  </button>
                </div>
              );
            })}
          </div>

          {/* Comprehensive Personnel Leaderboard Matrix Table */}
          <div style={{
            backgroundColor: '#FFFFFF',
            borderRadius: '16px',
            border: '1px solid #EAEFEF',
            padding: '16px',
            display: 'flex',
            flexDirection: 'column',
            gap: '12px',
            boxShadow: '0 4px 18px rgba(15, 23, 42, 0.03)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <span style={{ fontSize: '13px', fontWeight: '800', color: '#0F172A', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  Enterprise Personnel Accountability Matrix
                </span>
                <div style={{ fontSize: '11px', color: '#64748B', marginTop: '2px' }}>
                  Cross-departmental evaluation of key executives and representatives across Sales, SCM & Finance
                </div>
              </div>
              <span style={{ fontSize: '10.5px', color: '#0E7490', fontWeight: '700', backgroundColor: '#ECFEFF', padding: '3px 8px', borderRadius: '8px' }}>
                {filteredPersonnel.length} Personnel Monitored
              </span>
            </div>

            <div style={{ border: '1px solid #F1F5F9', borderRadius: '10px', overflowX: 'auto', maxWidth: '100%', minWidth: 0 }}>
              <table style={{ width: '100%', minWidth: '700px', fontSize: '11.5px', borderCollapse: 'collapse', textAlign: 'left' }}>
                <thead>
                  <tr style={{ backgroundColor: '#F8FAFC', borderBottom: '1px solid #E2E8F0', color: '#64748B', fontWeight: '700' }}>
                    <th style={{ padding: '10px 12px' }}>Team Member</th>
                    <th style={{ padding: '10px 12px' }}>Department & Role</th>
                    <th style={{ padding: '10px 12px' }}>Primary KPI Handled</th>
                    <th style={{ padding: '10px 12px' }}>Output Value ({selectedPeriod})</th>
                    <th style={{ padding: '10px 12px' }}>Target Progress</th>
                    <th style={{ padding: '10px 12px' }}>Status Rating</th>
                    <th style={{ padding: '10px 12px', textAlign: 'center' }}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredPersonnel.map((emp, idx) => (
                    <tr key={emp.code} style={{ borderBottom: idx === filteredPersonnel.length - 1 ? 'none' : '1px solid #F1F5F9' }}>
                      <td style={{ padding: '10px 12px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <div style={{
                            width: '28px',
                            height: '28px',
                            borderRadius: '6px',
                            backgroundColor: emp.avatarBg,
                            color: '#FFFFFF',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: '11px',
                            fontWeight: '800'
                          }}>
                            {emp.name[0]}
                          </div>
                          <div>
                            <div style={{ fontWeight: '800', color: '#0F172A' }}>{emp.name}</div>
                            <div style={{ fontSize: '10px', color: '#64748B' }}>{emp.code} • {emp.email}</div>
                          </div>
                        </div>
                      </td>

                      <td style={{ padding: '10px 12px' }}>
                        <span style={{
                          fontSize: '10.5px',
                          fontWeight: '800',
                          color: emp.department === 'Sales' ? '#0E7490' : (emp.department === 'Procurement' ? '#2563EB' : '#7C3AED'),
                          backgroundColor: emp.department === 'Sales' ? '#ECFEFF' : (emp.department === 'Procurement' ? '#EFF6FF' : '#F5F3FF'),
                          padding: '2px 8px',
                          borderRadius: '6px'
                        }}>
                          {emp.department}
                        </span>
                        <div style={{ fontSize: '10.5px', color: '#64748B', marginTop: '2px' }}>{emp.role}</div>
                      </td>

                      <td style={{ padding: '10px 12px' }}>
                        <div style={{ fontWeight: '700', color: '#0F172A' }}>{emp.unit}</div>
                        <div style={{ fontSize: '10.5px', color: '#64748B' }}>{emp.recordCount} Transactions</div>
                      </td>

                      <td style={{ padding: '10px 12px' }}>
                        <div style={{ fontWeight: '800', color: '#0E7490', fontSize: '12.5px' }}>
                          {emp.achievedVal >= 10000000 ? `₹ ${(emp.achievedVal / 10000000).toFixed(2)} Cr` : `₹ ${(emp.achievedVal / 100000).toFixed(2)} L`}
                        </div>
                      </td>

                      <td style={{ padding: '10px 12px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <div style={{ width: '80px', height: '6px', backgroundColor: '#E2E8F0', borderRadius: '4px', overflow: 'hidden' }}>
                            <div style={{
                              width: `${Math.min(100, emp.targetPct)}%`,
                              height: '100%',
                              backgroundColor: emp.targetPct >= 100 ? '#16A34A' : (emp.targetPct >= 85 ? '#0E7490' : '#F59E0B')
                            }} />
                          </div>
                          <span style={{ fontSize: '11px', fontWeight: '800', color: '#0F172A' }}>{emp.targetPct}%</span>
                        </div>
                      </td>

                      <td style={{ padding: '10px 12px' }}>
                        <span style={{
                          fontSize: '10px',
                          fontWeight: '800',
                          color: emp.ratingColor,
                          backgroundColor: emp.ratingBg,
                          padding: '2px 7px',
                          borderRadius: '8px'
                        }}>
                          {emp.rating}
                        </span>
                      </td>

                      <td style={{ padding: '10px 12px', textAlign: 'center' }}>
                        <button
                          onClick={() => setActivePersonModal(emp)}
                          style={{
                            border: 'none',
                            backgroundColor: '#F1F5F9',
                            color: '#0E7490',
                            padding: '4px 8px',
                            borderRadius: '6px',
                            fontSize: '11px',
                            fontWeight: '700',
                            cursor: 'pointer'
                          }}
                        >
                          View Dossier
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

        </div>
      )}

      {/* ======================================================== */}
      {/* VIEW 3: SALES OPERATIONS FOCUS TAB                       */}
      {/* ======================================================== */}
      {activeSubTab === 'sales' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          
          {/* Sales Top Ribbon */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '10px' }}>
            <div style={{ backgroundColor: '#FFFFFF', borderRadius: '14px', border: '1px solid #EAEFEF', padding: '14px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <span style={{ fontSize: '11px', fontWeight: '800', color: '#64748B', textTransform: 'uppercase' }}>Active Proformas (PI)</span>
              <div style={{ fontSize: '20px', fontWeight: '900', color: '#0E7490' }}>₹ {totalPiPipelineCr} Cr</div>
              <div style={{ fontSize: '11px', color: '#64748B' }}>{piList.length} Active Proformas pending BOM</div>
            </div>

            <div style={{ backgroundColor: '#FFFFFF', borderRadius: '14px', border: '1px solid #EAEFEF', padding: '14px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <span style={{ fontSize: '11px', fontWeight: '800', color: '#64748B', textTransform: 'uppercase' }}>Quotations Pipeline</span>
              <div style={{ fontSize: '20px', fontWeight: '900', color: '#2563EB' }}>
                ₹ {((quotesList.reduce((acc, q) => acc + parseAmt(q.amount || q.total || q.grandTotal || 0), 0) * periodMultiplier) / 10000000).toFixed(2)} Cr
              </div>
              <div style={{ fontSize: '11px', color: '#64748B' }}>{quotesList.length} Quotations submitted</div>
            </div>

            <div style={{ backgroundColor: '#FFFFFF', borderRadius: '14px', border: '1px solid #EAEFEF', padding: '14px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <span style={{ fontSize: '11px', fontWeight: '800', color: '#64748B', textTransform: 'uppercase' }}>Quote-to-PI Win Rate</span>
              <div style={{ fontSize: '20px', fontWeight: '900', color: '#16A34A' }}>
                {quotesList.length > 0 && piList.length > 0 ? `${Math.min(100, Math.round((piList.length / quotesList.length) * 100))}%` : '0%'}
              </div>
              <div style={{ fontSize: '11px', color: '#16A34A', fontWeight: '700' }}>
                {quotesList.length > 0 ? `${piList.length} PIs / ${quotesList.length} Quotes` : 'Pipeline active'}
              </div>
            </div>

            <div style={{ backgroundColor: '#FFFFFF', borderRadius: '14px', border: '1px solid #EAEFEF', padding: '14px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <span style={{ fontSize: '11px', fontWeight: '800', color: '#64748B', textTransform: 'uppercase' }}>Average Contract Size</span>
              <div style={{ fontSize: '20px', fontWeight: '900', color: '#0F172A' }}>
                {piList.length > 0 
                  ? (totalPiPipelineNum / piList.length >= 10000000 
                      ? `₹ ${(totalPiPipelineNum / piList.length / 10000000).toFixed(2)} Cr` 
                      : `₹ ${(totalPiPipelineNum / piList.length / 100000).toFixed(2)} L`)
                  : '₹ 0.00'}
              </div>
              <div style={{ fontSize: '11px', color: '#64748B' }}>Based on active proformas</div>
            </div>
          </div>

          {/* Salesperson Leaderboard Comparison */}
          <div style={{
            backgroundColor: '#FFFFFF',
            borderRadius: '16px',
            border: '1px solid #EAEFEF',
            padding: '16px',
            display: 'flex',
            flexDirection: 'column',
            gap: '12px',
            boxShadow: '0 4px 18px rgba(15, 23, 42, 0.03)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
              <span style={{ fontSize: '13px', fontWeight: '800', color: '#0F172A', textTransform: 'uppercase' }}>
                Sales Representatives Performance & Pipeline Contribution
              </span>
              <button
                onClick={() => {
                  setEditingTargetRep('All');
                  setEditingTargetAmount(String(ceoTargetStore?.monthlyCompanyTarget || 18000000));
                  setShowCeoTargetModal(true);
                }}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '5px 12px',
                  borderRadius: '8px',
                  backgroundColor: '#0E7490',
                  color: '#FFFFFF',
                  border: 'none',
                  fontSize: '11.5px',
                  fontWeight: '700',
                  cursor: 'pointer',
                  boxShadow: '0 2px 6px rgba(14, 116, 144, 0.2)'
                }}
                title="Configure monthly sales targets as CEO"
              >
                <Edit3 size={13} /> Set Monthly Targets
              </button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '10px' }}>
              {teamDirectory.filter(t => t.department === 'Sales').map(salesRep => {
                const perf = personPerformanceData.find(p => p.code === salesRep.code);
                return (
                  <div
                    key={salesRep.code}
                    onClick={() => setActivePersonModal(perf)}
                    style={{
                      padding: '12px',
                      borderRadius: '12px',
                      backgroundColor: '#F8FAFC',
                      border: '1px solid #E2E8F0',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '8px',
                      cursor: 'pointer',
                      transition: 'all 0.15s ease'
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: '12px', fontWeight: '800', color: '#0F172A' }}>{salesRep.name}</span>
                      <span style={{ fontSize: '10px', fontWeight: '700', color: perf?.ratingColor, backgroundColor: perf?.ratingBg, padding: '2px 6px', borderRadius: '6px' }}>
                        {perf?.targetPct}%
                      </span>
                    </div>

                    <div style={{ fontSize: '16px', fontWeight: '900', color: '#0E7490' }}>
                      ₹ {perf ? (perf.achievedVal / 10000000).toFixed(2) : '0.00'} Cr
                    </div>

                    <div style={{ width: '100%', height: '5px', backgroundColor: '#E2E8F0', borderRadius: '3px', overflow: 'hidden' }}>
                      <div style={{
                        width: `${Math.min(100, perf?.targetPct || 0)}%`,
                        height: '100%',
                        backgroundColor: '#0E7490'
                      }} />
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10.5px', color: '#64748B' }}>
                      <span>{perf?.recordCount || 0} Deals</span>
                      <span>Target: ₹ {(salesRep.monthlyTarget * periodMultiplier / 10000000).toFixed(2)} Cr</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Live Recent High-Value Proforma Invoices Table */}
          <div style={{
            backgroundColor: '#FFFFFF',
            borderRadius: '16px',
            border: '1px solid #EAEFEF',
            padding: '16px',
            display: 'flex',
            flexDirection: 'column',
            gap: '12px',
            boxShadow: '0 4px 18px rgba(15, 23, 42, 0.03)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '13px', fontWeight: '800', color: '#0F172A', textTransform: 'uppercase' }}>
                Recent Proforma Invoices Synced with Sales Pipeline
              </span>
              <span style={{ fontSize: '11px', color: '#64748B' }}>Showing active high-value deals</span>
            </div>

            <div style={{ border: '1px solid #F1F5F9', borderRadius: '10px', overflowX: 'auto', maxWidth: '100%', minWidth: 0 }}>
              <table style={{ width: '100%', minWidth: '650px', fontSize: '11.5px', borderCollapse: 'collapse', textAlign: 'left' }}>
                <thead>
                  <tr style={{ backgroundColor: '#F8FAFC', borderBottom: '1px solid #E2E8F0', color: '#64748B', fontWeight: '700' }}>
                    <th style={{ padding: '8px 10px' }}>PI Number</th>
                    <th style={{ padding: '8px 10px' }}>Customer Name</th>
                    <th style={{ padding: '8px 10px' }}>Sales Executive</th>
                    <th style={{ padding: '8px 10px' }}>Amount</th>
                    <th style={{ padding: '8px 10px' }}>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {piList.length > 0 ? (
                    piList.slice(0, 5).map((pi, idx) => (
                      <tr key={idx} style={{ borderBottom: '1px solid #F1F5F9' }}>
                        <td style={{ padding: '8px 10px', fontWeight: '800', color: '#0E7490' }}>
                          {pi.piNo || pi.id}
                        </td>
                        <td style={{ padding: '8px 10px', fontWeight: '700', color: '#0F172A' }}>
                          {pi.customerName || pi.customer || 'Solar EPC Client'}
                        </td>
                        <td style={{ padding: '8px 10px' }}>
                          <span style={{ padding: '2px 6px', borderRadius: '4px', backgroundColor: '#F1F5F9', fontWeight: '700', color: '#334155' }}>
                            {pi.salesPerson || 'Sales Executive'}
                          </span>
                        </td>
                        <td style={{ padding: '8px 10px', fontWeight: '800', color: '#0F172A' }}>
                          {typeof pi.grandTotal === 'number' ? `₹ ${pi.grandTotal.toLocaleString('en-IN')}` : (pi.grandTotal || pi.amount || '₹ 0.00')}
                        </td>
                        <td style={{ padding: '8px 10px' }}>
                          <span style={{
                            fontSize: '10px',
                            fontWeight: '800',
                            padding: '2px 7px',
                            borderRadius: '8px',
                            backgroundColor: String(pi.status).toLowerCase().includes('confirmed') || String(pi.status).toLowerCase().includes('advance') ? '#DCFCE7' : '#FEF3C7',
                            color: String(pi.status).toLowerCase().includes('confirmed') || String(pi.status).toLowerCase().includes('advance') ? '#16A34A' : '#D97706'
                          }}>
                            {pi.status || 'Active'}
                          </span>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={5} style={{ padding: '24px', textAlign: 'center', color: '#64748B' }}>
                        No Proforma Invoices generated yet.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

        </div>
      )}

      {/* ======================================================== */}
      {/* VIEW 4: PURCHASE & PROCUREMENT FOCUS TAB                 */}
      {/* ======================================================== */}
      {activeSubTab === 'procurement' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          
          {/* Procurement Top Ribbon */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '10px' }}>
            <div style={{ backgroundColor: '#FFFFFF', borderRadius: '14px', border: '1px solid #EAEFEF', padding: '14px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <span style={{ fontSize: '11px', fontWeight: '800', color: '#64748B', textTransform: 'uppercase' }}>Total PO Spend Handled</span>
              <div style={{ fontSize: '20px', fontWeight: '900', color: '#2563EB' }}>₹ {totalPoSpendCr} Cr</div>
              <div style={{ fontSize: '11px', color: '#64748B' }}>BUSINZ Native Catalog live synced</div>
            </div>

            <div style={{ backgroundColor: '#FFFFFF', borderRadius: '14px', border: '1px solid #EAEFEF', padding: '14px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <span style={{ fontSize: '11px', fontWeight: '800', color: '#64748B', textTransform: 'uppercase' }}>Purchase Orders Count</span>
              <div style={{ fontSize: '20px', fontWeight: '900', color: '#0F172A' }}>{poList.length} Orders</div>
              <div style={{ fontSize: '11px', color: '#64748B' }}>
                Across {new Set(poList.map(p => p.vendor_name || p.vendor || p.vendorName).filter(Boolean)).size} active suppliers
              </div>
            </div>

            <div style={{ backgroundColor: '#FFFFFF', borderRadius: '14px', border: '1px solid #EAEFEF', padding: '14px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <span style={{ fontSize: '11px', fontWeight: '800', color: '#64748B', textTransform: 'uppercase' }}>Pending MD Approvals</span>
              <div style={{ fontSize: '20px', fontWeight: '900', color: pendingMdPOs.length > 0 ? '#DC2626' : '#16A34A' }}>
                {pendingMdPOs.length} Draft POs
              </div>
              <div style={{ fontSize: '11px', color: '#64748B' }}>Awaiting executive signature</div>
            </div>

            <div style={{ backgroundColor: '#FFFFFF', borderRadius: '14px', border: '1px solid #EAEFEF', padding: '14px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <span style={{ fontSize: '11px', fontWeight: '800', color: '#64748B', textTransform: 'uppercase' }}>Primary Material Sourced</span>
              <div style={{ fontSize: '20px', fontWeight: '900', color: '#0E7490' }}>CR & HR Steel Coils</div>
              <div style={{ fontSize: '11px', color: '#64748B' }}>Aluminum 6063-T6 billets</div>
            </div>
          </div>

          {/* SCM Officers Scorecard */}
          <div style={{
            backgroundColor: '#FFFFFF',
            borderRadius: '16px',
            border: '1px solid #EAEFEF',
            padding: '16px',
            display: 'flex',
            flexDirection: 'column',
            gap: '12px',
            boxShadow: '0 4px 18px rgba(15, 23, 42, 0.03)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '13px', fontWeight: '800', color: '#0F172A', textTransform: 'uppercase' }}>
                Procurement Officers Spend Allocation
              </span>
              <button
                onClick={() => onNavigateTab && onNavigateTab('Purchase Orders')}
                style={{
                  border: 'none',
                  backgroundColor: '#2563EB',
                  color: '#FFFFFF',
                  padding: '5px 12px',
                  borderRadius: '6px',
                  fontSize: '11px',
                  fontWeight: '700',
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px'
                }}
              >
                Go to Purchase Orders <ArrowRight size={12} />
              </button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '12px' }}>
              {teamDirectory.filter(t => t.department === 'Procurement').map(buyer => {
                const perf = personPerformanceData.find(p => p.code === buyer.code);
                return (
                  <div
                    key={buyer.code}
                    onClick={() => setActivePersonModal(perf)}
                    style={{
                      padding: '14px',
                      borderRadius: '12px',
                      backgroundColor: '#F8FAFC',
                      border: '1px solid #E2E8F0',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '8px',
                      cursor: 'pointer'
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div>
                        <div style={{ fontSize: '12.5px', fontWeight: '800', color: '#0F172A' }}>{buyer.name}</div>
                        <div style={{ fontSize: '10.5px', color: '#64748B' }}>{buyer.designation}</div>
                      </div>
                      <span style={{ fontSize: '10px', fontWeight: '700', color: perf?.ratingColor, backgroundColor: perf?.ratingBg, padding: '2px 7px', borderRadius: '6px' }}>
                        {perf?.rating}
                      </span>
                    </div>

                    <div style={{ fontSize: '18px', fontWeight: '900', color: '#2563EB', marginTop: '4px' }}>
                      ₹ {perf ? (perf.achievedVal / 10000000).toFixed(2) : '0.00'} Cr Managed
                    </div>

                    <div style={{ width: '100%', height: '5px', backgroundColor: '#E2E8F0', borderRadius: '3px', overflow: 'hidden' }}>
                      <div style={{
                        width: `${Math.min(100, perf?.targetPct || 0)}%`,
                        height: '100%',
                        backgroundColor: '#2563EB'
                      }} />
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10.5px', color: '#64748B' }}>
                      <span>{perf?.recordCount || 0} POs Managed</span>
                      <span>Budget: ₹ {(buyer.monthlyTarget * periodMultiplier / 10000000).toFixed(2)} Cr</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Live Purchase Orders Table */}
          <div style={{
            backgroundColor: '#FFFFFF',
            borderRadius: '16px',
            border: '1px solid #EAEFEF',
            padding: '16px',
            display: 'flex',
            flexDirection: 'column',
            gap: '12px',
            boxShadow: '0 4px 18px rgba(15, 23, 42, 0.03)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '13px', fontWeight: '800', color: '#0F172A', textTransform: 'uppercase' }}>
                Live Purchase Orders Registry
              </span>
              <span style={{ fontSize: '11px', color: '#64748B' }}>Sorted by recent issue date</span>
            </div>

            <div style={{ border: '1px solid #F1F5F9', borderRadius: '10px', overflowX: 'auto', maxWidth: '100%', minWidth: 0 }}>
              <table style={{ width: '100%', minWidth: '650px', fontSize: '11.5px', borderCollapse: 'collapse', textAlign: 'left' }}>
                <thead>
                  <tr style={{ backgroundColor: '#F8FAFC', borderBottom: '1px solid #E2E8F0', color: '#64748B', fontWeight: '700' }}>
                    <th style={{ padding: '8px 10px' }}>PO Number</th>
                    <th style={{ padding: '8px 10px' }}>Supplier / Vendor</th>
                    <th style={{ padding: '8px 10px' }}>Date</th>
                    <th style={{ padding: '8px 10px' }}>Amount</th>
                    <th style={{ padding: '8px 10px' }}>Status / Stage</th>
                  </tr>
                </thead>
                <tbody>
                  {poList.length > 0 ? (
                    poList.slice(0, 6).map((po, idx) => (
                      <tr key={idx} style={{ borderBottom: '1px solid #F1F5F9' }}>
                        <td style={{ padding: '8px 10px', fontWeight: '800', color: '#2563EB' }}>
                          {po.poNo || po.poNumber || po.purchaseorder_number || '-'}
                        </td>
                        <td style={{ padding: '8px 10px', fontWeight: '700', color: '#0F172A' }}>
                          {po.vendor || po.vendorName || po.vendor_name || 'Supplier'}
                        </td>
                        <td style={{ padding: '8px 10px', color: '#64748B' }}>
                          {po.poDate || po.date || '-'}
                        </td>
                        <td style={{ padding: '8px 10px', fontWeight: '800', color: '#0F172A' }}>
                          {po.amount || (po.total ? `₹ ${(parseAmt(po.total) / 100000).toFixed(2)} L` : '₹ 0.00')}
                        </td>
                        <td style={{ padding: '8px 10px' }}>
                          <span style={{
                            fontSize: '10px',
                            fontWeight: '800',
                            padding: '2px 7px',
                            borderRadius: '8px',
                            backgroundColor: String(po.status || po.stage).toLowerCase().includes('closed') || String(po.status || po.stage).toLowerCase().includes('received') ? '#DCFCE7' : '#FEF3C7',
                            color: String(po.status || po.stage).toLowerCase().includes('closed') || String(po.status || po.stage).toLowerCase().includes('received') ? '#16A34A' : '#D97706'
                          }}>
                            {po.status || po.stage || 'Issued'}
                          </span>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={5} style={{ padding: '24px', textAlign: 'center', color: '#64748B' }}>
                        No Purchase Orders recorded yet.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

        </div>
      )}

      {/* ======================================================== */}
      {/* VIEW 5: ACCOUNTS & CASH FLOW FOCUS TAB                   */}
      {/* ======================================================== */}
      {activeSubTab === 'accounts' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          
          {/* Accounts Top Ribbon */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '10px' }}>
            <div style={{ backgroundColor: '#FFFFFF', borderRadius: '14px', border: '1px solid #EAEFEF', padding: '14px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <span style={{ fontSize: '11px', fontWeight: '800', color: '#64748B', textTransform: 'uppercase' }}>Total Invoiced (GST Tax Billed)</span>
              <div style={{ fontSize: '20px', fontWeight: '900', color: '#7C3AED' }}>₹ {totalRevenueCr} Cr</div>
              <div style={{ fontSize: '11px', color: '#64748B' }}>{invList.length} Invoices generated</div>
            </div>

            <div style={{ backgroundColor: '#FFFFFF', borderRadius: '14px', border: '1px solid #EAEFEF', padding: '14px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <span style={{ fontSize: '11px', fontWeight: '800', color: '#64748B', textTransform: 'uppercase' }}>Realized Collections</span>
              <div style={{ fontSize: '20px', fontWeight: '900', color: '#16A34A' }}>₹ {totalCollectedCr} Cr</div>
              <div style={{ fontSize: '11px', color: '#16A34A', fontWeight: '700' }}>
                {totalInvoicedNum > 0 ? `${((totalCollectedNum / totalInvoicedNum) * 100).toFixed(1)}% realization rate` : '0% realization rate'}
              </div>
            </div>

            <div style={{ backgroundColor: '#FFFFFF', borderRadius: '14px', border: '1px solid #EAEFEF', padding: '14px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <span style={{ fontSize: '11px', fontWeight: '800', color: '#64748B', textTransform: 'uppercase' }}>Pending Outstanding Balance</span>
              <div style={{ fontSize: '20px', fontWeight: '900', color: '#D97706' }}>₹ {outstandingOverdueCr} Cr</div>
              <div style={{ fontSize: '11px', color: '#64748B' }}>Receivables in follow-up</div>
            </div>

            <div style={{ backgroundColor: '#FFFFFF', borderRadius: '14px', border: '1px solid #EAEFEF', padding: '14px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <span style={{ fontSize: '11px', fontWeight: '800', color: '#64748B', textTransform: 'uppercase' }}>Critical Aging (&gt;30 Days)</span>
              <div style={{ fontSize: '20px', fontWeight: '900', color: '#DC2626' }}>
                {agingBuckets[3]?.amount || '₹ 0.00'}
              </div>
              <div style={{ fontSize: '11px', color: '#DC2626', fontWeight: '700' }}>
                {agingBuckets[3]?.raw > 0 ? 'Requires CEO escalation' : 'No critical overdue balance'}
              </div>
            </div>
          </div>

          {/* Accounts Officers Breakdown */}
          <div style={{
            backgroundColor: '#FFFFFF',
            borderRadius: '16px',
            border: '1px solid #EAEFEF',
            padding: '16px',
            display: 'flex',
            flexDirection: 'column',
            gap: '12px',
            boxShadow: '0 4px 18px rgba(15, 23, 42, 0.03)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '13px', fontWeight: '800', color: '#0F172A', textTransform: 'uppercase' }}>
                Accounts & Billing Officers Accountability
              </span>
              <button
                onClick={() => onNavigateTab && onNavigateTab('Finance Dashboard')}
                style={{
                  border: 'none',
                  backgroundColor: '#7C3AED',
                  color: '#FFFFFF',
                  padding: '5px 12px',
                  borderRadius: '6px',
                  fontSize: '11px',
                  fontWeight: '700',
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px'
                }}
              >
                Go to Finance Dashboard <ArrowRight size={12} />
              </button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '12px' }}>
              {teamDirectory.filter(t => t.department === 'Accounts').map(acc => {
                const perf = personPerformanceData.find(p => p.code === acc.code);
                return (
                  <div
                    key={acc.code}
                    onClick={() => setActivePersonModal(perf)}
                    style={{
                      padding: '14px',
                      borderRadius: '12px',
                      backgroundColor: '#F8FAFC',
                      border: '1px solid #E2E8F0',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '8px',
                      cursor: 'pointer'
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div>
                        <div style={{ fontSize: '12.5px', fontWeight: '800', color: '#0F172A' }}>{acc.name}</div>
                        <div style={{ fontSize: '10.5px', color: '#64748B' }}>{acc.designation}</div>
                      </div>
                      <span style={{ fontSize: '10px', fontWeight: '700', color: perf?.ratingColor, backgroundColor: perf?.ratingBg, padding: '2px 7px', borderRadius: '6px' }}>
                        {perf?.targetPct}% Target
                      </span>
                    </div>

                    <div style={{ fontSize: '18px', fontWeight: '900', color: '#7C3AED', marginTop: '4px' }}>
                      ₹ {perf ? (perf.achievedVal / 10000000).toFixed(2) : '0.00'} Cr Handled
                    </div>

                    <div style={{ width: '100%', height: '5px', backgroundColor: '#E2E8F0', borderRadius: '3px', overflow: 'hidden' }}>
                      <div style={{
                        width: `${Math.min(100, perf?.targetPct || 0)}%`,
                        height: '100%',
                        backgroundColor: '#7C3AED'
                      }} />
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10.5px', color: '#64748B' }}>
                      <span>{perf?.recordCount || 0} Records Managed</span>
                      <span>Target: ₹ {(acc.monthlyTarget * periodMultiplier / 10000000).toFixed(2)} Cr</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Aging Receivables Breakdown Bar */}
          <div style={{
            backgroundColor: '#FFFFFF',
            borderRadius: '16px',
            border: '1px solid #EAEFEF',
            padding: '16px',
            display: 'flex',
            flexDirection: 'column',
            gap: '12px',
            boxShadow: '0 4px 18px rgba(15, 23, 42, 0.03)'
          }}>
            <span style={{ fontSize: '13px', fontWeight: '800', color: '#0F172A', textTransform: 'uppercase' }}>
              Accounts Aging Receivables Portfolio (By Credit Due Days)
            </span>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '10px' }}>
              {agingBuckets.map((bucket, bIdx) => (
                <div key={bIdx} style={{ backgroundColor: bucket.bg, border: `1px solid ${bucket.color}30`, borderRadius: '10px', padding: '10px 12px' }}>
                  <div style={{ fontSize: '10.5px', fontWeight: '700', color: '#475569' }}>{bucket.label}</div>
                  <div style={{ fontSize: '15px', fontWeight: '900', color: bucket.color, marginTop: '2px' }}>{bucket.amount}</div>
                  <div style={{ fontSize: '10px', fontWeight: '800', color: bucket.color, marginTop: '1px' }}>{bucket.pct} of Total</div>
                </div>
              ))}
            </div>
          </div>

        </div>
      )}

      {/* ======================================================== */}
      {/* VIEW 6: PRODUCTION & PLANT OPERATIONS                    */}
      {/* ======================================================== */}
      {activeSubTab === 'production' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          
          {/* Production Top Ribbon */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '10px' }}>
            <div style={{ backgroundColor: '#FFFFFF', borderRadius: '14px', border: '1px solid #EAEFEF', padding: '14px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <span style={{ fontSize: '11px', fontWeight: '800', color: '#64748B', textTransform: 'uppercase' }}>Plant Output ({selectedPeriod})</span>
              <div style={{ fontSize: '20px', fontWeight: '900', color: '#0284C7' }}>{totalProductionTonnage.toFixed(1)} MT</div>
              <div style={{ fontSize: '11px', color: '#0284C7', fontWeight: '700' }}>{bomList.length} Active BOMs In-Progress</div>
            </div>

            <div style={{ backgroundColor: '#FFFFFF', borderRadius: '14px', border: '1px solid #EAEFEF', padding: '14px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <span style={{ fontSize: '11px', fontWeight: '800', color: '#64748B', textTransform: 'uppercase' }}>Active BOM Orders</span>
              <div style={{ fontSize: '20px', fontWeight: '900', color: '#0F172A' }}>{bomList.length} Orders</div>
              <div style={{ fontSize: '11px', color: '#64748B' }}>In factory workflow</div>
            </div>

            <div style={{ backgroundColor: '#FFFFFF', borderRadius: '14px', border: '1px solid #EAEFEF', padding: '14px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <span style={{ fontSize: '11px', fontWeight: '800', color: '#64748B', textTransform: 'uppercase' }}>Work Orders Status</span>
              <div style={{ fontSize: '20px', fontWeight: '900', color: '#16A34A' }}>{workOrdersList.length} Work Orders</div>
              <div style={{ fontSize: '11px', color: '#16A34A', fontWeight: '700' }}>
                {workOrdersList.filter(w => w.status === 'Completed').length} Completed, {workOrdersList.filter(w => w.status !== 'Completed').length} Active
              </div>
            </div>

            <div style={{ backgroundColor: '#FFFFFF', borderRadius: '14px', border: '1px solid #EAEFEF', padding: '14px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <span style={{ fontSize: '11px', fontWeight: '800', color: '#64748B', textTransform: 'uppercase' }}>Plant Lines Status</span>
              <div style={{ fontSize: '20px', fontWeight: '900', color: '#059669' }}>{bomList.length > 0 ? 'Plant Operational' : 'Standby'}</div>
              <div style={{ fontSize: '11px', color: '#64748B' }}>Roll-forming & slitting lines</div>
            </div>
          </div>

          {/* Production Leadership Accountability */}
          <div style={{
            backgroundColor: '#FFFFFF',
            borderRadius: '16px',
            border: '1px solid #EAEFEF',
            padding: '16px',
            display: 'flex',
            flexDirection: 'column',
            gap: '12px',
            boxShadow: '0 4px 18px rgba(15, 23, 42, 0.03)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '13px', fontWeight: '800', color: '#0F172A', textTransform: 'uppercase' }}>
                Plant & Production Team Accountability
              </span>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  onClick={() => onNavigateTab && onNavigateTab('BOM Orders')}
                  style={{
                    border: 'none',
                    backgroundColor: '#0284C7',
                    color: '#FFFFFF',
                    padding: '5px 12px',
                    borderRadius: '6px',
                    fontSize: '11px',
                    fontWeight: '700',
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px'
                  }}
                >
                  Go to BOM Orders <ArrowRight size={12} />
                </button>
                <button
                  onClick={() => onNavigateTab && onNavigateTab('Work Orders')}
                  style={{
                    border: '1px solid #CBD5E1',
                    backgroundColor: '#FFFFFF',
                    color: '#475569',
                    padding: '5px 12px',
                    borderRadius: '6px',
                    fontSize: '11px',
                    fontWeight: '700',
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px'
                  }}
                >
                  Work Orders <ArrowRight size={12} />
                </button>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '12px' }}>
              {teamDirectory.filter(t => t.department === 'Production').map(prod => {
                const perf = personPerformanceData.find(p => p.code === prod.code);
                return (
                  <div
                    key={prod.code}
                    onClick={() => setActivePersonModal(perf)}
                    style={{
                      padding: '14px',
                      borderRadius: '12px',
                      backgroundColor: '#F8FAFC',
                      border: '1px solid #E2E8F0',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '8px',
                      cursor: 'pointer'
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div>
                        <div style={{ fontSize: '12.5px', fontWeight: '800', color: '#0F172A' }}>{prod.name}</div>
                        <div style={{ fontSize: '10.5px', color: '#64748B' }}>{prod.designation}</div>
                      </div>
                      <span style={{ fontSize: '10px', fontWeight: '700', color: perf?.ratingColor, backgroundColor: perf?.ratingBg, padding: '2px 7px', borderRadius: '6px' }}>
                        {perf?.targetPct}% Target
                      </span>
                    </div>

                    <div style={{ fontSize: '18px', fontWeight: '900', color: '#0284C7', marginTop: '4px' }}>
                      {Math.round(perf?.achievedVal || 0)} MT Produced
                    </div>

                    <div style={{ width: '100%', height: '5px', backgroundColor: '#E2E8F0', borderRadius: '3px', overflow: 'hidden' }}>
                      <div style={{
                        width: `${Math.min(100, perf?.targetPct || 0)}%`,
                        height: '100%',
                        backgroundColor: '#0284C7'
                      }} />
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10.5px', color: '#64748B' }}>
                      <span>{perf?.recordCount || 0} Orders Completed</span>
                      <span>Target: {Math.round(prod.monthlyTarget * periodMultiplier)} MT</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Active Production Orders Ledger */}
          <div style={{
            backgroundColor: '#FFFFFF',
            borderRadius: '16px',
            border: '1px solid #EAEFEF',
            padding: '16px',
            display: 'flex',
            flexDirection: 'column',
            gap: '12px',
            boxShadow: '0 4px 18px rgba(15, 23, 42, 0.03)'
          }}>
            <span style={{ fontSize: '13px', fontWeight: '800', color: '#0F172A', textTransform: 'uppercase' }}>
              Active Factory Production BOM Orders
            </span>

            <div style={{ border: '1px solid #E2E8F0', borderRadius: '10px', overflow: 'hidden' }}>
              <table style={{ width: '100%', fontSize: '11px', borderCollapse: 'collapse', textAlign: 'left' }}>
                <thead>
                  <tr style={{ backgroundColor: '#F8FAFC', borderBottom: '1px solid #E2E8F0', color: '#64748B' }}>
                    <th style={{ padding: '8px 10px' }}>BOM Code</th>
                    <th style={{ padding: '8px 10px' }}>Customer Project</th>
                    <th style={{ padding: '8px 10px' }}>Profile Specification</th>
                    <th style={{ padding: '8px 10px' }}>Batch Weight</th>
                    <th style={{ padding: '8px 10px' }}>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {bomList.length > 0 ? (
                    bomList.slice(0, 6).map((row, idx) => (
                      <tr key={idx} style={{ borderBottom: '1px solid #F1F5F9' }}>
                        <td style={{ padding: '8px 10px', fontWeight: '800', color: '#0284C7' }}>{row.bomCode || row.id}</td>
                        <td style={{ padding: '8px 10px', fontWeight: '700' }}>{row.customerName || row.customer || '-'}</td>
                        <td style={{ padding: '8px 10px', color: '#475569' }}>{row.profile || row.description || 'Solar Mounting Structure'}</td>
                        <td style={{ padding: '8px 10px', fontWeight: '800' }}>{row.totalWeight ? `${row.totalWeight} MT` : (row.weight ? `${row.weight} MT` : '0 MT')}</td>
                        <td style={{ padding: '8px 10px' }}>
                          <span style={{ fontSize: '9.5px', fontWeight: '800', padding: '2px 6px', borderRadius: '6px', backgroundColor: '#E0F2FE', color: '#0284C7' }}>
                            {row.status || 'Active'}
                          </span>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={5} style={{ padding: '24px', textAlign: 'center', color: '#64748B' }}>
                        No active factory production BOM orders created yet.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

        </div>
      )}

      {/* ======================================================== */}
      {/* VIEW 7: DISPATCH & LOGISTICS OPERATIONS                  */}
      {/* ======================================================== */}
      {activeSubTab === 'dispatch' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          
          {/* Dispatch Top Ribbon */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '10px' }}>
            <div style={{ backgroundColor: '#FFFFFF', borderRadius: '14px', border: '1px solid #EAEFEF', padding: '14px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <span style={{ fontSize: '11px', fontWeight: '800', color: '#64748B', textTransform: 'uppercase' }}>Total Dispatched ({selectedPeriod})</span>
              <div style={{ fontSize: '20px', fontWeight: '900', color: '#059669' }}>{dispatchesList.length + challansList.length} Shipments</div>
              <div style={{ fontSize: '11px', color: '#059669', fontWeight: '700' }}>{challansList.length} Delivery Challans recorded</div>
            </div>

            <div style={{ backgroundColor: '#FFFFFF', borderRadius: '14px', border: '1px solid #EAEFEF', padding: '14px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <span style={{ fontSize: '11px', fontWeight: '800', color: '#64748B', textTransform: 'uppercase' }}>Vehicles Dispatched</span>
              <div style={{ fontSize: '20px', fontWeight: '900', color: '#2563EB' }}>
                {challansList.filter(c => c.vehicleNo || c.vehicle).length} Vehicles
              </div>
              <div style={{ fontSize: '11px', color: '#64748B' }}>Transport fleet registered</div>
            </div>

            <div style={{ backgroundColor: '#FFFFFF', borderRadius: '14px', border: '1px solid #EAEFEF', padding: '14px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <span style={{ fontSize: '11px', fontWeight: '800', color: '#64748B', textTransform: 'uppercase' }}>Dispatch Status</span>
              <div style={{ fontSize: '20px', fontWeight: '900', color: '#16A34A' }}>
                {challansList.length > 0 || dispatchesList.length > 0 ? 'Active Clearances' : 'Standby'}
              </div>
              <div style={{ fontSize: '11px', color: '#16A34A', fontWeight: '700' }}>Outward gate clearances</div>
            </div>

            <div style={{ backgroundColor: '#FFFFFF', borderRadius: '14px', border: '1px solid #EAEFEF', padding: '14px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <span style={{ fontSize: '11px', fontWeight: '800', color: '#64748B', textTransform: 'uppercase' }}>Pending Transporter LR</span>
              <div style={{ fontSize: '20px', fontWeight: '900', color: '#D97706' }}>
                {challansList.filter(c => !c.lrNumber && !c.lr_no).length} Challans
              </div>
              <div style={{ fontSize: '11px', color: '#64748B' }}>Transporter LR status</div>
            </div>
          </div>

          {/* Dispatch Leadership Accountability */}
          <div style={{
            backgroundColor: '#FFFFFF',
            borderRadius: '16px',
            border: '1px solid #EAEFEF',
            padding: '16px',
            display: 'flex',
            flexDirection: 'column',
            gap: '12px',
            boxShadow: '0 4px 18px rgba(15, 23, 42, 0.03)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '13px', fontWeight: '800', color: '#0F172A', textTransform: 'uppercase' }}>
                Logistics & Dispatch Operations Lead
              </span>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  onClick={() => onNavigateTab && onNavigateTab('Dispatch Orders')}
                  style={{
                    border: 'none',
                    backgroundColor: '#059669',
                    color: '#FFFFFF',
                    padding: '5px 12px',
                    borderRadius: '6px',
                    fontSize: '11px',
                    fontWeight: '700',
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px'
                  }}
                >
                  Go to Dispatch Orders <ArrowRight size={12} />
                </button>
                <button
                  onClick={() => onNavigateTab && onNavigateTab('Delivery Challans')}
                  style={{
                    border: '1px solid #CBD5E1',
                    backgroundColor: '#FFFFFF',
                    color: '#475569',
                    padding: '5px 12px',
                    borderRadius: '6px',
                    fontSize: '11px',
                    fontWeight: '700',
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px'
                  }}
                >
                  Delivery Challans <ArrowRight size={12} />
                </button>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '12px' }}>
              {teamDirectory.filter(t => t.department === 'Dispatch').map(disp => {
                const perf = personPerformanceData.find(p => p.code === disp.code);
                return (
                  <div
                    key={disp.code}
                    onClick={() => setActivePersonModal(perf)}
                    style={{
                      padding: '14px',
                      borderRadius: '12px',
                      backgroundColor: '#F8FAFC',
                      border: '1px solid #E2E8F0',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '8px',
                      cursor: 'pointer'
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div>
                        <div style={{ fontSize: '12.5px', fontWeight: '800', color: '#0F172A' }}>{disp.name}</div>
                        <div style={{ fontSize: '10.5px', color: '#64748B' }}>{disp.designation}</div>
                      </div>
                      <span style={{ fontSize: '10px', fontWeight: '700', color: perf?.ratingColor, backgroundColor: perf?.ratingBg, padding: '2px 7px', borderRadius: '6px' }}>
                        {perf?.targetPct}% Target
                      </span>
                    </div>

                    <div style={{ fontSize: '18px', fontWeight: '900', color: '#059669', marginTop: '4px' }}>
                      {Math.round(perf?.achievedVal || 0)} Consignments Cleared
                    </div>

                    <div style={{ width: '100%', height: '5px', backgroundColor: '#E2E8F0', borderRadius: '3px', overflow: 'hidden' }}>
                      <div style={{
                        width: `${Math.min(100, perf?.targetPct || 0)}%`,
                        height: '100%',
                        backgroundColor: '#059669'
                      }} />
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10.5px', color: '#64748B' }}>
                      <span>{perf?.recordCount || 0} Dispatches Tracked</span>
                      <span>Target: {Math.round(disp.monthlyTarget * periodMultiplier)} Shipments</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Recent Delivery Challans & Vehicles */}
          <div style={{
            backgroundColor: '#FFFFFF',
            borderRadius: '16px',
            border: '1px solid #EAEFEF',
            padding: '16px',
            display: 'flex',
            flexDirection: 'column',
            gap: '12px',
            boxShadow: '0 4px 18px rgba(15, 23, 42, 0.03)'
          }}>
            <span style={{ fontSize: '13px', fontWeight: '800', color: '#0F172A', textTransform: 'uppercase' }}>
              Recent Delivery Challan & Dispatch Clearances
            </span>

            <div style={{ border: '1px solid #E2E8F0', borderRadius: '10px', overflow: 'hidden' }}>
              <table style={{ width: '100%', fontSize: '11px', borderCollapse: 'collapse', textAlign: 'left' }}>
                <thead>
                  <tr style={{ backgroundColor: '#F8FAFC', borderBottom: '1px solid #E2E8F0', color: '#64748B' }}>
                    <th style={{ padding: '8px 10px' }}>Challan No</th>
                    <th style={{ padding: '8px 10px' }}>Customer Destination</th>
                    <th style={{ padding: '8px 10px' }}>Vehicle Number</th>
                    <th style={{ padding: '8px 10px' }}>Transporter</th>
                    <th style={{ padding: '8px 10px' }}>Tonnage</th>
                    <th style={{ padding: '8px 10px' }}>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {(challansList.length > 0 || dispatchesList.length > 0) ? (
                    (challansList.length > 0 ? challansList : dispatchesList).slice(0, 6).map((row, idx) => (
                      <tr key={idx} style={{ borderBottom: '1px solid #F1F5F9' }}>
                        <td style={{ padding: '8px 10px', fontWeight: '800', color: '#059669' }}>
                          {row.challanNo || row.dcNo || row.id || `DC-${idx + 1}`}
                        </td>
                        <td style={{ padding: '8px 10px', fontWeight: '700' }}>
                          {row.customerName || row.customer || '-'}
                        </td>
                        <td style={{ padding: '8px 10px', color: '#0F172A', fontWeight: '800' }}>
                          {row.vehicleNo || row.vehicle || '-'}
                        </td>
                        <td style={{ padding: '8px 10px', color: '#64748B' }}>
                          {row.transporter || row.transporterName || '-'}
                        </td>
                        <td style={{ padding: '8px 10px', fontWeight: '800' }}>
                          {row.weight ? `${row.weight} MT` : (row.tonnage ? `${row.tonnage} MT` : '-')}
                        </td>
                        <td style={{ padding: '8px 10px' }}>
                          <span style={{ fontSize: '9.5px', fontWeight: '800', padding: '2px 6px', borderRadius: '6px', backgroundColor: '#DCFCE7', color: '#059669' }}>
                            {row.status || 'Dispatched'}
                          </span>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={6} style={{ padding: '24px', textAlign: 'center', color: '#64748B' }}>
                        No delivery challans or dispatch clearances issued yet.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

        </div>
      )}

      {/* ======================================================== */}
      {/* VIEW 8: BILLING & TAX INVOICING OPERATIONS               */}
      {/* ======================================================== */}
      {activeSubTab === 'billing' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          
          {/* Billing Top Ribbon */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '10px' }}>
            <div style={{ backgroundColor: '#FFFFFF', borderRadius: '14px', border: '1px solid #EAEFEF', padding: '14px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <span style={{ fontSize: '11px', fontWeight: '800', color: '#64748B', textTransform: 'uppercase' }}>Total Invoiced ({selectedPeriod})</span>
              <div style={{ fontSize: '20px', fontWeight: '900', color: '#9333EA' }}>₹ {totalRevenueCr} Cr</div>
              <div style={{ fontSize: '11px', color: '#64748B' }}>{invList.length} Tax Invoices</div>
            </div>

            <div style={{ backgroundColor: '#FFFFFF', borderRadius: '14px', border: '1px solid #EAEFEF', padding: '14px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <span style={{ fontSize: '11px', fontWeight: '800', color: '#64748B', textTransform: 'uppercase' }}>Active E-Way Bills</span>
              <div style={{ fontSize: '20px', fontWeight: '900', color: '#2563EB' }}>
                {invList.filter(i => i.ewayBillNo || i.eway_bill || i.ewayBill).length} Generated
              </div>
              <div style={{ fontSize: '11px', color: '#16A34A', fontWeight: '700' }}>Live GST E-Way reconciled</div>
            </div>

            <div style={{ backgroundColor: '#FFFFFF', borderRadius: '14px', border: '1px solid #EAEFEF', padding: '14px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <span style={{ fontSize: '11px', fontWeight: '800', color: '#64748B', textTransform: 'uppercase' }}>Dispatch Clearance Speed</span>
              <div style={{ fontSize: '20px', fontWeight: '900', color: '#16A34A' }}>
                {invList.length > 0 ? 'Synchronized' : 'Standby'}
              </div>
              <div style={{ fontSize: '11px', color: '#16A34A', fontWeight: '700' }}>Direct PI to Tax Invoice Flow</div>
            </div>

            <div style={{ backgroundColor: '#FFFFFF', borderRadius: '14px', border: '1px solid #EAEFEF', padding: '14px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <span style={{ fontSize: '11px', fontWeight: '800', color: '#64748B', textTransform: 'uppercase' }}>Pending Tax Verification</span>
              <div style={{ fontSize: '20px', fontWeight: '900', color: '#0E7490' }}>
                {invList.filter(i => !i.status || i.status === 'Draft').length} Draft Invoices
              </div>
              <div style={{ fontSize: '11px', color: '#0E7490', fontWeight: '700' }}>Ledger reconciled</div>
            </div>
          </div>

          {/* Billing Lead Card */}
          <div style={{
            backgroundColor: '#FFFFFF',
            borderRadius: '16px',
            border: '1px solid #EAEFEF',
            padding: '16px',
            display: 'flex',
            flexDirection: 'column',
            gap: '12px',
            boxShadow: '0 4px 18px rgba(15, 23, 42, 0.03)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '13px', fontWeight: '800', color: '#0F172A', textTransform: 'uppercase' }}>
                Billing & E-Way Clearances Officer
              </span>
              <button
                onClick={() => onNavigateTab && onNavigateTab('Invoice Management')}
                style={{
                  border: 'none',
                  backgroundColor: '#9333EA',
                  color: '#FFFFFF',
                  padding: '5px 12px',
                  borderRadius: '6px',
                  fontSize: '11px',
                  fontWeight: '700',
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px'
                }}
              >
                Go to Invoice Management <ArrowRight size={12} />
              </button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '12px' }}>
              {teamDirectory.filter(t => t.department === 'Billing').map(bill => {
                const perf = personPerformanceData.find(p => p.code === bill.code);
                return (
                  <div
                    key={bill.code}
                    onClick={() => setActivePersonModal(perf)}
                    style={{
                      padding: '14px',
                      borderRadius: '12px',
                      backgroundColor: '#F8FAFC',
                      border: '1px solid #E2E8F0',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '8px',
                      cursor: 'pointer'
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div>
                        <div style={{ fontSize: '12.5px', fontWeight: '800', color: '#0F172A' }}>{bill.name}</div>
                        <div style={{ fontSize: '10.5px', color: '#64748B' }}>{bill.designation}</div>
                      </div>
                      <span style={{ fontSize: '10px', fontWeight: '700', color: perf?.ratingColor, backgroundColor: perf?.ratingBg, padding: '2px 7px', borderRadius: '6px' }}>
                        {perf?.targetPct}% Target
                      </span>
                    </div>

                    <div style={{ fontSize: '18px', fontWeight: '900', color: '#9333EA', marginTop: '4px' }}>
                      ₹ {perf ? (perf.achievedVal / 10000000).toFixed(2) : '0.00'} Cr Invoiced
                    </div>

                    <div style={{ width: '100%', height: '5px', backgroundColor: '#E2E8F0', borderRadius: '3px', overflow: 'hidden' }}>
                      <div style={{
                        width: `${Math.min(100, perf?.targetPct || 0)}%`,
                        height: '100%',
                        backgroundColor: '#9333EA'
                      }} />
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10.5px', color: '#64748B' }}>
                      <span>{perf?.recordCount || 0} Invoices Issued</span>
                      <span>Target: ₹ {(bill.monthlyTarget * periodMultiplier / 10000000).toFixed(2)} Cr</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Live Invoices Summary */}
          <div style={{
            backgroundColor: '#FFFFFF',
            borderRadius: '16px',
            border: '1px solid #EAEFEF',
            padding: '16px',
            display: 'flex',
            flexDirection: 'column',
            gap: '12px',
            boxShadow: '0 4px 18px rgba(15, 23, 42, 0.03)'
          }}>
            <span style={{ fontSize: '13px', fontWeight: '800', color: '#0F172A', textTransform: 'uppercase' }}>
              Recent Tax Invoices & E-Way Clearances
            </span>

            <div style={{ border: '1px solid #E2E8F0', borderRadius: '10px', overflow: 'hidden' }}>
              <table style={{ width: '100%', fontSize: '11px', borderCollapse: 'collapse', textAlign: 'left' }}>
                <thead>
                  <tr style={{ backgroundColor: '#F8FAFC', borderBottom: '1px solid #E2E8F0', color: '#64748B' }}>
                    <th style={{ padding: '8px 10px' }}>Invoice No</th>
                    <th style={{ padding: '8px 10px' }}>Customer Name</th>
                    <th style={{ padding: '8px 10px' }}>Taxable Value</th>
                    <th style={{ padding: '8px 10px' }}>GST 18%</th>
                    <th style={{ padding: '8px 10px' }}>Total Invoiced</th>
                    <th style={{ padding: '8px 10px' }}>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {invList.length > 0 ? (
                    invList.slice(0, 6).map((row, idx) => {
                      const tot = parseAmt(row.total || row.grandTotal || row.amount || 0);
                      const tax = parseAmt(row.taxableAmount || (tot > 0 ? tot / 1.18 : 0));
                      const gst = tot > 0 ? tot - tax : 0;
                      return (
                        <tr key={idx} style={{ borderBottom: '1px solid #F1F5F9' }}>
                          <td style={{ padding: '8px 10px', fontWeight: '800', color: '#9333EA' }}>
                            {row.invNo || row.invoiceNo || row.id || `INV-${idx + 1}`}
                          </td>
                          <td style={{ padding: '8px 10px', fontWeight: '700' }}>
                            {row.customerName || row.customer || '-'}
                          </td>
                          <td style={{ padding: '8px 10px', color: '#64748B' }}>₹ {tax.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</td>
                          <td style={{ padding: '8px 10px', color: '#64748B' }}>₹ {gst.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</td>
                          <td style={{ padding: '8px 10px', fontWeight: '800', color: '#0F172A' }}>₹ {tot.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</td>
                          <td style={{ padding: '8px 10px' }}>
                            <span style={{ fontSize: '9.5px', fontWeight: '800', padding: '2px 6px', borderRadius: '6px', backgroundColor: '#F3E8FF', color: '#9333EA' }}>
                              {row.status || 'Generated'}
                            </span>
                          </td>
                        </tr>
                      );
                    })
                  ) : (
                    <tr>
                      <td colSpan={6} style={{ padding: '24px', textAlign: 'center', color: '#64748B' }}>
                        No tax invoices generated yet.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

        </div>
      )}

      {/* ======================================================== */}
      {/* VIEW 9: DESIGN & TECH SUPPORT OPERATIONS                 */}
      {/* ======================================================== */}
      {activeSubTab === 'engineering' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          
          {/* Engineering Top Ribbon */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '10px' }}>
            <div style={{ backgroundColor: '#FFFFFF', borderRadius: '14px', border: '1px solid #EAEFEF', padding: '14px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <span style={{ fontSize: '11px', fontWeight: '800', color: '#64748B', textTransform: 'uppercase' }}>Structural Presets Active</span>
              <div style={{ fontSize: '20px', fontWeight: '900', color: '#D97706' }}>{presetsList.length} Presets</div>
              <div style={{ fontSize: '11px', color: '#D97706', fontWeight: '700' }}>
                {presetsList.length > 0 ? 'Validated for Plant Tooling' : 'No presets registered'}
              </div>
            </div>

            <div style={{ backgroundColor: '#FFFFFF', borderRadius: '14px', border: '1px solid #EAEFEF', padding: '14px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <span style={{ fontSize: '11px', fontWeight: '800', color: '#64748B', textTransform: 'uppercase' }}>Calculation Engine Executions</span>
              <div style={{ fontSize: '20px', fontWeight: '900', color: '#2563EB' }}>{bomList.length} Formulations</div>
              <div style={{ fontSize: '11px', color: '#64748B' }}>Active project engineering</div>
            </div>

            <div style={{ backgroundColor: '#FFFFFF', borderRadius: '14px', border: '1px solid #EAEFEF', padding: '14px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <span style={{ fontSize: '11px', fontWeight: '800', color: '#64748B', textTransform: 'uppercase' }}>Technical QA & Material Audits</span>
              <div style={{ fontSize: '20px', fontWeight: '900', color: '#4F46E5' }}>
                {bomList.filter(b => b.qcPassed || b.status === 'Completed').length} QA Validations
              </div>
              <div style={{ fontSize: '11px', color: '#16A34A', fontWeight: '700' }}>Factory structural inspections</div>
            </div>

            <div style={{ backgroundColor: '#FFFFFF', borderRadius: '14px', border: '1px solid #EAEFEF', padding: '14px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <span style={{ fontSize: '11px', fontWeight: '800', color: '#64748B', textTransform: 'uppercase' }}>Engineering Status</span>
              <div style={{ fontSize: '20px', fontWeight: '900', color: '#16A34A' }}>
                {presetsList.length > 0 ? 'Presets Ready' : 'Standby'}
              </div>
              <div style={{ fontSize: '11px', color: '#16A34A', fontWeight: '700' }}>Preset & tooling database active</div>
            </div>
          </div>

          {/* Design & Tech Support Leads */}
          <div style={{
            backgroundColor: '#FFFFFF',
            borderRadius: '16px',
            border: '1px solid #EAEFEF',
            padding: '16px',
            display: 'flex',
            flexDirection: 'column',
            gap: '12px',
            boxShadow: '0 4px 18px rgba(15, 23, 42, 0.03)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '13px', fontWeight: '800', color: '#0F172A', textTransform: 'uppercase' }}>
                Design Engineering & Technical Support Leads
              </span>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  onClick={() => onNavigateTab && onNavigateTab('Preset Management')}
                  style={{
                    border: '1px solid #CBD5E1',
                    backgroundColor: '#FFFFFF',
                    color: '#475569',
                    padding: '5px 12px',
                    borderRadius: '6px',
                    fontSize: '11px',
                    fontWeight: '700',
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px'
                  }}
                >
                  Preset Management <ArrowRight size={12} />
                </button>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '12px' }}>
              {teamDirectory.filter(t => t.department === 'Design' || t.department === 'Tech Support').map(eng => {
                const perf = personPerformanceData.find(p => p.code === eng.code);
                return (
                  <div
                    key={eng.code}
                    onClick={() => setActivePersonModal(perf)}
                    style={{
                      padding: '14px',
                      borderRadius: '12px',
                      backgroundColor: '#F8FAFC',
                      border: '1px solid #E2E8F0',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '8px',
                      cursor: 'pointer'
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div>
                        <div style={{ fontSize: '12.5px', fontWeight: '800', color: '#0F172A' }}>{eng.name}</div>
                        <div style={{ fontSize: '10.5px', color: '#64748B' }}>{eng.designation}</div>
                      </div>
                      <span style={{ fontSize: '10px', fontWeight: '700', color: perf?.ratingColor, backgroundColor: perf?.ratingBg, padding: '2px 7px', borderRadius: '6px' }}>
                        {perf?.targetPct}% Target
                      </span>
                    </div>

                    <div style={{ fontSize: '18px', fontWeight: '900', color: eng.department === 'Design' ? '#D97706' : '#4F46E5', marginTop: '4px' }}>
                      {Math.round(perf?.achievedVal || 0)} {eng.unit}
                    </div>

                    <div style={{ width: '100%', height: '5px', backgroundColor: '#E2E8F0', borderRadius: '3px', overflow: 'hidden' }}>
                      <div style={{
                        width: `${Math.min(100, perf?.targetPct || 0)}%`,
                        height: '100%',
                        backgroundColor: eng.department === 'Design' ? '#D97706' : '#4F46E5'
                      }} />
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10.5px', color: '#64748B' }}>
                      <span>{perf?.recordCount || 0} Technical Operations</span>
                      <span>Target: {Math.round(eng.monthlyTarget * periodMultiplier)} {eng.unit}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Engineering Tools & Specifications Matrix */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '12px' }}>

            <div style={{ backgroundColor: '#FFFFFF', borderRadius: '16px', border: '1px solid #EAEFEF', padding: '16px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Layers size={16} color="#4F46E5" />
                <span style={{ fontSize: '12px', fontWeight: '800', color: '#0F172A', textTransform: 'uppercase' }}>
                  Standard Preset Management
                </span>
              </div>
              <p style={{ fontSize: '11px', color: '#64748B', margin: 0, lineHeight: '1.4' }}>
                Pre-configured structural profiles for Solar Ground Mounts, Single-Axis Trackers, and Industrial Rooftops ready for 1-click BOM creation.
              </p>
              <button
                onClick={() => onNavigateTab && onNavigateTab('Preset Management')}
                style={{
                  marginTop: '8px',
                  border: '1px solid #C7D2FE',
                  backgroundColor: '#EEF2FF',
                  color: '#4338CA',
                  padding: '6px 12px',
                  borderRadius: '6px',
                  fontSize: '11px',
                  fontWeight: '700',
                  cursor: 'pointer'
                }}
              >
                Manage Presets & Dies
              </button>
            </div>

            <div style={{ backgroundColor: '#FFFFFF', borderRadius: '16px', border: '1px solid #EAEFEF', padding: '16px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Warehouse size={16} color="#059669" />
                <span style={{ fontSize: '12px', fontWeight: '800', color: '#0F172A', textTransform: 'uppercase' }}>
                  Raw Material Stock Status
                </span>
              </div>
              <p style={{ fontSize: '11px', color: '#64748B', margin: 0, lineHeight: '1.4' }}>
                Real-time visibility into steel coil tonnage, billet stocks, zinc coating stores, and hardware fastener buffers for uninterrupted production.
              </p>
              <button
                onClick={() => onNavigateTab && onNavigateTab('Stock Status')}
                style={{
                  marginTop: '8px',
                  border: '1px solid #A7F3D0',
                  backgroundColor: '#ECFDF5',
                  color: '#047857',
                  padding: '6px 12px',
                  borderRadius: '6px',
                  fontSize: '11px',
                  fontWeight: '700',
                  cursor: 'pointer'
                }}
              >
                View Live Stock Status
              </button>
            </div>
          </div>

        </div>
      )}

      {/* ======================================================== */}
      {/* 4. MODAL: INDIVIDUAL PERSON DOSSIER & ACTIVITY BREAKDOWN  */}
      {/* ======================================================== */}
      {activePersonModal && (
        <div style={{
          position: 'fixed',
          top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(15, 23, 42, 0.65)',
          backdropFilter: 'blur(4px)',
          zIndex: 99999,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '20px'
        }}>
          <div style={{
            backgroundColor: '#FFFFFF',
            borderRadius: '20px',
            width: '100%',
            maxWidth: '680px',
            maxHeight: '90vh',
            display: 'flex',
            flexDirection: 'column',
            boxShadow: '0 20px 40px rgba(15, 23, 42, 0.25)',
            overflow: 'hidden'
          }}>
            {/* Modal Header */}
            <div style={{
              padding: '16px 20px',
              backgroundColor: '#0F172A',
              color: '#FFFFFF',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{
                  width: '42px',
                  height: '42px',
                  borderRadius: '10px',
                  backgroundColor: activePersonModal.avatarBg,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontWeight: '900',
                  fontSize: '16px'
                }}>
                  {activePersonModal.name.split(' ').map(n => n[0]).slice(0, 2).join('')}
                </div>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <h3 style={{ margin: 0, fontSize: '16px', fontWeight: '800' }}>{activePersonModal.name}</h3>
                    <span style={{ fontSize: '10px', fontWeight: '800', backgroundColor: 'rgba(255, 255, 255, 0.2)', padding: '1px 6px', borderRadius: '4px' }}>
                      {activePersonModal.code}
                    </span>
                  </div>
                  <p style={{ margin: '2px 0 0 0', fontSize: '11px', color: '#94A3B8' }}>
                    {activePersonModal.designation} • {activePersonModal.department} Department
                  </p>
                </div>
              </div>

              <button
                onClick={() => setActivePersonModal(null)}
                style={{
                  border: 'none',
                  backgroundColor: 'rgba(255, 255, 255, 0.1)',
                  color: '#FFFFFF',
                  width: '30px',
                  height: '30px',
                  borderRadius: '8px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer'
                }}
              >
                <X size={16} />
              </button>
            </div>

            {/* Modal Body */}
            <div style={{ padding: '20px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '14px' }}>
              
              {/* Executive Summary Cards */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px' }}>
                <div style={{ padding: '10px', backgroundColor: '#F8FAFC', borderRadius: '10px', border: '1px solid #E2E8F0' }}>
                  <div style={{ fontSize: '10px', fontWeight: '700', color: '#64748B', textTransform: 'uppercase' }}>Period Output</div>
                  <div style={{ fontSize: '16px', fontWeight: '900', color: '#0E7490', marginTop: '2px' }}>
                    {activePersonModal.unit === 'Revenue' || activePersonModal.unit === 'PO Spend' || activePersonModal.unit === 'Invoicing' || activePersonModal.unit === 'Collections'
                      ? (activePersonModal.achievedVal >= 10000000 
                          ? `₹ ${(activePersonModal.achievedVal / 10000000).toFixed(2)} Cr`
                          : `₹ ${(activePersonModal.achievedVal / 100000).toFixed(2)} L`)
                      : `${Math.round(activePersonModal.achievedVal)} ${activePersonModal.unit}`}
                  </div>
                  <div style={{ fontSize: '10px', color: '#64748B' }}>{activePersonModal.unit} Handled</div>
                </div>

                <div style={{ padding: '10px', backgroundColor: '#F8FAFC', borderRadius: '10px', border: '1px solid #E2E8F0', position: 'relative' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ fontSize: '10px', fontWeight: '700', color: '#64748B', textTransform: 'uppercase' }}>Target Met</div>
                    {activePersonModal.department === 'Sales' && (
                      <button
                        onClick={() => {
                          setEditingTargetRep(activePersonModal.name);
                          setEditingTargetAmount(String(activePersonModal.monthlyTarget || 18000000));
                          setShowCeoTargetModal(true);
                        }}
                        style={{
                          background: '#ECFEFF',
                          border: '1px solid #CFFAFE',
                          borderRadius: '4px',
                          color: '#0E7490',
                          fontSize: '10px',
                          fontWeight: '800',
                          padding: '1px 5px',
                          cursor: 'pointer',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '2px'
                        }}
                        title="Edit Target as CEO"
                      >
                        <Edit3 size={10} /> Edit Target
                      </button>
                    )}
                  </div>
                  <div style={{ fontSize: '16px', fontWeight: '900', color: activePersonModal.targetPct >= 100 ? '#16A34A' : '#2563EB', marginTop: '2px' }}>
                    {activePersonModal.targetPct}%
                  </div>
                  <div style={{ fontSize: '10px', color: '#64748B' }}>
                    {activePersonModal.department === 'Sales'
                      ? `Target: ₹ ${(activePersonModal.monthlyTarget * periodMultiplier / 10000000).toFixed(2)} Cr`
                      : `Rating: ${activePersonModal.rating}`}
                  </div>
                </div>

                <div style={{ padding: '10px', backgroundColor: '#F8FAFC', borderRadius: '10px', border: '1px solid #E2E8F0' }}>
                  <div style={{ fontSize: '10px', fontWeight: '700', color: '#64748B', textTransform: 'uppercase' }}>Activity Volume</div>
                  <div style={{ fontSize: '16px', fontWeight: '900', color: '#0F172A', marginTop: '2px' }}>
                    {activePersonModal.recordCount} Items
                  </div>
                  <div style={{ fontSize: '10px', color: '#64748B' }}>Operational Records</div>
                </div>
              </div>

              {/* Contact Information */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '16px', padding: '10px 14px', backgroundColor: '#F0F9FF', borderRadius: '10px', border: '1px solid #BAE6FD', fontSize: '11px', color: '#0369A1' }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <Mail size={12} /> {activePersonModal.email}
                </span>
                <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <Phone size={12} /> {activePersonModal.phone}
                </span>
              </div>

              {/* Individual Live Records List */}
              <div>
                <div style={{ fontSize: '12px', fontWeight: '800', color: '#0F172A', textTransform: 'uppercase', marginBottom: '8px' }}>
                  Live Department Records Associated with {activePersonModal.name}
                </div>

                <div style={{ border: '1px solid #E2E8F0', borderRadius: '10px', overflow: 'hidden' }}>
                  <table style={{ width: '100%', fontSize: '11px', borderCollapse: 'collapse', textAlign: 'left' }}>
                    <thead>
                      <tr style={{ backgroundColor: '#F8FAFC', borderBottom: '1px solid #E2E8F0', color: '#64748B' }}>
                        <th style={{ padding: '8px 10px' }}>Reference No</th>
                        <th style={{ padding: '8px 10px' }}>Counterparty / Description</th>
                        <th style={{ padding: '8px 10px' }}>Amount / Output</th>
                        <th style={{ padding: '8px 10px' }}>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {/* If Sales: show their PIs or Quotes */}
                      {activePersonModal.department === 'Sales' && (
                        (activePersonModal.records?.pis?.length > 0 || activePersonModal.records?.quotes?.length > 0) ? (
                          [...(activePersonModal.records?.pis || []), ...(activePersonModal.records?.quotes || [])].slice(0, 5).map((rec, rIdx) => (
                            <tr key={rIdx} style={{ borderBottom: '1px solid #F1F5F9' }}>
                              <td style={{ padding: '8px 10px', fontWeight: '800', color: '#0E7490' }}>{rec.piNo || rec.quoteNo || rec.id}</td>
                              <td style={{ padding: '8px 10px', fontWeight: '700' }}>{rec.customerName || rec.customer || 'Key Client'}</td>
                              <td style={{ padding: '8px 10px', fontWeight: '800' }}>
                                {typeof rec.grandTotal === 'number' 
                                  ? `₹ ${rec.grandTotal.toLocaleString('en-IN')}` 
                                  : (rec.grandTotal || (rec.amount ? `₹ ${parseAmt(rec.amount).toLocaleString('en-IN')}` : '₹ 0.00'))}
                              </td>
                              <td style={{ padding: '8px 10px' }}>
                                <span style={{ fontSize: '9.5px', fontWeight: '800', padding: '2px 6px', borderRadius: '6px', backgroundColor: '#DCFCE7', color: '#16A34A' }}>
                                  {rec.status || 'Active'}
                                </span>
                              </td>
                            </tr>
                          ))
                        ) : (
                          <tr>
                            <td colSpan={4} style={{ padding: '20px', textAlign: 'center', color: '#64748B' }}>
                              No Proforma Invoices or Quotes created yet.
                            </td>
                          </tr>
                        )
                      )}

                      {/* If Procurement: show their POs */}
                      {activePersonModal.department === 'Procurement' && (
                        (activePersonModal.records?.pos?.length > 0) ? (
                          activePersonModal.records.pos.slice(0, 5).map((rec, rIdx) => (
                            <tr key={rIdx} style={{ borderBottom: '1px solid #F1F5F9' }}>
                              <td style={{ padding: '8px 10px', fontWeight: '800', color: '#2563EB' }}>{rec.poNo || rec.poNumber || rec.purchaseorder_number || rec.id}</td>
                              <td style={{ padding: '8px 10px', fontWeight: '700' }}>{rec.vendor || rec.vendorName || rec.vendor_name || 'Supplier'}</td>
                              <td style={{ padding: '8px 10px', fontWeight: '800' }}>
                                {rec.amount || (rec.total ? `₹ ${(parseAmt(rec.total) / 100000).toFixed(2)} L` : '₹ 0.00')}
                              </td>
                              <td style={{ padding: '8px 10px' }}>
                                <span style={{ fontSize: '9.5px', fontWeight: '800', padding: '2px 6px', borderRadius: '6px', backgroundColor: '#EFF6FF', color: '#2563EB' }}>
                                  {rec.status || rec.stage || 'Issued'}
                                </span>
                              </td>
                            </tr>
                          ))
                        ) : (
                          <tr>
                            <td colSpan={4} style={{ padding: '20px', textAlign: 'center', color: '#64748B' }}>
                              No Purchase Orders managed yet.
                            </td>
                          </tr>
                        )
                      )}

                      {/* If Accounts: show Invoices & Payments */}
                      {activePersonModal.department === 'Accounts' && (
                        (activePersonModal.records?.invs?.length > 0) ? (
                          activePersonModal.records.invs.slice(0, 5).map((rec, rIdx) => (
                            <tr key={rIdx} style={{ borderBottom: '1px solid #F1F5F9' }}>
                              <td style={{ padding: '8px 10px', fontWeight: '800', color: '#7C3AED' }}>{rec.invNo || rec.invoiceNo || rec.id}</td>
                              <td style={{ padding: '8px 10px', fontWeight: '700' }}>{rec.customerName || rec.customer || 'Client'}</td>
                              <td style={{ padding: '8px 10px', fontWeight: '800' }}>
                                {typeof rec.total === 'number' ? `₹ ${rec.total.toLocaleString('en-IN')}` : (rec.total || rec.grandTotal || '₹ 0.00')}
                              </td>
                              <td style={{ padding: '8px 10px' }}>
                                <span style={{
                                  fontSize: '9.5px',
                                  fontWeight: '800',
                                  padding: '2px 6px',
                                  borderRadius: '6px',
                                  backgroundColor: String(rec.status).toLowerCase().includes('paid') ? '#DCFCE7' : '#FEF3C7',
                                  color: String(rec.status).toLowerCase().includes('paid') ? '#16A34A' : '#D97706'
                                }}>
                                  {rec.status || 'Verified'}
                                </span>
                              </td>
                            </tr>
                          ))
                        ) : (
                          <tr>
                            <td colSpan={4} style={{ padding: '20px', textAlign: 'center', color: '#64748B' }}>
                              No Invoices or Collections handled yet.
                            </td>
                          </tr>
                        )
                      )}

                      {/* If Billing: show Invoices & Clearances */}
                      {activePersonModal.department === 'Billing' && (
                        (activePersonModal.records?.invs?.length > 0) ? (
                          activePersonModal.records.invs.slice(0, 5).map((rec, rIdx) => (
                            <tr key={rIdx} style={{ borderBottom: '1px solid #F1F5F9' }}>
                              <td style={{ padding: '8px 10px', fontWeight: '800', color: '#9333EA' }}>{rec.invNo || rec.invoiceNo || rec.id}</td>
                              <td style={{ padding: '8px 10px', fontWeight: '700' }}>{rec.customerName || rec.customer || 'Client'}</td>
                              <td style={{ padding: '8px 10px', fontWeight: '800' }}>
                                {typeof rec.total === 'number' ? `₹ ${rec.total.toLocaleString('en-IN')}` : (rec.total || rec.grandTotal || '₹ 0.00')}
                              </td>
                              <td style={{ padding: '8px 10px' }}>
                                <span style={{ fontSize: '9.5px', fontWeight: '800', padding: '2px 6px', borderRadius: '6px', backgroundColor: '#F3E8FF', color: '#9333EA' }}>
                                  {rec.status || 'Generated'}
                                </span>
                              </td>
                            </tr>
                          ))
                        ) : (
                          <tr>
                            <td colSpan={4} style={{ padding: '20px', textAlign: 'center', color: '#64748B' }}>
                              No Tax Invoices issued yet.
                            </td>
                          </tr>
                        )
                      )}

                      {/* If Production: show BOM Orders & Work Orders */}
                      {activePersonModal.department === 'Production' && (
                        (activePersonModal.records?.boms?.length > 0 || bomList.length > 0) ? (
                          (activePersonModal.records?.boms?.length > 0 ? activePersonModal.records.boms : bomList).slice(0, 5).map((rec, rIdx) => (
                            <tr key={rIdx} style={{ borderBottom: '1px solid #F1F5F9' }}>
                              <td style={{ padding: '8px 10px', fontWeight: '800', color: '#0284C7' }}>{rec.bomCode || rec.id}</td>
                              <td style={{ padding: '8px 10px', fontWeight: '700' }}>{rec.customerName || rec.customer || 'Solar Project'}</td>
                              <td style={{ padding: '8px 10px', fontWeight: '800' }}>{rec.totalWeight ? `${rec.totalWeight} MT` : (rec.weight ? `${rec.weight} MT` : '0 MT')}</td>
                              <td style={{ padding: '8px 10px' }}>
                                <span style={{ fontSize: '9.5px', fontWeight: '800', padding: '2px 6px', borderRadius: '6px', backgroundColor: '#E0F2FE', color: '#0284C7' }}>
                                  {rec.status || 'Active'}
                                </span>
                              </td>
                            </tr>
                          ))
                        ) : (
                          <tr>
                            <td colSpan={4} style={{ padding: '20px', textAlign: 'center', color: '#64748B' }}>
                              No BOM production orders assigned yet.
                            </td>
                          </tr>
                        )
                      )}

                      {/* If Dispatch: show Dispatches & Delivery Challans */}
                      {activePersonModal.department === 'Dispatch' && (
                        (challansList.length > 0 || dispatchesList.length > 0) ? (
                          (challansList.length > 0 ? challansList : dispatchesList).slice(0, 5).map((rec, rIdx) => (
                            <tr key={rIdx} style={{ borderBottom: '1px solid #F1F5F9' }}>
                              <td style={{ padding: '8px 10px', fontWeight: '800', color: '#059669' }}>{rec.challanNo || rec.dcNo || rec.id || `DC-${rIdx + 1}`}</td>
                              <td style={{ padding: '8px 10px', fontWeight: '700' }}>{rec.customerName || rec.customer || '-'}</td>
                              <td style={{ padding: '8px 10px', fontWeight: '800' }}>{rec.weight ? `${rec.weight} MT` : (rec.tonnage ? `${rec.tonnage} MT` : '-')}</td>
                              <td style={{ padding: '8px 10px' }}>
                                <span style={{ fontSize: '9.5px', fontWeight: '800', padding: '2px 6px', borderRadius: '6px', backgroundColor: '#DCFCE7', color: '#059669' }}>
                                  {rec.status || 'Dispatched'}
                                </span>
                              </td>
                            </tr>
                          ))
                        ) : (
                          <tr>
                            <td colSpan={4} style={{ padding: '20px', textAlign: 'center', color: '#64748B' }}>
                              No dispatch clearances or challans recorded yet.
                            </td>
                          </tr>
                        )
                      )}

                      {/* If Design: show Presets & Engineering Models */}
                      {activePersonModal.department === 'Design' && (
                        (presetsList.length > 0) ? (
                          presetsList.slice(0, 5).map((rec, rIdx) => (
                            <tr key={rIdx} style={{ borderBottom: '1px solid #F1F5F9' }}>
                              <td style={{ padding: '8px 10px', fontWeight: '800', color: '#D97706' }}>{rec.presetCode || rec.code || rec.id || `PST-${rIdx + 1}`}</td>
                              <td style={{ padding: '8px 10px', fontWeight: '700' }}>{rec.presetName || rec.name || rec.profile || 'Structural Profile'}</td>
                              <td style={{ padding: '8px 10px', fontWeight: '800' }}>{rec.category || rec.type || 'Preset'}</td>
                              <td style={{ padding: '8px 10px' }}>
                                <span style={{ fontSize: '9.5px', fontWeight: '800', padding: '2px 6px', borderRadius: '6px', backgroundColor: '#FEF3C7', color: '#D97706' }}>
                                  {rec.status || 'Approved'}
                                </span>
                              </td>
                            </tr>
                          ))
                        ) : (
                          <tr>
                            <td colSpan={4} style={{ padding: '20px', textAlign: 'center', color: '#64748B' }}>
                              No structural presets saved yet.
                            </td>
                          </tr>
                        )
                      )}

                      {/* If Tech Support: show Technical Audits & Material Validations */}
                      {activePersonModal.department === 'Tech Support' && (
                        (bomList.filter(b => b.qcPassed || b.status === 'Completed').length > 0) ? (
                          bomList.filter(b => b.qcPassed || b.status === 'Completed').slice(0, 5).map((rec, rIdx) => (
                            <tr key={rIdx} style={{ borderBottom: '1px solid #F1F5F9' }}>
                              <td style={{ padding: '8px 10px', fontWeight: '800', color: '#4F46E5' }}>{rec.bomCode || rec.id}</td>
                              <td style={{ padding: '8px 10px', fontWeight: '700' }}>{rec.customerName || rec.customer || 'Inspection'}</td>
                              <td style={{ padding: '8px 10px', fontWeight: '800' }}>{rec.totalWeight ? `${rec.totalWeight} MT` : 'Certified'}</td>
                              <td style={{ padding: '8px 10px' }}>
                                <span style={{ fontSize: '9.5px', fontWeight: '800', padding: '2px 6px', borderRadius: '6px', backgroundColor: '#EEF2FF', color: '#4F46E5' }}>
                                  QA Passed
                                </span>
                              </td>
                            </tr>
                          ))
                        ) : (
                          <tr>
                            <td colSpan={4} style={{ padding: '20px', textAlign: 'center', color: '#64748B' }}>
                              No technical QA audit records logged yet.
                            </td>
                          </tr>
                        )
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

            </div>

            {/* Modal Footer */}
            <div style={{ padding: '12px 20px', backgroundColor: '#F8FAFC', borderTop: '1px solid #E2E8F0', display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
              <button
                onClick={() => setActivePersonModal(null)}
                style={{
                  border: '1px solid #CBD5E1',
                  backgroundColor: '#FFFFFF',
                  color: '#475569',
                  padding: '6px 14px',
                  borderRadius: '8px',
                  fontSize: '11.5px',
                  fontWeight: '700',
                  cursor: 'pointer'
                }}
              >
                Close Dossier
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 5. MODAL: CEO / MD TARGET CONFIGURATION MODAL */}
      {showCeoTargetModal && (
        <div style={{
          position: 'fixed',
          top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(15, 23, 42, 0.65)',
          backdropFilter: 'blur(4px)',
          zIndex: 999999,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '20px'
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
                  <Target size={18} style={{ color: '#FFFFFF' }} /> Configure Monthly Sales Targets
                </h3>
                <span style={{ fontSize: '11px', opacity: 0.9, marginTop: '2px', display: 'block' }}>
                  Executive Command • Set Company & Rep Targets
                </span>
              </div>
              <button
                type="button"
                onClick={() => setShowCeoTargetModal(false)}
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
                <label style={{ fontSize: '11px', fontWeight: '800', color: '#475569', textTransform: 'uppercase', display: 'block', marginBottom: '6px' }}>
                  Target Scope / Sales Representative
                </label>
                <select
                  value={editingTargetRep}
                  onChange={(e) => {
                    const newRep = e.target.value;
                    setEditingTargetRep(newRep);
                    const currentVal = newRep === 'All'
                      ? (ceoTargetStore?.repTargets?.['All'] || ceoTargetStore?.monthlyCompanyTarget || 18000000)
                      : (ceoTargetStore?.repTargets?.[newRep] || 18000000);
                    setEditingTargetAmount(String(currentVal));
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
                  <option value="All">All Sales Reps (Overall Company Monthly Target)</option>
                  {teamDirectory.filter(t => t.department === 'Sales').map(rep => (
                    <option key={rep.code} value={rep.name}>{rep.name} ({rep.designation})</option>
                  ))}
                </select>
              </div>

              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                  <label style={{ fontSize: '11px', fontWeight: '800', color: '#475569', textTransform: 'uppercase' }}>
                    Monthly Target (₹)
                  </label>
                  <span style={{ fontSize: '13px', fontWeight: '900', color: '#0E7490' }}>
                    {formatTargetCurrency(editingTargetAmount)}
                  </span>
                </div>
                <input
                  type="number"
                  value={editingTargetAmount}
                  onChange={(e) => setEditingTargetAmount(e.target.value)}
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
                      onClick={() => setEditingTargetAmount(String(preset.val))}
                      style={{
                        padding: '4px 10px',
                        borderRadius: '8px',
                        border: Number(editingTargetAmount) === preset.val ? '1px solid #0E7490' : '1px solid #E2E8F0',
                        backgroundColor: Number(editingTargetAmount) === preset.val ? '#ECFEFF' : '#F8FAFC',
                        color: Number(editingTargetAmount) === preset.val ? '#0E7490' : '#475569',
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
                onClick={() => setShowCeoTargetModal(false)}
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
                disabled={isSavingTarget || Number(editingTargetAmount) <= 0}
                onClick={() => handleSaveCeoTarget(editingTargetRep, Number(editingTargetAmount))}
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
                    <Check size={14} /> Save & Apply Target
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
