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
  LayoutDashboard, Wrench, Boxes, Package, FileCheck, ClipboardList, Calculator, CheckCircle, Warehouse, Edit3
} from 'lucide-react';
import { fetchCloudStore } from '../../utils/supabaseDataSync';
import { fetchWithTimeout } from '../../utils/fetchWithTimeout';

// Canonical BUSINZ KPI Grid Component for all CEO Dashboards
function CeoKpiGrid({ kpis }) {
  if (!kpis || !kpis.length) return null;
  return (
    <div 
      className="ceo-kpi-grid"
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
        gap: '10px',
        width: '100%',
        maxWidth: '100%',
        minWidth: 0,
        boxSizing: 'border-box'
      }}
    >
      {kpis.map((kpi, kIdx) => {
        const IconComp = kpi.icon;
        const isUp = kpi.trendUp;
        const isNeutral = kpi.trendNeutral;
        const trendBg = isUp ? '#ECFDF5' : (isNeutral ? '#F1F5F9' : '#FEF2F2');
        const trendBorder = isUp ? '1px solid #A7F3D0' : (isNeutral ? '1px solid #E2E8F0' : '1px solid #FECACA');
        const trendText = isUp ? '#059669' : (isNeutral ? '#475569' : '#DC2626');
        const highlightColor = kpi.bottomHighlightColor || (isUp ? '#059669' : (isNeutral ? '#0F172A' : '#DC2626'));
        
        return (
          <div 
            key={kIdx}
            onClick={kpi.onClick}
            style={{
              backgroundColor: '#FFFFFF',
              borderRadius: '16px',
              border: kpi.highlightCard ? '1.5px solid #FCA5A5' : '1px solid #EAEFEF',
              padding: '12px 14px',
              display: 'flex',
              flexDirection: 'column',
              gap: '8px',
              boxShadow: kpi.highlightCard ? '0 4px 18px rgba(220, 38, 38, 0.08)' : '0 4px 18px rgba(15, 23, 42, 0.03)',
              cursor: kpi.onClick ? 'pointer' : 'default',
              transition: 'all 0.2s ease',
              minWidth: 0,
              boxSizing: 'border-box'
            }}
          >
            {/* Top Main Section */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '6px' }}>
                <span 
                  style={{ 
                    fontSize: '11px', 
                    fontWeight: '800', 
                    color: '#64748B', 
                    letterSpacing: '0.04em', 
                    textTransform: 'uppercase', 
                    whiteSpace: 'nowrap', 
                    overflow: 'hidden', 
                    textOverflow: 'ellipsis' 
                  }}
                >
                  {kpi.title}
                </span>
                {IconComp && (
                  <div style={{
                    width: '24px',
                    height: '24px',
                    borderRadius: '6px',
                    backgroundColor: kpi.iconBg || '#F1F5F9',
                    color: kpi.iconColor || '#475569',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0
                  }}>
                    <IconComp size={13} />
                  </div>
                )}
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                <span style={{ fontSize: '20px', fontWeight: '900', color: kpi.highlightCard ? '#DC2626' : (kpi.valColor || '#0F172A'), letterSpacing: '-0.5px', lineHeight: '1.1' }}>
                  {kpi.value}
                </span>
                
                {kpi.trend !== undefined && kpi.trend !== null && (
                  <span 
                    style={{ 
                      display: 'inline-flex', 
                      alignItems: 'center', 
                      gap: '2px', 
                      fontSize: '11px', 
                      fontWeight: '800', 
                      color: trendText, 
                      backgroundColor: trendBg, 
                      border: trendBorder, 
                      padding: '1.5px 6px', 
                      borderRadius: '6px', 
                      lineHeight: '1.2' 
                    }}
                  >
                    {!kpi.hideTrendIcon && (
                      isUp ? (
                        <ArrowUpRight style={{ width: '12px', height: '12px' }} />
                      ) : (
                        <ArrowDownRight style={{ width: '12px', height: '12px' }} />
                      )
                    )}
                    {kpi.trend}
                  </span>
                )}
              </div>
            </div>

            {/* Bottom Sub-Card Box */}
            <div 
              style={{ 
                backgroundColor: '#F8FAFC', 
                border: '1px solid #F1F5F9', 
                borderRadius: '10px', 
                padding: '6px 10px', 
                fontSize: '11px', 
                fontWeight: '500', 
                color: '#64748B', 
                lineHeight: '1.3', 
                whiteSpace: 'nowrap', 
                overflow: 'hidden', 
                textOverflow: 'ellipsis' 
              }}
            >
              <span>{kpi.bottomPrefix}</span>
              <span style={{ color: highlightColor, fontWeight: '800' }}>
                {kpi.bottomHighlight}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default function CeoExecutiveDashboardView({ userRole = 'CEO', onNavigateTab }) {
  // Navigation & filtering states
  const [activeSubTab, setActiveSubTab] = useState(() => {
    return localStorage.getItem('controlroom_ceo_sub_tab') || 'overview';
  });

  useEffect(() => {
    const handleSubTabChange = (e) => {
      if (e?.detail?.subTab) {
        setActiveSubTab(e.detail.subTab);
      }
    };
    window.addEventListener('controlroom_ceo_subtab_change', handleSubTabChange);
    const initial = localStorage.getItem('controlroom_ceo_sub_tab');
    if (initial) {
      setActiveSubTab(initial);
    }
    return () => window.removeEventListener('controlroom_ceo_subtab_change', handleSubTabChange);
  }, []);

  const [selectedPeriod, setSelectedPeriod] = useState('MTD');
  const [personDeptFilter, setPersonDeptFilter] = useState('all');
  const [personSearchQuery, setPersonSearchQuery] = useState('');
  const [activePersonModal, setActivePersonModal] = useState(null);
  const [viewingRepBomsModal, setViewingRepBomsModal] = useState(null);
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

  // Live operational data stores (unfiltered master records from DB)
  const [allPoList, setPoList] = useState([]);
  const [allPiList, setPiList] = useState([]);
  const [allBomList, setBomList] = useState([]);
  const [allInvList, setInvList] = useState([]);
  const [allQuotesList, setQuotesList] = useState([]);
  const [allPaymentsList, setPaymentsList] = useState([]);
  const [customersList, setCustomersList] = useState([]);
  const [allLeadsList, setLeadsList] = useState([]);
  const [allWorkOrdersList, setWorkOrdersList] = useState([]);
  const [allDispatchesList, setDispatchesList] = useState([]);
  const [allChallansList, setChallansList] = useState([]);
  const [presetsList, setPresetsList] = useState([]);
  const [inventoryList, setInventoryList] = useState([]);
  const [allGrnList, setGrnList] = useState([]);
  const [employeesList, setEmployeesList] = useState([]);
  const [loading, setLoading] = useState(true);

  // Real date parser across all BUSINZ record formats (ISO, YYYY-MM-DD, DD/MM/YYYY, DD-MM-YYYY, DD MMM YYYY)
  const parseRecordDate = (rec) => {
    if (!rec || typeof rec !== 'object') return null;
    const candidates = [
      rec.piDate, rec.bomDate, rec.poDate, rec.invoiceDate, rec.grnDate,
      rec.paymentDate, rec.dispatchDate, rec.date, rec.salesConfirmedAt,
      rec.createdAt, rec.created_at, rec.dateTimeObj?.date,
      rec.accountsVerification?.paymentDate, rec.stockDeductionDate,
      rec.updatedAt, rec.updated_at
    ];
    for (const raw of candidates) {
      if (!raw) continue;
      const s = String(raw).trim();
      if (!s) continue;
      // DD/MM/YYYY or DD-MM-YYYY
      const dmy = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/);
      if (dmy) {
        const d = new Date(Number(dmy[3]), Number(dmy[2]) - 1, Number(dmy[1]));
        if (!isNaN(d.getTime())) return d;
      }
      // YYYY-MM-DD
      const ymd = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
      if (ymd) {
        const d = new Date(Number(ymd[1]), Number(ymd[2]) - 1, Number(ymd[3]));
        if (!isNaN(d.getTime())) return d;
      }
      const parsed = new Date(s);
      if (!isNaN(parsed.getTime())) return parsed;
    }
    return null;
  };

  // Real date-range matcher for Today, This Week, MTD, Q2 FY27, YTD
  const matchesSelectedPeriod = (rec, period) => {
    const d = parseRecordDate(rec);
    if (!d) {
      return period === 'YTD';
    }
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
    const todayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);

    if (period === 'Today') {
      return d >= todayStart && d <= todayEnd;
    }
    if (period === 'This Week') {
      const weekStart = new Date(todayStart);
      const dayOfWeek = weekStart.getDay(); // 0 = Sun, 1 = Mon ...
      const diffToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
      weekStart.setDate(weekStart.getDate() - diffToMonday);
      return d >= weekStart && d <= todayEnd;
    }
    if (period === 'MTD') {
      return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
    }
    if (period === 'Q2 FY27') {
      // Indian Financial Year 2026-27 Q2: 1 Jul 2026 – 30 Sep 2026
      const q2Start = new Date(2026, 6, 1, 0, 0, 0, 0);
      const q2End = new Date(2026, 8, 30, 23, 59, 59, 999);
      return d >= q2Start && d <= q2End;
    }
    if (period === 'YTD') {
      // Current Financial/Calendar Year (from Jan 1, 2026 through today)
      const ytdStart = new Date(now.getFullYear(), 0, 1, 0, 0, 0, 0);
      return d >= ytdStart && d <= todayEnd;
    }
    return true;
  };

  // Period-filtered operational arrays (100% real database records filtered by selectedPeriod)
  const poList = useMemo(() => allPoList.filter(r => matchesSelectedPeriod(r, selectedPeriod)), [allPoList, selectedPeriod]);
  const piList = useMemo(() => allPiList.filter(r => matchesSelectedPeriod(r, selectedPeriod)), [allPiList, selectedPeriod]);
  const bomList = useMemo(() => allBomList.filter(r => matchesSelectedPeriod(r, selectedPeriod)), [allBomList, selectedPeriod]);
  const invList = useMemo(() => allInvList.filter(r => matchesSelectedPeriod(r, selectedPeriod)), [allInvList, selectedPeriod]);
  const quotesList = useMemo(() => allQuotesList.filter(r => matchesSelectedPeriod(r, selectedPeriod)), [allQuotesList, selectedPeriod]);
  const paymentsList = useMemo(() => allPaymentsList.filter(r => matchesSelectedPeriod(r, selectedPeriod)), [allPaymentsList, selectedPeriod]);
  const leadsList = useMemo(() => allLeadsList.filter(r => matchesSelectedPeriod(r, selectedPeriod)), [allLeadsList, selectedPeriod]);
  const workOrdersList = useMemo(() => allWorkOrdersList.filter(r => matchesSelectedPeriod(r, selectedPeriod)), [allWorkOrdersList, selectedPeriod]);
  const dispatchesList = useMemo(() => allDispatchesList.filter(r => matchesSelectedPeriod(r, selectedPeriod)), [allDispatchesList, selectedPeriod]);
  const challansList = useMemo(() => allChallansList.filter(r => matchesSelectedPeriod(r, selectedPeriod)), [allChallansList, selectedPeriod]);
  const grnList = useMemo(() => allGrnList.filter(r => matchesSelectedPeriod(r, selectedPeriod)), [allGrnList, selectedPeriod]);

  // Dynamic logged-in user name & initials resolution
  const [currentLoggedName, setCurrentLoggedName] = useState(() => {
    try {
      const stored = localStorage.getItem('controlroom_logged_user_name');
      if (stored && stored !== 'undefined' && stored !== 'null' && stored.trim() && !stored.includes('Executive Leadership')) {
        return stored.trim();
      }
      const storedUser = localStorage.getItem('controlroom_logged_user');
      if (storedUser && storedUser !== 'undefined' && storedUser !== 'null' && storedUser.trim() && !storedUser.includes('Executive Leadership')) {
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
        if (stored && stored !== 'undefined' && stored !== 'null' && stored.trim() && !stored.includes('Executive Leadership')) {
          setCurrentLoggedName(stored.trim());
          return;
        }
        const storedUser = localStorage.getItem('controlroom_logged_user');
        if (storedUser && storedUser !== 'undefined' && storedUser !== 'null' && storedUser.trim() && !storedUser.includes('Executive Leadership')) {
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
      const localInventory = getCached('controlroom_raw_material_store') || getCached('raw_material_store') || getCached('inventory_items_store') || [];
      const localGrns = getCached('controlroom_grn_store') || getCached('grn_store') || [];

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
      if (Array.isArray(localInventory) && localInventory.length > 0) setInventoryList(localInventory);
      if (Array.isArray(localGrns) && localGrns.length > 0) setGrnList(localGrns);
      const localEmps = getCached('controlroom_employees_list') || getCached('controlroom_employees_store') || [];
      if (Array.isArray(localEmps) && localEmps.length > 0) setEmployeesList(localEmps);

      // 2. Fetch primary live operational records
      const [pos, pis, boms, invs, workOrders, dispatches, challans, quotes, payments, customers, presets, liveLeads, liveInvItems, liveGrns, liveEmps] = await Promise.all([
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
        fetchCloudStore('presets_store', []).catch(() => []),
        fetchWithTimeout('/api/crm/leads', { timeout: 5000 })
          .then(r => r.json())
          .then(j => Array.isArray(j?.data) ? j.data : [])
          .catch(() => []),
        fetchCloudStore('raw_material_store', [])
          .then(res => (Array.isArray(res) && res.length > 0) ? res : fetchCloudStore('inventory_items_store', []))
          .catch(() => []),
        fetchCloudStore('grn_store', []).catch(() => []),
        fetchWithTimeout('/api/employees', { timeout: 5000 })
          .then(r => r.json())
          .then(j => Array.isArray(j?.data) ? j.data : (Array.isArray(j) ? j : []))
          .catch(() => fetchCloudStore('employees_store', []))
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
      if (Array.isArray(liveLeads) && liveLeads.length > 0) setLeadsList(liveLeads);
      if (Array.isArray(liveInvItems) && liveInvItems.length > 0) setInventoryList(liveInvItems);
      if (Array.isArray(liveGrns) && liveGrns.length > 0) setGrnList(liveGrns);
      if (Array.isArray(liveEmps) && liveEmps.length > 0) setEmployeesList(liveEmps);
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

  // Smart real INR currency formatter (shows Cr, Lakhs, or exact INR without rounding real Lakhs down to 0.00 Cr)
  const formatRealCurrency = (amt) => {
    const num = Number(amt) || 0;
    if (num >= 10000000) return `₹ ${(num / 10000000).toFixed(2)} Cr`;
    if (num >= 100000) return `₹ ${(num / 100000).toFixed(2)} L`;
    if (num > 0) return `₹ ${Math.round(num).toLocaleString('en-IN')}`;
    return '₹ 0';
  };

  // No fake period multipliers — all operational arrays are genuinely filtered by record date
  const periodMultiplier = 1.0;

  // Real team directory built dynamically from database employeesList (/api/employees)
  const teamDirectory = useMemo(() => {
    const avatarPalette = ['#0E7490', '#0284C7', '#2563EB', '#7C3AED', '#059669', '#D97706', '#4F46E5'];
    const mapRoleToDept = (roleStr, prefixStr) => {
      const r = String(roleStr || '').toLowerCase();
      const p = String(prefixStr || '').toUpperCase();
      if (r.includes('sales') || p === 'SE' || p === 'SH') return { dept: 'Sales', unit: 'Revenue', defaultTarget: 5000000 };
      if (r.includes('procure') || r.includes('purchase') || p === 'PR') return { dept: 'Procurement', unit: 'PO Spend', defaultTarget: 5000000 };
      if (r.includes('account') || r.includes('finance') || p === 'AH' || p === 'AC') return { dept: 'Accounts', unit: 'Collections', defaultTarget: 5000000 };
      if (r.includes('bill') || r.includes('invoice') || p === 'BI') return { dept: 'Billing', unit: 'Invoicing', defaultTarget: 5000000 };
      if (r.includes('dispatch') || p === 'DH') return { dept: 'Dispatch', unit: 'Shipments', defaultTarget: 50 };
      if (r.includes('prod') || r.includes('floor') || r.includes('plant') || p === 'PH' || p === 'FS') return { dept: 'Production', unit: 'MT Tonnage', defaultTarget: 100 };
      if (r.includes('design') || r.includes('bom') || p === 'DE') return { dept: 'Design', unit: 'Presets & BOMs', defaultTarget: 25 };
      if (r.includes('support') || p === 'TS') return { dept: 'Tech Support', unit: 'Support & Audits', defaultTarget: 30 };
      return { dept: 'Executive', unit: 'Revenue', defaultTarget: 10000000 };
    };

    const sourceEmps = Array.isArray(employeesList) && employeesList.length > 0
      ? employeesList
      : (() => {
          try {
            return JSON.parse(localStorage.getItem('controlroom_employees_list') || localStorage.getItem('controlroom_employees_store') || '[]');
          } catch { return []; }
        })();

    const seenCodes = new Set();
    const realTeam = [];

    sourceEmps.forEach((e, idx) => {
      if (!e) return;
      const code = String(e.employee_code || e.code || `EMP-${idx + 1}`).trim();
      const name = String(e.employee_name || e.name || e.role || code).trim();
      const role = String(e.role || e.dashboard_type || 'Executive').trim();
      if (seenCodes.has(code.toLowerCase())) return;
      seenCodes.add(code.toLowerCase());

      const { dept, unit, defaultTarget } = mapRoleToDept(role, e.prefix || code.split('-')[0]);
      const aliases = [
        name.toLowerCase(),
        code.toLowerCase(),
        role.toLowerCase(),
        String(e.email || '').split('@')[0].toLowerCase()
      ].filter(Boolean);

      realTeam.push({
        id: e.id || code,
        code,
        name,
        email: e.email || '',
        phone: e.phone || e.mobile || '',
        department: dept,
        role,
        designation: e.designation || role,
        avatarBg: avatarPalette[idx % avatarPalette.length],
        monthlyTarget: getRepMonthlyTarget(name, defaultTarget),
        unit,
        aliases
      });
    });

    return realTeam;
  }, [employeesList, ceoTargetStore]);

  // Compute live person-wise performance metrics from period-filtered real records
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
        matchedBoms = bomList.filter(b =>
          isMatch(b.salesPerson || b.sales_person || b.createdBy || b.createdById || b.salesPersonCode || b.sales_person_code, emp.aliases)
        );

        const piTotal = matchedPis.reduce((acc, p) => acc + parseAmt(p.grandTotal || p.amount || p.total), 0);
        const bomTotal = matchedBoms.reduce((acc, b) => acc + parseAmt(b.grandTotal || b.totalAmount || b.amount || b.value), 0);
        const qTotal = matchedQuotes.reduce((acc, q) => acc + parseAmt(q.amount || q.total || q.grandTotal), 0);

        achievedVal = Math.max(piTotal + qTotal, bomTotal);
        recordCount = matchedPis.length + matchedQuotes.length + matchedBoms.length;
      } else if (emp.department === 'Procurement') {
        matchedPos = poList.filter(po =>
          isMatch(po.buyer || po.purchaser || po.createdBy || po.vendor, emp.aliases)
        );
        achievedVal = matchedPos.reduce((acc, po) => acc + parseAmt(po.amount || po.total), 0);
        recordCount = matchedPos.length;
      } else if (emp.department === 'Accounts' || emp.department === 'Billing') {
        matchedInvs = invList.filter(inv =>
          isMatch(inv.createdBy || inv.salesPerson || inv.verifiedBy, emp.aliases) || invList.length > 0
        );
        achievedVal = matchedInvs.reduce((acc, inv) => acc + parseAmt(inv.total || inv.grandTotal || inv.amount || inv.invAmt || inv.poVal || inv.accountsVerification?.totalAmount), 0);
        recordCount = matchedInvs.length;
      } else if (emp.department === 'Production') {
        matchedBoms = bomList.filter(b =>
          isMatch(b.assignedTo || b.engineer || b.createdBy || b.productionLead, emp.aliases)
        );
        matchedWos = workOrdersList.filter(w =>
          isMatch(w.assignedTo || w.operator || w.supervisor, emp.aliases)
        );
        achievedVal = matchedBoms.reduce((acc, b) => acc + (parseFloat(b.totalWeight || b.weight || 0) || 0), 0);
        recordCount = matchedBoms.length + matchedWos.length;
      } else if (emp.department === 'Dispatch') {
        matchedDispatches = dispatchesList.filter(d =>
          isMatch(d.dispatchedBy || d.transporter, emp.aliases)
        );
        matchedChallans = challansList.filter(c =>
          isMatch(c.dispatchedBy || c.driverName, emp.aliases)
        );
        achievedVal = matchedDispatches.length + matchedChallans.length;
        recordCount = matchedDispatches.length + matchedChallans.length;
      } else if (emp.department === 'Design') {
        matchedBoms = bomList.filter(b =>
          isMatch(b.engineer || b.designedBy, emp.aliases)
        );
        achievedVal = matchedBoms.length;
        recordCount = matchedBoms.length;
      }

      const scaledTarget = emp.monthlyTarget;
      const targetPct = scaledTarget > 0 ? Math.min(135, Math.round((achievedVal / scaledTarget) * 100)) : 0;

      let rating = 'No Deals Yet';
      let ratingColor = '#64748B';
      let ratingBg = '#F1F5F9';
      if (achievedVal > 0 || recordCount > 0) {
        if (targetPct >= 100) {
          rating = 'Top Performer';
          ratingColor = '#16A34A';
          ratingBg = '#DCFCE7';
        } else if (targetPct >= 75) {
          rating = 'High Producer';
          ratingColor = '#2563EB';
          ratingBg = '#EFF6FF';
        } else {
          rating = 'Active';
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
  }, [teamDirectory, piList, quotesList, poList, invList, bomList, workOrdersList, dispatchesList, challansList]);

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

  // Overall Business Totals — 100% Real Period-Filtered Calculations
  const pendingMdPOs = useMemo(() => {
    return poList.filter(po => {
      const stage = String(po.stage || po.status || po.statusType || '').toLowerCase();
      return stage.includes('draft') || stage.includes('pending') || stage.includes('approval');
    });
  }, [poList]);

  const totalPoSpendNum = useMemo(() => {
    return poList.reduce((acc, po) => acc + parseAmt(po.amount || po.total), 0);
  }, [poList]);

  const totalPoSpendCr = (totalPoSpendNum / 10000000).toFixed(2);
  const totalPoSpendFormatted = formatRealCurrency(totalPoSpendNum);

  const totalPiPipelineNum = useMemo(() => {
    return piList.reduce((acc, pi) => acc + parseAmt(pi.grandTotal || pi.amount || pi.total), 0);
  }, [piList]);

  const totalPiPipelineCr = (totalPiPipelineNum / 10000000).toFixed(2);
  const totalPiPipelineFormatted = formatRealCurrency(totalPiPipelineNum);

  const totalBomOrderValueNum = useMemo(() => {
    return bomList
      .filter(b => b && !b.cancelled && !String(b.status || '').toLowerCase().includes('cancel'))
      .reduce((acc, b) => acc + parseAmt(b.grandTotal || b.totalAmount || b.amount || b.value || 0), 0);
  }, [bomList]);
  const totalBomOrderValueFormatted = formatRealCurrency(totalBomOrderValueNum);

  const totalInvoicedNum = useMemo(() => {
    return invList.reduce((acc, inv) => {
      const amt = parseAmt(inv.total || inv.grandTotal || inv.amount || inv.invAmt || inv.poVal || inv.accountsVerification?.totalAmount);
      return acc + amt;
    }, 0);
  }, [invList]);

  const totalRevenueCr = (totalInvoicedNum / 10000000).toFixed(2);
  const totalRevenueFormatted = formatRealCurrency(totalInvoicedNum);

  const totalCollectedNum = useMemo(() => {
    const directPayments = paymentsList.reduce((acc, p) => acc + parseAmt(p.amount || p.paidAmount), 0);
    if (directPayments > 0) return directPayments;
    // Also sum verified paid invoices from invoice_store
    const verifiedInvsTotal = invList.reduce((acc, inv) => {
      const isPaidOrVerified = Boolean(
        inv.accountsVerification?.verified ||
        String(inv.pay || '').toLowerCase().includes('completed') ||
        String(inv.status || '').toLowerCase().includes('paid') ||
        String(inv.status || '').toLowerCase().includes('confirmed')
      );
      if (!isPaidOrVerified) return acc;
      return acc + parseAmt(inv.total || inv.grandTotal || inv.amount || inv.invAmt || inv.poVal || inv.accountsVerification?.totalAmount);
    }, 0);
    return verifiedInvsTotal;
  }, [paymentsList, invList]);

  const totalCollectedCr = (totalCollectedNum / 10000000).toFixed(2);
  const totalCollectedFormatted = formatRealCurrency(totalCollectedNum);
  const outstandingOverdueNum = Math.max(0, totalInvoicedNum - totalCollectedNum);
  const outstandingOverdueCr = (outstandingOverdueNum / 10000000).toFixed(2);
  const outstandingOverdueFormatted = formatRealCurrency(outstandingOverdueNum);

  const completedDispatchesCount = useMemo(() => {
    const completedBoms = bomList.filter(b => {
      if (!b || b.cancelled) return false;
      const st = String(b.status || '').toLowerCase();
      return Boolean(b.fullyCompleted || st.includes('completed') || st.includes('dispatched'));
    }).length;
    return Math.max(completedBoms, dispatchesList.length + challansList.length);
  }, [bomList, dispatchesList, challansList]);

  const pendingDispatchQueueCount = useMemo(() => {
    return bomList.filter(b => {
      if (!b || b.cancelled) return false;
      const st = String(b.status || '').toLowerCase();
      const isDone = Boolean(b.fullyCompleted || st.includes('completed') || st.includes('dispatched'));
      const isDraft = st === 'draft';
      return !isDone && !isDraft;
    }).length;
  }, [bomList]);

  const totalProductionTonnage = useMemo(() => {
    return bomList.reduce((acc, b) => acc + (parseFloat(b.totalWeight || b.weight || 0) || 0), 0);
  }, [bomList]);

  // Person-by-Person BOM Generation Breakdown for the CEO Dashboard
  const salesPersonBomBreakdown = useMemo(() => {
    const salesTeam = teamDirectory.filter(emp => emp.department === 'Sales');
    const repMap = new Map();

    salesTeam.forEach(emp => {
      repMap.set(emp.name.toLowerCase().trim(), {
        name: emp.name,
        code: emp.code,
        role: emp.role || 'Sales Executive',
        designation: emp.designation,
        avatarBg: emp.avatarBg || '#0E7490',
        aliases: emp.aliases || [emp.name.toLowerCase()],
        boms: []
      });
    });

    const isMatch = (itemVal, aliases) => {
      if (!itemVal) return false;
      const s = String(itemVal).toLowerCase().trim();
      return aliases.some(a => s === a || s.includes(a) || a.includes(s));
    };

    bomList.forEach(bom => {
      if (!bom) return;
      const spName = (bom.salesPerson || bom.sales_person || bom.createdBy || '').replace(/\s*\([^)]*\)/g, '').trim();
      const spCode = (bom.salesPersonCode || bom.sales_person_code || bom.createdById || '').trim();

      let matchedRep = null;
      for (const rep of repMap.values()) {
        if (isMatch(spName, rep.aliases) || isMatch(spCode, rep.aliases)) {
          matchedRep = rep;
          break;
        }
      }

      if (matchedRep) {
        matchedRep.boms.push(bom);
      } else if (spName && !['admin', 'system', 'technical administrator', 'super admin', 'plant head'].includes(spName.toLowerCase())) {
        const cleanKey = spName.toLowerCase();
        if (!repMap.has(cleanKey)) {
          repMap.set(cleanKey, {
            name: spName,
            code: spCode || 'SE-REP',
            role: 'Sales Executive',
            designation: 'Sales Representative',
            avatarBg: '#0891B2',
            aliases: [cleanKey, spCode.toLowerCase()].filter(Boolean),
            boms: []
          });
        }
        repMap.get(cleanKey).boms.push(bom);
      }
    });

    return Array.from(repMap.values()).map(rep => {
      const boms = rep.boms || [];
      const totalBoms = boms.length;
      const totalAmount = boms.reduce((acc, b) => acc + parseAmt(b.totalAmount || b.amount || b.grandTotal || b.value || b.val || 0), 0);
      const totalTonnage = boms.reduce((acc, b) => acc + (parseFloat(b.totalWeight || b.weight || 0) || 0), 0);

      const inProductionCount = boms.filter(b => {
        const s = String(b.status || '').toLowerCase();
        return s.includes('production') || s.includes('extrusion') || s.includes('approved') || s.includes('confirmed') || s.includes('in-production');
      }).length;

      const dispatchedOrDoneCount = boms.filter(b => {
        const s = String(b.status || '').toLowerCase();
        return s.includes('dispatch') || s.includes('invoiced') || s.includes('completed') || s.includes('delivered') || b.invoiceConfirmed;
      }).length;

      const pendingCount = boms.filter(b => {
        const s = String(b.status || '').toLowerCase();
        return s.includes('pending') || s.includes('draft') || s.includes('waiting') || s.includes('ready for accounts');
      }).length;

      const latestBom = boms[0] || null;

      return {
        ...rep,
        totalBoms,
        totalAmount,
        totalTonnage,
        inProductionCount,
        dispatchedOrDoneCount,
        pendingCount,
        latestBom
      };
    }).sort((a, b) => b.totalBoms - a.totalBoms);
  }, [teamDirectory, bomList]);

  const totalBomsFromReps = useMemo(() => {
    return salesPersonBomBreakdown.reduce((sum, r) => sum + r.totalBoms, 0);
  }, [salesPersonBomBreakdown]);

  const totalBomValueFromReps = useMemo(() => {
    return salesPersonBomBreakdown.reduce((sum, r) => sum + r.totalAmount, 0);
  }, [salesPersonBomBreakdown]);

  const totalBomTonnageFromReps = useMemo(() => {
    return salesPersonBomBreakdown.reduce((sum, r) => sum + r.totalTonnage, 0);
  }, [salesPersonBomBreakdown]);

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

  // Real Monthly Run-Rate Trend Data aggregated from live database records (filtered by selectedPeriod)
  const monthlyRunRate = useMemo(() => {
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const currentMonthIdx = new Date().getMonth();
    const relevantMonths = months.slice(0, Math.max(currentMonthIdx + 1, 10));

    return relevantMonths.map((m, mIdx) => {
      const invRevForMonth = invList.reduce((acc, inv) => {
        const d = parseRecordDate(inv);
        if (d && d.getMonth() === mIdx) {
          return acc + parseAmt(inv.total || inv.grandTotal || inv.amount || inv.invAmt || inv.poVal || inv.accountsVerification?.totalAmount);
        }
        return acc;
      }, 0);

      const bomRevForMonth = bomList.reduce((acc, b) => {
        if (!b || b.cancelled) return acc;
        const d = parseRecordDate(b);
        if (d && d.getMonth() === mIdx) {
          return acc + parseAmt(b.grandTotal || b.totalAmount || b.amount || b.value || 0);
        }
        return acc;
      }, 0);

      const piRevForMonth = piList.reduce((acc, pi) => {
        const d = parseRecordDate(pi);
        if (d && d.getMonth() === mIdx) {
          return acc + parseAmt(pi.grandTotal || pi.amount || pi.total);
        }
        return acc;
      }, 0);

      const revForMonth = Math.max(invRevForMonth, bomRevForMonth, piRevForMonth);

      const spendForMonth = poList.reduce((acc, po) => {
        const d = parseRecordDate(po);
        if (d && d.getMonth() === mIdx) {
          return acc + parseAmt(po.amount || po.total);
        }
        return acc;
      }, 0);

      const revCr = parseFloat((revForMonth / 10000000).toFixed(4));
      const spendCr = parseFloat((spendForMonth / 10000000).toFixed(4));
      const margin = revForMonth > 0 ? parseFloat((((revForMonth - spendForMonth) / revForMonth) * 100).toFixed(1)) : 0;

      return {
        month: m,
        rev: revCr,
        spend: spendCr,
        revRaw: revForMonth,
        spendRaw: spendForMonth,
        revLabel: formatRealCurrency(revForMonth),
        spendLabel: formatRealCurrency(spendForMonth),
        margin: margin
      };
    });
  }, [invList, bomList, piList, poList]);

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

  // Real 6-Stage Order-to-Cash Lifecycle (PI -> BOM -> Dispatch Packing -> Accounts Verification -> Tax Invoice -> Final Dispatch)
  const funnelStages = useMemo(() => {
    const fmtCompact = (val) => {
      const n = Number(val) || 0;
      if (n >= 10000000) return `₹ ${(n / 10000000).toFixed(2)} Cr`;
      if (n >= 100000) return `₹ ${(n / 100000).toFixed(2)} L`;
      if (n > 0) return `₹ ${Math.round(n).toLocaleString('en-IN')}`;
      return '₹ 0';
    };

    const activeBoms = bomList.filter(b => b && !b.cancelled && !String(b.status || '').toLowerCase().includes('cancel'));
    const totalBomVal = activeBoms.reduce((acc, b) => acc + parseAmt(b.grandTotal || b.totalAmount || b.amount || b.value || 0), 0) * periodMultiplier;

    const confirmedPis = piList.filter(p => {
      const st = String(p.status || '').toLowerCase();
      return st.includes('confirm') || st.includes('bom') || st.includes('convert') || p.bomConverted;
    });

    const packedBoms = activeBoms.filter(b => {
      const st = String(b.status || '').toLowerCase();
      return b.packingStatus === 'PACKING_VERIFIED' || st.includes('packed') || b.isAccountsDone || b.accountsVerification?.verified || b.invoiceConfirmed || st.includes('loading') || st.includes('dispatched') || st.includes('completed') || b.fullyCompleted;
    });
    const pendingPackingBoms = Math.max(0, activeBoms.length - packedBoms.length);
    const packedVal = packedBoms.reduce((acc, b) => acc + parseAmt(b.grandTotal || b.totalAmount || b.amount || b.value || 0), 0) * periodMultiplier;

    const accountsVerifiedBoms = activeBoms.filter(b => {
      const st = String(b.status || '').toLowerCase();
      return Boolean(b.isAccountsDone || b.accountsVerification?.verified || b.invoiceConfirmed || st.includes('invoice') || st.includes('loading') || st.includes('dispatched') || st.includes('completed') || b.fullyCompleted);
    });
    const pendingAccountsBoms = packedBoms.filter(b => !b.isAccountsDone && !b.accountsVerification?.verified && !b.invoiceConfirmed).length;
    const accountsVerifiedVal = accountsVerifiedBoms.reduce((acc, b) => acc + parseAmt(b.grandTotal || b.totalAmount || b.amount || b.value || 0), 0) * periodMultiplier;

    const invoicedBoms = activeBoms.filter(b => Boolean(b.invoiceConfirmed || String(b.status || '').toLowerCase().includes('invoice') || b.fullyCompleted || String(b.status || '').toLowerCase().includes('dispatched') || String(b.status || '').toLowerCase().includes('completed')));
    const totalInvoicedCount = Math.max(invList.length, invoicedBoms.length);
    const invoicedVal = (totalInvoicedNum > 0 ? totalInvoicedNum : invoicedBoms.reduce((acc, b) => acc + parseAmt(b.grandTotal || b.totalAmount || b.amount || b.value || 0), 0)) * periodMultiplier;

    const completedDispatchBoms = activeBoms.filter(b => {
      const st = String(b.status || '').toLowerCase();
      return Boolean(b.fullyCompleted || st.includes('completed') || st.includes('dispatched'));
    });
    const awaitingLoadBoms = activeBoms.filter(b => {
      const st = String(b.status || '').toLowerCase();
      return (b.invoiceConfirmed || st.includes('loading')) && !b.fullyCompleted && !st.includes('completed') && !st.includes('dispatched');
    });
    const totalDispatchedCount = Math.max(completedDispatchBoms.length, dispatchesList.length);
    const dispatchedVal = completedDispatchBoms.reduce((acc, b) => acc + parseAmt(b.grandTotal || b.totalAmount || b.amount || b.value || 0), 0) * periodMultiplier;

    const baseTotal = Math.max(1, piList.length, activeBoms.length);

    return [
      {
        step: 'STEP 01',
        stage: 'Proforma Invoice',
        subtitle: 'Sales Commercial PI',
        primaryMetric: `${piList.length} PIs`,
        value: fmtCompact(totalPiPipelineNum * periodMultiplier),
        valueLabel: 'Pipeline Value',
        statusBadge: `${confirmedPis.length} Confirmed`,
        progressPct: piList.length > 0 ? Math.min(100, Math.max(18, Math.round((confirmedPis.length / Math.max(1, piList.length)) * 100))) : 0,
        icon: Receipt,
        color: '#0E7490',
        bg: '#ECFEFF',
        border: '#A5F3FC',
        targetTab: 'Proforma Invoice',
        action: 'Open PIs'
      },
      {
        step: 'STEP 02',
        stage: 'BOM & Sales Order',
        subtitle: 'Engineering & Proofs',
        primaryMetric: `${activeBoms.length} BOMs`,
        value: fmtCompact(totalBomVal),
        valueLabel: 'Order Book',
        statusBadge: `${packedBoms.length} Sent to Dispatch`,
        progressPct: activeBoms.length > 0 ? Math.min(100, Math.max(20, Math.round((activeBoms.length / baseTotal) * 100))) : 0,
        icon: Factory,
        color: '#0284C7',
        bg: '#F0F9FF',
        border: '#BAE6FD',
        targetTab: 'BOM Orders',
        action: 'Open BOMs'
      },
      {
        step: 'STEP 03',
        stage: 'Dispatch Packing',
        subtitle: 'Checklist & Media Proof',
        primaryMetric: `${packedBoms.length} Packed`,
        value: fmtCompact(packedVal),
        valueLabel: 'Packed Value',
        statusBadge: `${pendingPackingBoms} Pending Packing`,
        progressPct: activeBoms.length > 0 ? Math.min(100, Math.round((packedBoms.length / activeBoms.length) * 100)) : 0,
        icon: Package,
        color: '#D97706',
        bg: '#FFFBEB',
        border: '#FDE68A',
        targetTab: 'Dispatch Orders',
        action: 'Packing Queue'
      },
      {
        step: 'STEP 04',
        stage: 'Accounts Verify',
        subtitle: 'Payment & Hard Copy',
        primaryMetric: `${accountsVerifiedBoms.length} Verified`,
        value: fmtCompact(accountsVerifiedVal),
        valueLabel: 'Cleared Value',
        statusBadge: `${pendingAccountsBoms} In Queue`,
        progressPct: activeBoms.length > 0 ? Math.min(100, Math.round((accountsVerifiedBoms.length / activeBoms.length) * 100)) : 0,
        icon: ShieldCheck,
        color: '#7C3AED',
        bg: '#F5F3FF',
        border: '#DDD6FE',
        targetTab: 'Accounts Verification',
        action: 'Verify Queue'
      },
      {
        step: 'STEP 05',
        stage: 'Billing & Invoice',
        subtitle: '3-Way Match & Stock Lock',
        primaryMetric: `${totalInvoicedCount} Billed`,
        value: fmtCompact(invoicedVal),
        valueLabel: 'GST Invoiced',
        statusBadge: `${Math.max(0, accountsVerifiedBoms.length - invoicedBoms.length)} Awaiting Billing`,
        progressPct: activeBoms.length > 0 ? Math.min(100, Math.round((totalInvoicedCount / activeBoms.length) * 100)) : 0,
        icon: FileCheck,
        color: '#2563EB',
        bg: '#EFF6FF',
        border: '#BFDBFE',
        targetTab: 'Invoice Management',
        action: 'Tax Invoices'
      },
      {
        step: 'STEP 06',
        stage: 'Final Dispatch',
        subtitle: 'Vehicle Loading & LR Copy',
        primaryMetric: `${totalDispatchedCount} Dispatched`,
        value: fmtCompact(dispatchedVal),
        valueLabel: 'Delivered Value',
        statusBadge: `${awaitingLoadBoms.length} Ready to Load`,
        progressPct: activeBoms.length > 0 ? Math.min(100, Math.round((totalDispatchedCount / activeBoms.length) * 100)) : 0,
        icon: Truck,
        color: '#16A34A',
        bg: '#F0FDF4',
        border: '#BBF7D0',
        targetTab: 'Dispatch Orders',
        action: 'Dispatch Log'
      }
    ];
  }, [piList, bomList, invList, dispatchesList, periodMultiplier, totalPiPipelineNum, totalInvoicedNum]);

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

      {/* ======================================================== */}
      {/* CATEGORY 1: EXECUTIVE DASHBOARD (6 KPIs ALONE + ESSENTIALS) */}
      {/* ======================================================== */}
      {(activeSubTab === 'overview' || activeSubTab === 'performance' || activeSubTab === 'action-center' || activeSubTab === 'alerts') && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          
          {/* 6 CORE EXECUTIVE KPI CARDS (BUSINZ DESIGN SYSTEM) */}
          <CeoKpiGrid kpis={[
            {
              title: 'PROFORMA PIPELINE (PI)',
              value: `${piList.length} Active PIs`,
              trend: piList.length > 0 ? `${piList.length} Deals` : '0 Deals',
              trendUp: piList.length > 0,
              icon: Receipt,
              iconColor: '#0E7490',
              iconBg: '#ECFEFF',
              bottomPrefix: 'Pipeline value ',
              bottomHighlight: totalPiPipelineFormatted,
              onClick: () => setActiveSubTab('sales')
            },
            {
              title: 'BOM & PRODUCTION',
              value: `${bomList.length} BOM Orders`,
              trend: `${bomList.filter(b => b && !b.cancelled && String(b.status || '').toLowerCase() !== 'draft').length} Confirmed`,
              trendUp: bomList.length > 0,
              icon: Factory,
              iconColor: '#0284C7',
              iconBg: '#F0F9FF',
              bottomPrefix: 'Order book value ',
              bottomHighlight: totalBomOrderValueFormatted,
              onClick: () => setActiveSubTab('production')
            },
            {
              title: 'PURCHASE ORDERS (PO)',
              value: `${poList.length} POs Done`,
              trend: `${pendingMdPOs.length > 0 ? `${pendingMdPOs.length} Pending MD` : (poList.length > 0 ? 'All Approved' : '0 POs')}`,
              trendUp: pendingMdPOs.length === 0,
              icon: ShoppingCart,
              iconColor: '#2563EB',
              iconBg: '#EFF6FF',
              bottomPrefix: 'Spend authorized ',
              bottomHighlight: totalPoSpendFormatted,
              highlightCard: pendingMdPOs.length > 0,
              onClick: () => setActiveSubTab('procurement')
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
              bottomHighlight: `${pendingDispatchQueueCount} Orders`,
              onClick: () => setActiveSubTab('dispatch')
            },
            {
              title: 'BILLING & TAX INVOICES',
              value: `${invList.length} Invoices Billed`,
              trend: invList.length > 0 ? '100% Tax Sync' : '0 Invoices',
              trendUp: invList.length > 0,
              icon: FileCheck,
              iconColor: '#9333EA',
              iconBg: '#FAF5FF',
              bottomPrefix: 'Total GST billed ',
              bottomHighlight: totalRevenueFormatted,
              onClick: () => setActiveSubTab('accounts')
            },
            {
              title: 'ACCOUNTS & COLLECTIONS',
              value: `${totalCollectedFormatted} Done`,
              trend: totalInvoicedNum > 0 ? `${((totalCollectedNum / totalInvoicedNum) * 100).toFixed(1)}% Rate` : '0% Rate',
              trendUp: totalCollectedNum > 0,
              icon: Wallet,
              iconColor: '#16A34A',
              iconBg: '#F0FDF4',
              bottomPrefix: 'Outstanding pending ',
              bottomHighlight: outstandingOverdueFormatted,
              onClick: () => setActiveSubTab('accounts')
            }
          ]} />

          {/* ROW A: APPROVAL QUEUE + REVENUE VS SPEND + CRITICAL ALERTS */}
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
                    onClick={() => onNavigateTab && onNavigateTab('Purchase Orders', null, 'WAITING FOR APPROVAL')}
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
                    Open PO Approval <ArrowRight size={12} />
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
                        onClick={() => onNavigateTab && onNavigateTab('Purchase Orders', po.poNo || po.poNumber || po.purchaseorder_number || null, 'WAITING FOR APPROVAL')}
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

              <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', height: '140px', gap: '6px', paddingTop: '10px', paddingBottom: '18px', position: 'relative' }}>
                {(() => {
                  const maxBarVal = Math.max(1, ...monthlyRunRate.map(d => Math.max(d.revRaw || 0, d.spendRaw || 0)));
                  return monthlyRunRate.map((d, idx) => {
                    const isHovered = hoveredBarIdx === idx;
                    const revHeight = maxBarVal > 0 ? ((d.revRaw || 0) / maxBarVal) * 100 : 0;
                    const spendHeight = maxBarVal > 0 ? ((d.spendRaw || 0) / maxBarVal) * 100 : 0;

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
                            <div>Rev: {d.revLabel} | Spend: {d.spendLabel}</div>
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

            {/* CARD 3: EXECUTIVE RISK ALERTS & WATCHLIST */}
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
                  Critical Alerts & Watchlist
                </span>
                <span style={{ fontSize: '10px', color: realRiskAlerts.length > 0 ? '#DC2626' : '#16A34A', fontWeight: '700', backgroundColor: realRiskAlerts.length > 0 ? '#FEF2F2' : '#DCFCE7', padding: '2px 7px', borderRadius: '8px' }}>
                  {realRiskAlerts.length > 0 ? 'ATTENTION REQUIRED' : 'ALL CLEAR'}
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
                <strong style={{ color: '#16A34A' }}>99.9% Uptime • BUSINZ Live Synced</strong>
              </div>
            </div>

          </div>

          {/* ROW B: ORDER-TO-CASH LIFECYCLE SUMMARY (6-STAGE CONNECTED PIPELINE) */}
          <div style={{
            backgroundColor: '#FFFFFF',
            borderRadius: '16px',
            border: '1px solid #E2E8F0',
            padding: '18px 20px',
            display: 'flex',
            flexDirection: 'column',
            gap: '16px',
            boxShadow: '0 4px 20px rgba(15, 23, 42, 0.04)'
          }}>
            <style>{`
              .businz-otc-grid {
                display: grid;
                grid-template-columns: repeat(6, minmax(0, 1fr));
                gap: 12px;
                width: 100%;
                box-sizing: border-box;
              }
              @media (max-width: 1360px) {
                .businz-otc-grid {
                  grid-template-columns: repeat(3, minmax(0, 1fr));
                }
              }
              @media (max-width: 768px) {
                .businz-otc-grid {
                  grid-template-columns: repeat(2, minmax(0, 1fr));
                }
              }
              .businz-otc-card {
                transition: transform 0.18s ease, box-shadow 0.18s ease, border-color 0.18s ease;
              }
              .businz-otc-card:hover {
                transform: translateY(-2px);
                box-shadow: 0 8px 20px -4px rgba(15, 23, 42, 0.08);
              }
            `}</style>

            {/* Header Row */}
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: '12px',
              borderBottom: '1px solid #F1F5F9',
              paddingBottom: '12px'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{
                  width: '38px',
                  height: '38px',
                  borderRadius: '10px',
                  background: 'linear-gradient(135deg, #0E7490 0%, #0284C7 100%)',
                  color: '#FFFFFF',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  boxShadow: '0 4px 10px rgba(14, 116, 144, 0.25)',
                  flexShrink: 0
                }}>
                  <Activity size={18} />
                </div>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                    <span style={{ fontSize: '14px', fontWeight: '800', color: '#0F172A', letterSpacing: '-0.01em' }}>
                      Order-to-Cash Lifecycle Summary
                    </span>
                    <span style={{
                      fontSize: '10px',
                      fontWeight: '800',
                      color: '#0E7490',
                      backgroundColor: '#ECFEFF',
                      border: '1px solid #A5F3FC',
                      padding: '2px 8px',
                      borderRadius: '999px'
                    }}>
                      6-STAGE WORKFLOW
                    </span>
                  </div>
                  <div style={{ fontSize: '11.5px', color: '#64748B', marginTop: '2px', fontWeight: '500' }}>
                    End-to-end live flow: Proforma Invoice (PI) → BOM Order → Dispatch Packing → Accounts Verification → Tax Invoice → Final Dispatch
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  backgroundColor: '#F8FAFC',
                  border: '1px solid #E2E8F0',
                  padding: '5px 10px',
                  borderRadius: '8px',
                  fontSize: '11px',
                  fontWeight: '700',
                  color: '#334155'
                }}>
                  <span style={{ color: '#64748B', fontWeight: '600' }}>Active Pipeline:</span>
                  <span style={{ color: '#0E7490', fontWeight: '800' }}>{piList.length} PIs • {bomList.length} BOMs</span>
                </div>
                <span style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '5px',
                  fontSize: '10.5px',
                  color: '#15803D',
                  fontWeight: '800',
                  backgroundColor: '#DCFCE7',
                  border: '1px solid #BBF7D0',
                  padding: '5px 10px',
                  borderRadius: '8px'
                }}>
                  <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#16A34A', display: 'inline-block' }} />
                  OPERATIONS LIVE
                </span>
              </div>
            </div>

            {/* 6-Stage Pipeline Stepper Cards */}
            <div className="businz-otc-grid">
              {funnelStages.map((stage, idx) => {
                const IconComponent = stage.icon;
                return (
                  <div
                    key={idx}
                    className="businz-otc-card"
                    onClick={() => onNavigateTab && stage.targetTab && onNavigateTab(stage.targetTab)}
                    style={{
                      backgroundColor: '#FFFFFF',
                      borderRadius: '14px',
                      border: '1px solid #E2E8F0',
                      borderTop: `3.5px solid ${stage.color}`,
                      padding: '14px',
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'space-between',
                      gap: '12px',
                      cursor: onNavigateTab ? 'pointer' : 'default',
                      position: 'relative',
                      minWidth: 0,
                      boxSizing: 'border-box'
                    }}
                  >
                    {/* Top Row: Step Number + Icon */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '6px' }}>
                      <span style={{
                        fontSize: '10px',
                        fontWeight: '800',
                        color: stage.color,
                        backgroundColor: stage.bg,
                        border: `1px solid ${stage.border}`,
                        padding: '2px 7px',
                        borderRadius: '6px',
                        letterSpacing: '0.04em'
                      }}>
                        {stage.step}
                      </span>
                      <div style={{
                        width: '32px',
                        height: '32px',
                        borderRadius: '9px',
                        backgroundColor: stage.bg,
                        color: stage.color,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0
                      }}>
                        <IconComponent size={16} />
                      </div>
                    </div>

                    {/* Middle Row: Stage Name + Primary Count + Value Box */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      <div>
                        <div style={{ fontSize: '12.5px', fontWeight: '800', color: '#0F172A', lineHeight: '1.25' }}>
                          {stage.stage}
                        </div>
                        <div style={{ fontSize: '10.5px', color: '#64748B', fontWeight: '500', marginTop: '1px' }}>
                          {stage.subtitle}
                        </div>
                      </div>

                      <div style={{
                        fontSize: '20px',
                        fontWeight: '900',
                        color: '#0F172A',
                        letterSpacing: '-0.02em',
                        marginTop: '2px'
                      }}>
                        {stage.primaryMetric}
                      </div>

                      <div style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        backgroundColor: '#F8FAFC',
                        border: '1px solid #F1F5F9',
                        borderRadius: '8px',
                        padding: '6px 8px'
                      }}>
                        <span style={{ fontSize: '10px', fontWeight: '600', color: '#64748B' }}>
                          {stage.valueLabel}
                        </span>
                        <span style={{ fontSize: '11.5px', fontWeight: '800', color: stage.color }}>
                          {stage.value}
                        </span>
                      </div>
                    </div>

                    {/* Progress Bar + Bottom Status & Link */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      <div style={{
                        width: '100%',
                        height: '5px',
                        backgroundColor: '#F1F5F9',
                        borderRadius: '999px',
                        overflow: 'hidden'
                      }}>
                        <div style={{
                          width: `${stage.progressPct}%`,
                          height: '100%',
                          backgroundColor: stage.color,
                          borderRadius: '999px',
                          transition: 'width 0.3s ease'
                        }} />
                      </div>

                      <div style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        gap: '4px',
                        paddingTop: '2px'
                      }}>
                        <span style={{
                          fontSize: '10px',
                          fontWeight: '700',
                          color: '#475569',
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis'
                        }}>
                          {stage.statusBadge}
                        </span>
                        <span style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '2px',
                          fontSize: '10px',
                          fontWeight: '800',
                          color: stage.color,
                          flexShrink: 0
                        }}>
                          {stage.action} <ChevronRight size={11} />
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

        </div>
      )}

      {/* ======================================================== */}
      {/* CATEGORY 2: CRM & LEADS DASHBOARD                        */}
      {/* ======================================================== */}
      {activeSubTab === 'crm-dashboard' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          {/* Category 2 Top KPIs (BUSINZ DESIGN SYSTEM) */}
          <CeoKpiGrid kpis={[
            {
              title: 'TOTAL CRM LEADS',
              value: `${leadsList.length} Leads`,
              trend: leadsList.length > 0 ? `${leadsList.length} In-Flow` : '0 Leads',
              trendUp: leadsList.length > 0,
              icon: Users,
              iconColor: '#0E7490',
              iconBg: '#ECFEFF',
              bottomPrefix: 'Source mix ',
              bottomHighlight: 'IndiaMART & Meta',
              onClick: () => onNavigateTab && onNavigateTab('Leads')
            },
            {
              title: 'REGISTERED CUSTOMERS',
              value: `${customersList.length} Accounts`,
              trend: `${customersList.length} Accounts`,
              trendUp: true,
              icon: Building2,
              iconColor: '#2563EB',
              iconBg: '#EFF6FF',
              bottomPrefix: 'Client base ',
              bottomHighlight: 'Verified B2B & EPC Clients',
              onClick: () => onNavigateTab && onNavigateTab('Customers')
            },
            {
              title: 'ACTIVE QUOTATIONS',
              value: `${quotesList.length} Quotes`,
              trend: quotesList.length > 0 ? `${quotesList.length} Active` : '0 Quotes',
              trendUp: quotesList.length > 0,
              icon: FileText,
              iconColor: '#16A34A',
              iconBg: '#F0FDF4',
              bottomPrefix: 'Commercial stage ',
              bottomHighlight: 'In Follow-up',
              onClick: () => setActiveSubTab('sales')
            },
            {
              title: 'SALES TEAM ACTIVE',
              value: `${teamDirectory.filter(t => t.department === 'Sales').length} Executives`,
              trend: '100% Active',
              trendUp: true,
              icon: UserCheck,
              iconColor: '#7C3AED',
              iconBg: '#FAF5FF',
              bottomPrefix: 'Coverage ',
              bottomHighlight: 'Assigned to Lead Pipeline',
              onClick: () => setActiveSubTab('personnel')
            }
          ]} />

          {/* Quick Submenu Navigation Bar for CRM & Leads */}
          <div style={{ backgroundColor: '#FFFFFF', borderRadius: '16px', border: '1px solid #EAEFEF', padding: '14px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px' }}>
            <div>
              <div style={{ fontSize: '13px', fontWeight: '800', color: '#0F172A', textTransform: 'uppercase' }}>2. CRM & Leads Command Center</div>
              <div style={{ fontSize: '11px', color: '#64748B', marginTop: '2px' }}>Direct access to Lead Directory, Assignment, Follow-up Monitoring, Customers, and Sales Team Performance</div>
            </div>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              <button onClick={() => onNavigateTab && onNavigateTab('Leads')} style={{ border: 'none', backgroundColor: '#0E7490', color: '#FFFFFF', padding: '6px 12px', borderRadius: '8px', fontSize: '11px', fontWeight: '700', cursor: 'pointer' }}>All Leads</button>
              <button onClick={() => onNavigateTab && onNavigateTab('Follow-ups')} style={{ border: '1px solid #CBD5E1', backgroundColor: '#FFFFFF', color: '#334155', padding: '6px 12px', borderRadius: '8px', fontSize: '11px', fontWeight: '700', cursor: 'pointer' }}>Follow-up Monitoring</button>
              <button onClick={() => onNavigateTab && onNavigateTab('Customers')} style={{ border: '1px solid #CBD5E1', backgroundColor: '#FFFFFF', color: '#334155', padding: '6px 12px', borderRadius: '8px', fontSize: '11px', fontWeight: '700', cursor: 'pointer' }}>Customer Management</button>
              <button onClick={() => setActiveSubTab('personnel')} style={{ border: '1px solid #0E7490', backgroundColor: '#ECFEFF', color: '#0E7490', padding: '6px 12px', borderRadius: '8px', fontSize: '11px', fontWeight: '800', cursor: 'pointer' }}>Sales Team Performance</button>
            </div>
          </div>

          {/* Recent Leads & Top Customers */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 340px), 1fr))', gap: '12px' }}>
            <div style={{ backgroundColor: '#FFFFFF', borderRadius: '16px', border: '1px solid #EAEFEF', padding: '16px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '12px', fontWeight: '800', color: '#0F172A', textTransform: 'uppercase' }}>Recent CRM Leads</span>
                <button onClick={() => onNavigateTab && onNavigateTab('Leads')} style={{ border: 'none', background: 'none', color: '#0E7490', fontSize: '11px', fontWeight: '700', cursor: 'pointer' }}>Open Leads →</button>
              </div>
              <div style={{ border: '1px solid #F1F5F9', borderRadius: '10px', overflowX: 'auto' }}>
                <table style={{ width: '100%', fontSize: '11px', borderCollapse: 'collapse', textAlign: 'left' }}>
                  <thead>
                    <tr style={{ backgroundColor: '#F8FAFC', borderBottom: '1px solid #E2E8F0', color: '#64748B' }}>
                      <th style={{ padding: '8px 10px' }}>Lead / Company</th>
                      <th style={{ padding: '8px 10px' }}>Source</th>
                      <th style={{ padding: '8px 10px' }}>Assigned To</th>
                      <th style={{ padding: '8px 10px' }}>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {leadsList.length > 0 ? leadsList.slice(0, 6).map((lead, idx) => (
                      <tr key={idx} style={{ borderBottom: '1px solid #F1F5F9' }}>
                        <td style={{ padding: '8px 10px', fontWeight: '700', color: '#0F172A' }}>{lead.company || lead.name || lead.customerName || 'Lead Inquiry'}</td>
                        <td style={{ padding: '8px 10px', color: '#64748B' }}>{lead.source || 'Direct'}</td>
                        <td style={{ padding: '8px 10px', fontWeight: '600', color: '#0E7490' }}>{lead.assignedTo || lead.salesPerson || 'Unassigned'}</td>
                        <td style={{ padding: '8px 10px' }}>
                          <span style={{ fontSize: '9.5px', fontWeight: '800', padding: '2px 6px', borderRadius: '6px', backgroundColor: '#ECFEFF', color: '#0E7490' }}>{lead.status || 'New'}</span>
                        </td>
                      </tr>
                    )) : (
                      <tr><td colSpan={4} style={{ padding: '20px', textAlign: 'center', color: '#64748B' }}>No leads found in live store.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            <div style={{ backgroundColor: '#FFFFFF', borderRadius: '16px', border: '1px solid #EAEFEF', padding: '16px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '12px', fontWeight: '800', color: '#0F172A', textTransform: 'uppercase' }}>Top Strategic Customers</span>
                <button onClick={() => onNavigateTab && onNavigateTab('Customers')} style={{ border: 'none', background: 'none', color: '#0E7490', fontSize: '11px', fontWeight: '700', cursor: 'pointer' }}>View Customers →</button>
              </div>
              <div style={{ border: '1px solid #F1F5F9', borderRadius: '10px', overflowX: 'auto' }}>
                <table style={{ width: '100%', fontSize: '11px', borderCollapse: 'collapse', textAlign: 'left' }}>
                  <thead>
                    <tr style={{ backgroundColor: '#F8FAFC', borderBottom: '1px solid #E2E8F0', color: '#64748B' }}>
                      <th style={{ padding: '8px 10px' }}>Client / Developer</th>
                      <th style={{ padding: '8px 10px' }}>Revenue</th>
                      <th style={{ padding: '8px 10px' }}>Assigned Rep</th>
                    </tr>
                  </thead>
                  <tbody>
                    {topAccounts.length > 0 ? topAccounts.map((c, idx) => (
                      <tr key={idx} style={{ borderBottom: '1px solid #F1F5F9' }}>
                        <td style={{ padding: '8px 10px', fontWeight: '700', color: '#0F172A' }}>{c.name}</td>
                        <td style={{ padding: '8px 10px', fontWeight: '800', color: '#0E7490' }}>{c.revenue}</td>
                        <td style={{ padding: '8px 10px', color: '#475569' }}>{c.salesPerson}</td>
                      </tr>
                    )) : (
                      <tr><td colSpan={3} style={{ padding: '20px', textAlign: 'center', color: '#64748B' }}>No customer revenue records yet.</td></tr>
                    )}
                  </tbody>
                </table>
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
              <input id="ceo-executive-dashboard-person-search-query" name="personSearchQuery" aria-label="Search person by name, code, role"
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

                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        {emp.department === 'Sales' && (
                          <span style={{
                            fontSize: '10.5px',
                            fontWeight: '800',
                            color: '#0E7490',
                            backgroundColor: '#ECFEFF',
                            border: '1px solid #A5F3FC',
                            padding: '1px 6px',
                            borderRadius: '6px'
                          }}>
                            📦 {emp.records?.boms?.length || 0} BOMs
                          </span>
                        )}
                        <span style={{ fontSize: '11px', fontWeight: '700', color: '#64748B' }}>
                          {emp.recordCount} Active Records
                        </span>
                      </div>
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
      {/* CATEGORY 3: SALES MANAGEMENT FOCUS TAB                   */}
      {/* ======================================================== */}
      {(activeSubTab === 'sales' || activeSubTab === 'sales-targets') && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          
          {/* Sales Top Ribbon (BUSINZ DESIGN SYSTEM) */}
          <CeoKpiGrid kpis={[
            {
              title: 'ACTIVE PROFORMAS (PI)',
              value: `₹ ${totalPiPipelineCr} Cr`,
              trend: `${piList.length} Active PIs`,
              trendUp: piList.length > 0,
              icon: Receipt,
              iconColor: '#0E7490',
              iconBg: '#ECFEFF',
              bottomPrefix: 'Pending BOM ',
              bottomHighlight: `${piList.length} Orders In-Queue`,
              onClick: () => onNavigateTab && onNavigateTab('Sales Proforma')
            },
            {
              title: 'QUOTATIONS PIPELINE',
              value: `₹ ${((quotesList.reduce((acc, q) => acc + parseAmt(q.amount || q.total || q.grandTotal || 0), 0) * periodMultiplier) / 10000000).toFixed(2)} Cr`,
              trend: `${quotesList.length} Quotes`,
              trendUp: quotesList.length > 0,
              icon: FileSpreadsheet,
              iconColor: '#2563EB',
              iconBg: '#EFF6FF',
              bottomPrefix: 'Total submitted ',
              bottomHighlight: `${quotesList.length} Commercial Quotes`
            },
            {
              title: 'QUOTE-TO-PI WIN RATE',
              value: quotesList.length > 0 && piList.length > 0 ? `${Math.min(100, Math.round((piList.length / quotesList.length) * 100))}%` : '0%',
              trend: quotesList.length > 0 ? `${piList.length} / ${quotesList.length}` : '0%',
              trendUp: quotesList.length > 0 && piList.length > 0,
              icon: Target,
              iconColor: '#16A34A',
              iconBg: '#F0FDF4',
              bottomPrefix: 'Pipeline velocity ',
              bottomHighlight: quotesList.length > 0 ? `${piList.length} PIs Generated` : 'Active Pipeline'
            },
            {
              title: 'AVERAGE CONTRACT SIZE',
              value: piList.length > 0 
                ? (totalPiPipelineNum / piList.length >= 10000000 
                    ? `₹ ${(totalPiPipelineNum / piList.length / 10000000).toFixed(2)} Cr` 
                    : `₹ ${(totalPiPipelineNum / piList.length / 100000).toFixed(2)} L`)
                : '₹ 0.00',
              trend: 'Per Order',
              trendUp: true,
              icon: DollarSign,
              iconColor: '#0F172A',
              iconBg: '#F1F5F9',
              bottomPrefix: 'Basis ',
              bottomHighlight: `${piList.length} Active Proformas`
            }
          ]} />

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
          
          {/* Procurement Top Ribbon (BUSINZ DESIGN SYSTEM) */}
          <CeoKpiGrid kpis={[
            {
              title: 'TOTAL PO SPEND HANDLED',
              value: `₹ ${totalPoSpendCr} Cr`,
              trend: `${poList.length} POs`,
              trendUp: poList.length > 0,
              icon: ShoppingCart,
              iconColor: '#2563EB',
              iconBg: '#EFF6FF',
              bottomPrefix: 'Spend authorized ',
              bottomHighlight: totalPoSpendFormatted,
              onClick: () => onNavigateTab && onNavigateTab('Purchase Orders')
            },
            {
              title: 'PURCHASE ORDERS COUNT',
              value: `${poList.length} Orders`,
              trend: `${new Set(poList.map(p => p.vendor_name || p.vendor || p.vendorName).filter(Boolean)).size} Suppliers`,
              trendUp: poList.length > 0,
              icon: FileCheck,
              iconColor: '#0F172A',
              iconBg: '#F8FAFC',
              bottomPrefix: 'Supplier base ',
              bottomHighlight: `${new Set(poList.map(p => p.vendor_name || p.vendor || p.vendorName).filter(Boolean)).size} Active Suppliers`
            },
            {
              title: 'PENDING MD APPROVALS',
              value: `${pendingMdPOs.length} Draft POs`,
              trend: pendingMdPOs.length > 0 ? `${pendingMdPOs.length} Pending` : 'All Approved',
              trendUp: pendingMdPOs.length === 0,
              highlightCard: pendingMdPOs.length > 0,
              icon: AlertCircle,
              iconColor: pendingMdPOs.length > 0 ? '#DC2626' : '#16A34A',
              iconBg: pendingMdPOs.length > 0 ? '#FEF2F2' : '#F0FDF4',
              bottomPrefix: 'Executive signature ',
              bottomHighlight: pendingMdPOs.length > 0 ? 'Awaiting CEO / MD' : 'Fully Authorized',
              onClick: () => onNavigateTab && onNavigateTab('Purchase Orders', null, 'WAITING FOR APPROVAL')
            },
            {
              title: 'PRIMARY MATERIAL SOURCED',
              value: 'CR & HR Steel Coils',
              trend: 'Alloy 6063-T6',
              trendUp: true,
              icon: Layers,
              iconColor: '#0E7490',
              iconBg: '#ECFEFF',
              bottomPrefix: 'Raw materials ',
              bottomHighlight: 'CR/HR Coils & Billets'
            }
          ]} />

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
                onClick={() => onNavigateTab && onNavigateTab('Purchase Orders', null, 'WAITING FOR APPROVAL')}
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
                Open PO Approval <ArrowRight size={12} />
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
      {/* CATEGORY 8: ACCOUNTS & FINANCE FOCUS TAB                 */}
      {/* ======================================================== */}
      {(activeSubTab === 'accounts' || activeSubTab === 'finance') && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          
          {/* Accounts Top Ribbon (BUSINZ DESIGN SYSTEM) */}
          <CeoKpiGrid kpis={[
            {
              title: 'TOTAL INVOICED (GST TAX BILLED)',
              value: `₹ ${totalRevenueCr} Cr`,
              trend: `${invList.length} Invoices`,
              trendUp: invList.length > 0,
              icon: FileCheck,
              iconColor: '#7C3AED',
              iconBg: '#FAF5FF',
              bottomPrefix: 'GST billing ',
              bottomHighlight: totalRevenueFormatted,
              onClick: () => onNavigateTab && onNavigateTab('Invoice Management')
            },
            {
              title: 'REALIZED COLLECTIONS',
              value: `₹ ${totalCollectedCr} Cr`,
              trend: totalInvoicedNum > 0 ? `${((totalCollectedNum / totalInvoicedNum) * 100).toFixed(1)}% Rate` : '0% Rate',
              trendUp: totalCollectedNum > 0,
              icon: Wallet,
              iconColor: '#16A34A',
              iconBg: '#F0FDF4',
              bottomPrefix: 'Realization rate ',
              bottomHighlight: totalInvoicedNum > 0 ? `${((totalCollectedNum / totalInvoicedNum) * 100).toFixed(1)}% Realized` : 'Active Collections'
            },
            {
              title: 'PENDING OUTSTANDING BALANCE',
              value: `₹ ${outstandingOverdueCr} Cr`,
              trend: 'Receivables',
              trendUp: outstandingOverdueNum === 0,
              icon: Clock,
              iconColor: '#D97706',
              iconBg: '#FFFBEB',
              bottomPrefix: 'Receivables follow-up ',
              bottomHighlight: outstandingOverdueFormatted
            },
            {
              title: 'CRITICAL AGING (>30 DAYS)',
              value: agingBuckets[3]?.amount || '₹ 0.00',
              trend: agingBuckets[3]?.raw > 0 ? 'Overdue' : 'Healthy',
              trendUp: !(agingBuckets[3]?.raw > 0),
              highlightCard: agingBuckets[3]?.raw > 0,
              icon: AlertTriangle,
              iconColor: '#DC2626',
              iconBg: '#FEF2F2',
              bottomPrefix: 'Overdue status ',
              bottomHighlight: agingBuckets[3]?.raw > 0 ? 'Requires CEO Escalation' : 'No Critical Overdue'
            }
          ]} />

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
                onClick={() => onNavigateTab && onNavigateTab('Billing Dashboard')}
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
                Go to Billing Dashboard <ArrowRight size={12} />
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
      {/* CATEGORY 4: BOM & PRODUCTION OPERATIONS                  */}
      {/* ======================================================== */}
      {(activeSubTab === 'production' || activeSubTab === 'bom-workflow') && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          
          {/* Production Top Ribbon (BUSINZ DESIGN SYSTEM) */}
          <CeoKpiGrid kpis={[
            {
              title: `PLANT OUTPUT (${selectedPeriod})`,
              value: `${totalProductionTonnage.toFixed(1)} MT`,
              trend: `${bomList.length} Active BOMs`,
              trendUp: bomList.length > 0,
              icon: Factory,
              iconColor: '#0284C7',
              iconBg: '#F0F9FF',
              bottomPrefix: 'Factory workflow ',
              bottomHighlight: `${bomList.length} Active BOMs In-Progress`,
              onClick: () => onNavigateTab && onNavigateTab('BOM Orders')
            },
            {
              title: 'ACTIVE BOM ORDERS',
              value: `${bomList.length} Orders`,
              trend: `${bomList.filter(b => b && !b.cancelled && String(b.status || '').toLowerCase() !== 'draft').length} Confirmed`,
              trendUp: bomList.length > 0,
              icon: Boxes,
              iconColor: '#0F172A',
              iconBg: '#F8FAFC',
              bottomPrefix: 'Order book value ',
              bottomHighlight: totalBomOrderValueFormatted
            },
            {
              title: 'WORK ORDERS STATUS',
              value: `${workOrdersList.length} Work Orders`,
              trend: `${workOrdersList.filter(w => w.status === 'Completed').length} Done`,
              trendUp: workOrdersList.length > 0,
              icon: CheckCircle2,
              iconColor: '#16A34A',
              iconBg: '#F0FDF4',
              bottomPrefix: 'In progress ',
              bottomHighlight: `${workOrdersList.filter(w => w.status !== 'Completed').length} Active Lines`
            },
            {
              title: 'PLANT LINES STATUS',
              value: bomList.length > 0 ? 'Plant Operational' : 'Standby',
              trend: 'Roll & Slit',
              trendUp: bomList.length > 0,
              icon: Activity,
              iconColor: '#059669',
              iconBg: '#ECFDF5',
              bottomPrefix: 'Machinery status ',
              bottomHighlight: 'Roll-Forming & Slitting Ready'
            }
          ]} />

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
          
          {/* Dispatch Top Ribbon (BUSINZ DESIGN SYSTEM) */}
          <CeoKpiGrid kpis={[
            {
              title: `TOTAL DISPATCHED (${selectedPeriod})`,
              value: `${dispatchesList.length + challansList.length} Shipments`,
              trend: `${challansList.length} Challans`,
              trendUp: dispatchesList.length + challansList.length > 0,
              icon: Truck,
              iconColor: '#059669',
              iconBg: '#ECFDF5',
              bottomPrefix: 'Delivery challans ',
              bottomHighlight: `${challansList.length} Recorded`,
              onClick: () => onNavigateTab && onNavigateTab('Dispatch Tracking')
            },
            {
              title: 'VEHICLES DISPATCHED',
              value: `${challansList.filter(c => c.vehicleNo || c.vehicle).length} Vehicles`,
              trend: 'Fleet Active',
              trendUp: challansList.filter(c => c.vehicleNo || c.vehicle).length > 0,
              icon: Truck,
              iconColor: '#2563EB',
              iconBg: '#EFF6FF',
              bottomPrefix: 'Transport fleet ',
              bottomHighlight: 'Direct & 3rd-Party Transporters'
            },
            {
              title: 'DISPATCH CLEARANCES',
              value: challansList.length > 0 || dispatchesList.length > 0 ? 'Active Clearances' : 'Standby',
              trend: 'Gate Clear',
              trendUp: challansList.length > 0 || dispatchesList.length > 0,
              icon: CheckCircle,
              iconColor: '#16A34A',
              iconBg: '#F0FDF4',
              bottomPrefix: 'Security clearances ',
              bottomHighlight: 'Outward Gate Verified'
            },
            {
              title: 'PENDING TRANSPORTER LR',
              value: `${challansList.filter(c => !c.lrNumber && !c.lr_no).length} Challans`,
              trend: challansList.filter(c => !c.lrNumber && !c.lr_no).length > 0 ? 'Needs LR Copy' : 'All Clear',
              trendUp: challansList.filter(c => !c.lrNumber && !c.lr_no).length === 0,
              highlightCard: challansList.filter(c => !c.lrNumber && !c.lr_no).length > 0,
              icon: AlertCircle,
              iconColor: '#D97706',
              iconBg: '#FFFBEB',
              bottomPrefix: 'Documentation ',
              bottomHighlight: challansList.filter(c => !c.lrNumber && !c.lr_no).length > 0 ? 'Pending LR Upload' : '100% Up to Date'
            }
          ]} />

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
      {/* CATEGORY 6: INVENTORY & WAREHOUSE DASHBOARD              */}
      {/* ======================================================== */}
      {activeSubTab === 'inventory-dashboard' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          {/* Inventory Top Ribbon (BUSINZ DESIGN SYSTEM) */}
          <CeoKpiGrid kpis={[
            {
              title: 'TOTAL INVENTORY SKUS',
              value: `${inventoryList.length} Items`,
              trend: 'Catalog Synced',
              trendUp: true,
              icon: Boxes,
              iconColor: '#0E7490',
              iconBg: '#ECFEFF',
              bottomPrefix: 'Items directory ',
              bottomHighlight: `${inventoryList.length} Active SKUs`,
              onClick: () => onNavigateTab && onNavigateTab('Items Directory')
            },
            {
              title: 'LOW STOCK / REORDER ALERTS',
              value: `${inventoryList.filter(it => (parseFloat(it.stock || it.quantity || it.availableStock || 0) || 0) <= (parseFloat(it.minStock || it.reorderLevel || 10) || 10)).length} Items`,
              trend: inventoryList.filter(it => (parseFloat(it.stock || it.quantity || it.availableStock || 0) || 0) <= (parseFloat(it.minStock || it.reorderLevel || 10) || 10)).length > 0 ? 'Critical' : 'Healthy',
              trendUp: inventoryList.filter(it => (parseFloat(it.stock || it.quantity || it.availableStock || 0) || 0) <= (parseFloat(it.minStock || it.reorderLevel || 10) || 10)).length === 0,
              highlightCard: inventoryList.filter(it => (parseFloat(it.stock || it.quantity || it.availableStock || 0) || 0) <= (parseFloat(it.minStock || it.reorderLevel || 10) || 10)).length > 0,
              icon: AlertTriangle,
              iconColor: '#DC2626',
              iconBg: '#FEF2F2',
              bottomPrefix: 'Reorder status ',
              bottomHighlight: 'Below Minimum Threshold',
              onClick: () => onNavigateTab && onNavigateTab('Material Reorder')
            },
            {
              title: 'GOODS RECEIPT NOTES (GRN)',
              value: `${grnList.length} Inwarded`,
              trend: 'Verified',
              trendUp: true,
              icon: Package,
              iconColor: '#16A34A',
              iconBg: '#F0FDF4',
              bottomPrefix: 'Inward verification ',
              bottomHighlight: 'Verified Stock Receipts',
              onClick: () => onNavigateTab && onNavigateTab('Goods Receipt Note')
            },
            {
              title: 'RESERVED FOR BOMS',
              value: `${bomList.length} Active BOMs`,
              trend: `${totalProductionTonnage.toFixed(1)} MT`,
              trendUp: bomList.length > 0,
              icon: Factory,
              iconColor: '#2563EB',
              iconBg: '#EFF6FF',
              bottomPrefix: 'Material allocation ',
              bottomHighlight: `${totalProductionTonnage.toFixed(1)} MT Allocated`,
              onClick: () => onNavigateTab && onNavigateTab('Stock Status')
            }
          ]} />

          <div style={{ backgroundColor: '#FFFFFF', borderRadius: '16px', border: '1px solid #EAEFEF', padding: '14px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px' }}>
            <div>
              <div style={{ fontSize: '13px', fontWeight: '800', color: '#0F172A', textTransform: 'uppercase' }}>6. Inventory & Warehouse Command Center</div>
              <div style={{ fontSize: '11px', color: '#64748B', marginTop: '2px' }}>Live stock levels, reserved BOM allocations, low-stock reorder alerts, and GRN inward history</div>
            </div>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              <button onClick={() => onNavigateTab && onNavigateTab('Inventory Stores')} style={{ border: 'none', backgroundColor: '#0E7490', color: '#FFFFFF', padding: '6px 12px', borderRadius: '8px', fontSize: '11px', fontWeight: '700', cursor: 'pointer' }}>Inventory Overview</button>
              <button onClick={() => onNavigateTab && onNavigateTab('Items Directory')} style={{ border: '1px solid #CBD5E1', backgroundColor: '#FFFFFF', color: '#334155', padding: '6px 12px', borderRadius: '8px', fontSize: '11px', fontWeight: '700', cursor: 'pointer' }}>Physical Stock</button>
              <button onClick={() => onNavigateTab && onNavigateTab('Stock Status')} style={{ border: '1px solid #CBD5E1', backgroundColor: '#FFFFFF', color: '#334155', padding: '6px 12px', borderRadius: '8px', fontSize: '11px', fontWeight: '700', cursor: 'pointer' }}>Reserved Stock</button>
              <button onClick={() => onNavigateTab && onNavigateTab('Material Reorder')} style={{ border: '1px solid #FCA5A5', backgroundColor: '#FEF2F2', color: '#DC2626', padding: '6px 12px', borderRadius: '8px', fontSize: '11px', fontWeight: '800', cursor: 'pointer' }}>Low Stock Alerts</button>
              <button onClick={() => onNavigateTab && onNavigateTab('Goods Receipt Note')} style={{ border: '1px solid #CBD5E1', backgroundColor: '#FFFFFF', color: '#334155', padding: '6px 12px', borderRadius: '8px', fontSize: '11px', fontWeight: '700', cursor: 'pointer' }}>GRN History</button>
            </div>
          </div>

          <div style={{ backgroundColor: '#FFFFFF', borderRadius: '16px', border: '1px solid #EAEFEF', padding: '16px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <span style={{ fontSize: '12px', fontWeight: '800', color: '#0F172A', textTransform: 'uppercase' }}>Live Inventory Stock Directory Snapshot</span>
            <div style={{ border: '1px solid #F1F5F9', borderRadius: '10px', overflowX: 'auto' }}>
              <table style={{ width: '100%', fontSize: '11px', borderCollapse: 'collapse', textAlign: 'left' }}>
                <thead>
                  <tr style={{ backgroundColor: '#F8FAFC', borderBottom: '1px solid #E2E8F0', color: '#64748B' }}>
                    <th style={{ padding: '8px 10px' }}>Item Code / SKU</th>
                    <th style={{ padding: '8px 10px' }}>Material Description</th>
                    <th style={{ padding: '8px 10px' }}>Category</th>
                    <th style={{ padding: '8px 10px' }}>Available Qty</th>
                    <th style={{ padding: '8px 10px' }}>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {inventoryList.length > 0 ? inventoryList.slice(0, 8).map((item, idx) => {
                    const qty = parseFloat(item.stock ?? item.quantity ?? item.availableStock ?? 0) || 0;
                    const minQty = parseFloat(item.minStock ?? item.reorderLevel ?? 10) || 10;
                    const isLow = qty <= minQty;
                    return (
                      <tr key={idx} style={{ borderBottom: '1px solid #F1F5F9' }}>
                        <td style={{ padding: '8px 10px', fontWeight: '800', color: '#0E7490' }}>{item.code || item.itemCode || item.sku || `SKU-${idx + 1}`}</td>
                        <td style={{ padding: '8px 10px', fontWeight: '700', color: '#0F172A' }}>{item.name || item.itemName || item.description || 'Raw Material'}</td>
                        <td style={{ padding: '8px 10px', color: '#64748B' }}>{item.category || 'Solar Structure Material'}</td>
                        <td style={{ padding: '8px 10px', fontWeight: '800', color: isLow ? '#DC2626' : '#0F172A' }}>{qty} {item.unit || item.uom || 'Nos'}</td>
                        <td style={{ padding: '8px 10px' }}>
                          <span style={{ fontSize: '9.5px', fontWeight: '800', padding: '2px 6px', borderRadius: '6px', backgroundColor: isLow ? '#FEF2F2' : '#DCFCE7', color: isLow ? '#DC2626' : '#16A34A' }}>
                            {isLow ? 'Low Stock' : 'In Stock'}
                          </span>
                        </td>
                      </tr>
                    );
                  }) : (
                    <tr><td colSpan={5} style={{ padding: '20px', textAlign: 'center', color: '#64748B' }}>No inventory items loaded yet. Click "Inventory Overview" to inspect warehouse stores.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* CATEGORY 9: TASKS & APPROVALS DASHBOARD                  */}
      {/* ======================================================== */}
      {(activeSubTab === 'tasks-dashboard' || activeSubTab === 'tasks') && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          {/* Tasks Top Ribbon (BUSINZ DESIGN SYSTEM) */}
          <CeoKpiGrid kpis={[
            {
              title: 'PENDING MD PO APPROVALS',
              value: `${pendingMdPOs.length} POs`,
              trend: pendingMdPOs.length > 0 ? 'Sign-Off Needed' : 'Zero Pending',
              trendUp: pendingMdPOs.length === 0,
              highlightCard: pendingMdPOs.length > 0,
              icon: AlertCircle,
              iconColor: pendingMdPOs.length > 0 ? '#DC2626' : '#16A34A',
              iconBg: pendingMdPOs.length > 0 ? '#FEF2F2' : '#F0FDF4',
              bottomPrefix: 'Executive signature ',
              bottomHighlight: pendingMdPOs.length > 0 ? 'Awaiting CEO / MD' : 'All Approved',
              onClick: () => onNavigateTab && onNavigateTab('Purchase Orders', null, 'WAITING FOR APPROVAL')
            },
            {
              title: 'APPROVED POS HISTORY',
              value: `${Math.max(0, poList.length - pendingMdPOs.length)} Approved`,
              trend: 'Proceeded',
              trendUp: true,
              icon: CheckCircle2,
              iconColor: '#2563EB',
              iconBg: '#EFF6FF',
              bottomPrefix: 'Execution flow ',
              bottomHighlight: 'Proceeded to Payment & GRN'
            },
            {
              title: 'ACTIVE BOM APPROVALS',
              value: `${bomList.length} BOM Orders`,
              trend: `${bomList.length} Active`,
              trendUp: bomList.length > 0,
              icon: Factory,
              iconColor: '#0E7490',
              iconBg: '#ECFEFF',
              bottomPrefix: 'Workflow span ',
              bottomHighlight: 'Across Production & Dispatch',
              onClick: () => onNavigateTab && onNavigateTab('BOM Orders')
            },
            {
              title: 'CRITICAL ESCALATIONS',
              value: `${realRiskAlerts.length} Alerts`,
              trend: realRiskAlerts.length > 0 ? 'Watchlist' : 'Healthy',
              trendUp: realRiskAlerts.length === 0,
              highlightCard: realRiskAlerts.length > 0,
              icon: AlertTriangle,
              iconColor: realRiskAlerts.length > 0 ? '#D97706' : '#16A34A',
              iconBg: realRiskAlerts.length > 0 ? '#FFFBEB' : '#F0FDF4',
              bottomPrefix: 'Watchlist ',
              bottomHighlight: realRiskAlerts.length > 0 ? 'SLA & Overdue Watchlist' : 'Zero Critical Breaches'
            }
          ]} />

          <div style={{ backgroundColor: '#FFFFFF', borderRadius: '16px', border: '1px solid #EAEFEF', padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
              <div>
                <span style={{ fontSize: '13px', fontWeight: '800', color: '#0F172A', textTransform: 'uppercase' }}>9. Executive Approvals & Action Queue</span>
                <div style={{ fontSize: '11px', color: '#64748B', marginTop: '2px' }}>Authorize pending Purchase Orders and review high-priority operational tasks</div>
              </div>
              <button onClick={() => onNavigateTab && onNavigateTab('Purchase Orders', null, 'WAITING FOR APPROVAL')} style={{ border: 'none', backgroundColor: '#0E7490', color: '#FFFFFF', padding: '6px 14px', borderRadius: '8px', fontSize: '11.5px', fontWeight: '800', cursor: 'pointer' }}>
                Open PO Approval Page →
              </button>
            </div>

            <div style={{ border: '1px solid #F1F5F9', borderRadius: '10px', overflowX: 'auto' }}>
              <table style={{ width: '100%', fontSize: '11.5px', borderCollapse: 'collapse', textAlign: 'left' }}>
                <thead>
                  <tr style={{ backgroundColor: '#F8FAFC', borderBottom: '1px solid #E2E8F0', color: '#64748B' }}>
                    <th style={{ padding: '8px 10px' }}>Reference</th>
                    <th style={{ padding: '8px 10px' }}>Vendor / Counterparty</th>
                    <th style={{ padding: '8px 10px' }}>Value</th>
                    <th style={{ padding: '8px 10px' }}>Current Stage</th>
                    <th style={{ padding: '8px 10px', textAlign: 'right' }}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {pendingMdPOs.length > 0 ? pendingMdPOs.map((po, idx) => (
                    <tr key={idx} style={{ borderBottom: '1px solid #F1F5F9' }}>
                      <td style={{ padding: '8px 10px', fontWeight: '800', color: '#2563EB' }}>{po.poNo || po.poNumber || po.purchaseorder_number || '-'}</td>
                      <td style={{ padding: '8px 10px', fontWeight: '700', color: '#0F172A' }}>{po.vendor || po.vendorName || po.vendor_name || 'Vendor'}</td>
                      <td style={{ padding: '8px 10px', fontWeight: '800' }}>₹ {(parseAmt(po.amount || po.total) / 100000).toFixed(2)} Lakhs</td>
                      <td style={{ padding: '8px 10px' }}>
                        <span style={{ fontSize: '10px', fontWeight: '800', padding: '2px 7px', borderRadius: '8px', backgroundColor: '#FEF2F2', color: '#DC2626' }}>
                          Awaiting MD Approval
                        </span>
                      </td>
                      <td style={{ padding: '8px 10px', textAlign: 'right' }}>
                        <button onClick={() => onNavigateTab && onNavigateTab('Purchase Orders', po.poNo || po.poNumber || po.purchaseorder_number || null, 'WAITING FOR APPROVAL')} style={{ border: 'none', backgroundColor: '#0E7490', color: '#FFFFFF', padding: '4px 10px', borderRadius: '6px', fontSize: '10.5px', fontWeight: '700', cursor: 'pointer' }}>
                          Review & Approve
                        </button>
                      </td>
                    </tr>
                  )) : (
                    <tr><td colSpan={5} style={{ padding: '24px', textAlign: 'center', color: '#16A34A', fontWeight: '700' }}>All Purchase Orders are approved and up to date.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* CATEGORY 10: REPORTS & ANALYTICS DASHBOARD               */}
      {/* ======================================================== */}
      {(activeSubTab === 'reports-dashboard' || activeSubTab === 'reports') && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          {/* Reports Top Ribbon (BUSINZ DESIGN SYSTEM) */}
          <CeoKpiGrid kpis={[
            {
              title: 'TOTAL INVOICED REVENUE',
              value: `₹ ${totalRevenueCr} Cr`,
              trend: `${invList.length} Invoices`,
              trendUp: invList.length > 0,
              icon: FileCheck,
              iconColor: '#0E7490',
              iconBg: '#ECFEFF',
              bottomPrefix: 'GST billing ',
              bottomHighlight: `${invList.length} Tax Invoices`,
              onClick: () => onNavigateTab && onNavigateTab('Sales Reports')
            },
            {
              title: 'TOTAL PROCUREMENT SPEND',
              value: `₹ ${totalPoSpendCr} Cr`,
              trend: `${poList.length} POs`,
              trendUp: poList.length > 0,
              icon: ShoppingCart,
              iconColor: '#2563EB',
              iconBg: '#EFF6FF',
              bottomPrefix: 'Purchase orders ',
              bottomHighlight: `${poList.length} Authorized POs`,
              onClick: () => onNavigateTab && onNavigateTab('Procurement Reports')
            },
            {
              title: 'PLANT PRODUCTION OUTPUT',
              value: `${totalProductionTonnage.toFixed(1)} MT`,
              trend: `${bomList.length} BOMs`,
              trendUp: bomList.length > 0,
              icon: Factory,
              iconColor: '#0284C7',
              iconBg: '#F0F9FF',
              bottomPrefix: 'Factory output ',
              bottomHighlight: `${bomList.length} BOM Orders`,
              onClick: () => onNavigateTab && onNavigateTab('Production Reports')
            },
            {
              title: 'COLLECTIONS REALIZED',
              value: `₹ ${totalCollectedCr} Cr`,
              trend: totalInvoicedNum > 0 ? `${((totalCollectedNum / totalInvoicedNum) * 100).toFixed(1)}%` : '0%',
              trendUp: totalCollectedNum > 0,
              icon: Wallet,
              iconColor: '#16A34A',
              iconBg: '#F0FDF4',
              bottomPrefix: 'Outstanding ',
              bottomHighlight: `₹ ${outstandingOverdueCr} Cr Pending`
            }
          ]} />

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '12px' }}>
            {[
              { title: 'Sales Analytics & Reports', desc: 'Quotation conversion, Proforma pipeline, and rep-wise revenue breakdown.', target: 'Sales Reports', color: '#0E7490', bg: '#ECFEFF' },
              { title: 'Operational & Production Reports', desc: 'Plant extrusion tonnage, BOM order completion, and dispatch turnaround.', target: 'Production Reports', color: '#0284C7', bg: '#F0F9FF' },
              { title: 'Inventory & Stock Analytics', desc: 'Raw material consumption, reserved stock, and reorder valuation.', target: 'Stock Status', color: '#059669', bg: '#ECFDF5' },
              { title: 'Financial & Procurement MIS', desc: 'Vendor spend analysis, PO history, GST tax billing, and cash flow.', target: 'Procurement Reports', color: '#7C3AED', bg: '#F5F3FF' }
            ].map((repCard, idx) => (
              <div key={idx} style={{ backgroundColor: '#FFFFFF', borderRadius: '16px', border: '1px solid #EAEFEF', padding: '16px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', gap: '10px' }}>
                <div>
                  <span style={{ fontSize: '10px', fontWeight: '800', color: repCard.color, backgroundColor: repCard.bg, padding: '2px 8px', borderRadius: '6px', textTransform: 'uppercase' }}>MIS Report</span>
                  <div style={{ fontSize: '13px', fontWeight: '800', color: '#0F172A', marginTop: '8px' }}>{repCard.title}</div>
                  <p style={{ fontSize: '11px', color: '#64748B', margin: '4px 0 0 0', lineHeight: '1.4' }}>{repCard.desc}</p>
                </div>
                <button
                  onClick={() => onNavigateTab && onNavigateTab(repCard.target)}
                  style={{ border: 'none', backgroundColor: repCard.color, color: '#FFFFFF', padding: '7px 12px', borderRadius: '8px', fontSize: '11px', fontWeight: '700', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}
                >
                  Open {repCard.title.split(' ')[0]} Report <ArrowRight size={12} />
                </button>
              </div>
            ))}
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
                      {/* If Sales: show their PIs, Quotes, and BOM Orders */}
                      {activePersonModal.department === 'Sales' && (
                        (activePersonModal.records?.pis?.length > 0 || activePersonModal.records?.quotes?.length > 0 || activePersonModal.records?.boms?.length > 0) ? (
                          [...(activePersonModal.records?.boms || []), ...(activePersonModal.records?.pis || []), ...(activePersonModal.records?.quotes || [])].slice(0, 8).map((rec, rIdx) => {
                            const isBom = Boolean(rec.bomCode || (rec.code && String(rec.code).startsWith('BOM')));
                            const refNo = rec.bomCode || rec.code || rec.piNo || rec.quoteNo || rec.id;
                            const amt = isBom 
                              ? (rec.totalWeight ? `${rec.totalWeight} MT` : (rec.totalAmount ? `₹ ${parseAmt(rec.totalAmount).toLocaleString('en-IN')}` : 'BOM Order'))
                              : (typeof rec.grandTotal === 'number' 
                                  ? `₹ ${rec.grandTotal.toLocaleString('en-IN')}` 
                                  : (rec.grandTotal || (rec.amount ? `₹ ${parseAmt(rec.amount).toLocaleString('en-IN')}` : '₹ 0.00')));
                            return (
                              <tr key={rIdx} style={{ borderBottom: '1px solid #F1F5F9' }}>
                                <td style={{ padding: '8px 10px', fontWeight: '800', color: isBom ? '#0284C7' : '#0E7490' }}>
                                  {refNo} {isBom && <span style={{ fontSize: '8.5px', padding: '1px 4px', backgroundColor: '#E0F2FE', color: '#0369A1', borderRadius: '4px', marginLeft: '4px' }}>BOM</span>}
                                </td>
                                <td style={{ padding: '8px 10px', fontWeight: '700' }}>{rec.customerName || rec.customer || 'Key Client'}</td>
                                <td style={{ padding: '8px 10px', fontWeight: '800' }}>{amt}</td>
                                <td style={{ padding: '8px 10px' }}>
                                  <span style={{ fontSize: '9.5px', fontWeight: '800', padding: '2px 6px', borderRadius: '6px', backgroundColor: isBom ? '#EFF6FF' : '#DCFCE7', color: isBom ? '#1D4ED8' : '#16A34A' }}>
                                    {rec.status || 'Active'}
                                  </span>
                                </td>
                              </tr>
                            );
                          })
                        ) : (
                          <tr>
                            <td colSpan={4} style={{ padding: '20px', textAlign: 'center', color: '#64748B' }}>
                              No Proforma Invoices, Quotes, or BOM orders created yet.
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
                <label htmlFor="ceo-executive-dashboard-editing-target-rep" style={{ fontSize: '11px', fontWeight: '800', color: '#475569', textTransform: 'uppercase', display: 'block', marginBottom: '6px' }}>
                  Target Scope / Sales Representative
                </label>
                <select id="ceo-executive-dashboard-editing-target-rep" name="editingTargetRep" aria-label="Target Scope / Sales Representative"
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
                <input id="ceo-executive-dashboard-editing-target-amount" name="editingTargetAmount" aria-label="Enter amount in ₹ ( 18000000)"
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

      {/* MODAL: SALES REP BOM ORDERS DETAIL MODAL */}
      {viewingRepBomsModal && (
        <div style={{
          position: 'fixed',
          top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(15, 23, 42, 0.65)',
          backdropFilter: 'blur(3px)',
          zIndex: 99999,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '16px'
        }}>
          <div style={{
            backgroundColor: '#FFFFFF',
            borderRadius: '20px',
            width: '900px',
            maxWidth: '100%',
            maxHeight: '90vh',
            display: 'flex',
            flexDirection: 'column',
            boxShadow: '0 25px 50px -12px rgba(15, 23, 42, 0.35)',
            border: '1px solid #E2E8F0',
            overflow: 'hidden'
          }}>
            {/* Modal Header */}
            <div style={{
              padding: '18px 24px',
              borderBottom: '1px solid #E2E8F0',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              background: 'linear-gradient(135deg, #F8FAFC 0%, #FFFFFF 100%)'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{
                  width: '42px',
                  height: '42px',
                  borderRadius: '12px',
                  backgroundColor: viewingRepBomsModal.avatarBg || '#0E7490',
                  color: '#FFFFFF',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '15px',
                  fontWeight: '800'
                }}>
                  {viewingRepBomsModal.name.split(' ').map(n => n[0]).slice(0, 2).join('')}
                </div>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <h3 style={{ fontSize: '16px', fontWeight: '800', color: '#0F172A', margin: 0 }}>
                      {viewingRepBomsModal.name}
                    </h3>
                    <span style={{ fontSize: '10.5px', fontWeight: '700', color: '#0E7490', backgroundColor: '#ECFEFF', border: '1px solid #A5F3FC', padding: '1px 7px', borderRadius: '6px' }}>
                      {viewingRepBomsModal.code}
                    </span>
                    <span style={{ fontSize: '11px', fontWeight: '700', color: '#64748B' }}>
                      • {viewingRepBomsModal.role}
                    </span>
                  </div>
                  <div style={{ fontSize: '11.5px', color: '#64748B', marginTop: '2px' }}>
                    Total BOM Orders Given: <strong>{viewingRepBomsModal.boms.length} Orders</strong> • Total Value: <strong>{viewingRepBomsModal.totalAmount >= 10000000 ? `₹ ${(viewingRepBomsModal.totalAmount / 10000000).toFixed(2)} Cr` : `₹ ${(viewingRepBomsModal.totalAmount / 100000).toFixed(2)} Lakhs`}</strong> • Total Weight: <strong>{viewingRepBomsModal.totalTonnage.toFixed(1)} MT</strong>
                  </div>
                </div>
              </div>

              <button
                onClick={() => setViewingRepBomsModal(null)}
                style={{
                  border: 'none',
                  backgroundColor: '#F1F5F9',
                  color: '#64748B',
                  width: '32px',
                  height: '32px',
                  borderRadius: '50%',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
              >
                <X size={16} />
              </button>
            </div>

            {/* Modal Body: Table of BOMs */}
            <div style={{ padding: '16px 24px', overflowY: 'auto', flex: 1 }}>
              {viewingRepBomsModal.boms.length === 0 ? (
                <div style={{ padding: '40px 20px', textAlign: 'center', color: '#64748B' }}>
                  <Boxes size={36} color="#CBD5E1" style={{ marginBottom: '10px' }} />
                  <div style={{ fontSize: '13px', fontWeight: '700', color: '#0F172A' }}>No BOM orders recorded for this sales representative yet</div>
                  <div style={{ fontSize: '11.5px', color: '#94A3B8', marginTop: '4px' }}>BOMs raised by {viewingRepBomsModal.name} in the BOM Orders view will automatically appear here.</div>
                </div>
              ) : (
                <div style={{ border: '1px solid #E2E8F0', borderRadius: '12px', overflow: 'hidden' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11.5px', textAlign: 'left' }}>
                    <thead>
                      <tr style={{ backgroundColor: '#F8FAFC', borderBottom: '1px solid #E2E8F0', color: '#64748B', fontWeight: '700' }}>
                        <th style={{ padding: '10px 12px' }}>#</th>
                        <th style={{ padding: '10px 12px' }}>BOM Order No</th>
                        <th style={{ padding: '10px 12px' }}>Client / Developer</th>
                        <th style={{ padding: '10px 12px' }}>Date</th>
                        <th style={{ padding: '10px 12px' }}>Tonnage</th>
                        <th style={{ padding: '10px 12px' }}>Order Value</th>
                        <th style={{ padding: '10px 12px' }}>Status</th>
                        <th style={{ padding: '10px 12px', textAlign: 'center' }}>Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {viewingRepBomsModal.boms.map((b, idx) => {
                        const bomAmt = parseAmt(b.totalAmount || b.amount || b.grandTotal || b.value || b.val || 0);
                        const weight = parseFloat(b.totalWeight || b.weight || 0) || 0;
                        return (
                          <tr key={idx} style={{ borderBottom: idx === viewingRepBomsModal.boms.length - 1 ? 'none' : '1px solid #F1F5F9' }}>
                            <td style={{ padding: '10px 12px', color: '#94A3B8', fontWeight: '600' }}>{idx + 1}</td>
                            <td style={{ padding: '10px 12px', fontWeight: '800', color: '#0E7490' }}>
                              {b.bomCode || b.code || b.id || `BOM-${idx + 1}`}
                            </td>
                            <td style={{ padding: '10px 12px', fontWeight: '700', color: '#0F172A' }}>
                              {b.customer || b.customerName || 'Client'}
                            </td>
                            <td style={{ padding: '10px 12px', color: '#64748B' }}>
                              {b.date || b.createdAt ? new Date(b.date || b.createdAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'}
                            </td>
                            <td style={{ padding: '10px 12px', fontWeight: '700', color: '#0284C7' }}>
                              {weight > 0 ? `${weight.toFixed(1)} MT` : '—'}
                            </td>
                            <td style={{ padding: '10px 12px', fontWeight: '800', color: '#0F172A' }}>
                              {bomAmt > 0 ? `₹ ${bomAmt.toLocaleString('en-IN')}` : '₹ 0.00'}
                            </td>
                            <td style={{ padding: '10px 12px' }}>
                              <span style={{
                                padding: '3px 8px',
                                borderRadius: '6px',
                                fontSize: '10px',
                                fontWeight: '800',
                                backgroundColor: String(b.status).toLowerCase().includes('production') ? '#EFF6FF' : (String(b.status).toLowerCase().includes('dispatch') || b.invoiceConfirmed ? '#F0FDF4' : '#FFFBEB'),
                                color: String(b.status).toLowerCase().includes('production') ? '#1D4ED8' : (String(b.status).toLowerCase().includes('dispatch') || b.invoiceConfirmed ? '#15803D' : '#B45309')
                              }}>
                                {b.status || 'Active'}
                              </span>
                            </td>
                            <td style={{ padding: '10px 12px', textAlign: 'center' }}>
                              <button
                                onClick={() => {
                                  setViewingRepBomsModal(null);
                                  if (onNavigateTab) {
                                    onNavigateTab('BOM Orders', null, null, null);
                                  }
                                }}
                                style={{
                                  border: '1px solid #CBD5E1',
                                  backgroundColor: '#FFFFFF',
                                  color: '#0E7490',
                                  padding: '4px 8px',
                                  borderRadius: '6px',
                                  fontSize: '10.5px',
                                  fontWeight: '700',
                                  cursor: 'pointer'
                                }}
                              >
                                Open BOM
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div style={{
              padding: '12px 24px',
              borderTop: '1px solid #E2E8F0',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              backgroundColor: '#F8FAFC'
            }}>
              <span style={{ fontSize: '11px', color: '#64748B' }}>
                Showing all <strong>{viewingRepBomsModal.boms.length}</strong> BOM orders raised by <strong>{viewingRepBomsModal.name}</strong>
              </span>
              <button
                onClick={() => setViewingRepBomsModal(null)}
                style={{
                  padding: '6px 14px',
                  borderRadius: '8px',
                  border: '1px solid #CBD5E1',
                  backgroundColor: '#FFFFFF',
                  color: '#475569',
                  fontSize: '12px',
                  fontWeight: '700',
                  cursor: 'pointer'
                }}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
