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
  LayoutDashboard, Wrench, Boxes, Package, FileCheck, ClipboardList, Calculator, CheckCircle, Warehouse, Edit3, GitBranch, CreditCard
} from 'lucide-react';
import { fetchCloudStore } from '../../utils/supabaseDataSync';
import { fetchWithTimeout } from '../../utils/fetchWithTimeout';
import { resolveDocumentUrl } from '../../utils/documentResolver';
import { getMediaFromCache } from '../../utils/otherViewsShared';
import HrKitAnalyticsDashboard from './HrKitAnalyticsDashboard';
import { getBomStageTiming } from './BomOrdersView';

// Canonical BUSINZ KPI Grid Component for all CEO Dashboards
export function CeoKpiGrid({ kpis }) {
  const [hoveredIdx, setHoveredIdx] = useState(null);
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
        const isHovered = hoveredIdx === kIdx && Boolean(kpi.onClick);
        
        return (
          <div 
            key={kIdx}
            onClick={kpi.onClick}
            onMouseEnter={() => setHoveredIdx(kIdx)}
            onMouseLeave={() => setHoveredIdx(null)}
            role={kpi.onClick ? 'button' : undefined}
            tabIndex={kpi.onClick ? 0 : undefined}
            style={{
              backgroundColor: kpi.isSelected ? '#F0FDFA' : (isHovered ? '#F0FDFA' : '#FFFFFF'),
              borderRadius: '16px',
              border: `1px solid ${kpi.isSelected ? '#0E7490' : (isHovered ? '#0E7490' : (kpi.highlightCard ? '#FCA5A5' : '#EAEFEF'))}`,
              padding: '12px 14px',
              display: 'flex',
              flexDirection: 'column',
              gap: '8px',
              boxShadow: kpi.isSelected 
                ? '0 0 0 1px #0E7490, 0 4px 18px rgba(14, 116, 144, 0.12)' 
                : (kpi.highlightCard 
                    ? '0 4px 18px rgba(220, 38, 38, 0.08)' 
                    : '0 4px 18px rgba(15, 23, 42, 0.03)'),
              transform: 'none',
              cursor: kpi.onClick ? 'pointer' : 'default',
              transition: 'background-color 0.15s ease, border-color 0.15s ease',
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
                    color: kpi.isSelected ? '#0E7490' : '#64748B', 
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
                textOverflow: 'ellipsis',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between'
              }}
            >
              <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                <span>{kpi.bottomPrefix}</span>
                <span style={{ color: highlightColor, fontWeight: '800' }}>
                  {kpi.bottomHighlight}
                </span>
              </div>
              {kpi.onClick && (
                <span style={{ color: '#0E7490', fontWeight: '800', fontSize: '10.5px', marginLeft: '6px', flexShrink: 0, display: 'inline-flex', alignItems: 'center', gap: '2px' }}>
                  View →
                </span>
              )}
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
    if (userRole === 'HR') {
      const saved = localStorage.getItem('controlroom_ceo_sub_tab');
      if (saved === 'accounts' || saved === 'finance') return 'kit-analytics';
      return saved || 'kit-analytics';
    }
    const saved = localStorage.getItem('controlroom_ceo_sub_tab');
    if (saved === 'kit-analytics' || saved === 'reports-dashboard' || saved === 'reports' || saved === 'sales' || saved === 'sales-targets') return 'overview';
    return saved || 'overview';
  });

  useEffect(() => {
    const handleSubTabChange = (e) => {
      if (e?.detail?.subTab) {
        let sub = e.detail.subTab;
        if (userRole !== 'HR' && (sub === 'kit-analytics' || sub === 'reports-dashboard' || sub === 'reports' || sub === 'sales' || sub === 'sales-targets')) {
          sub = 'overview';
        }
        setActiveSubTab(sub);
      }
    };
    window.addEventListener('controlroom_ceo_subtab_change', handleSubTabChange);
    const initial = localStorage.getItem('controlroom_ceo_sub_tab');
    if (initial) {
      if (userRole !== 'HR' && (initial === 'kit-analytics' || initial === 'reports-dashboard' || initial === 'reports' || initial === 'sales' || initial === 'sales-targets')) {
        setActiveSubTab('overview');
        localStorage.setItem('controlroom_ceo_sub_tab', 'overview');
      } else {
        setActiveSubTab(initial);
      }
    }
    return () => window.removeEventListener('controlroom_ceo_subtab_change', handleSubTabChange);
  }, [userRole]);

  const [selectedPeriod, setSelectedPeriod] = useState('Today');
  const [personDeptFilter, setPersonDeptFilter] = useState('all');
  const [personSearchQuery, setPersonSearchQuery] = useState('');
  const [activePersonModal, setActivePersonModal] = useState(null);
  const [viewingRepBomsModal, setViewingRepBomsModal] = useState(null);
  const [viewingPiModal, setViewingPiModal] = useState(null);
  const [viewingBomModal, setViewingBomModal] = useState(null);
  const [previewDocModal, setPreviewDocModal] = useState(null);
  const [otcScope, setOtcScope] = useState('ALL'); // 'ALL' = Full Factory Order Pipeline | 'PERIOD' = Filtered by selectedPeriod
  const [activeKpiPopup, setActiveKpiPopup] = useState(null); // 'pi' | 'bom' | 'po' | 'dispatch' | 'billing' | 'accounts' | 'kits'
  const [kpiPopupSearch, setKpiPopupSearch] = useState('');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [hoveredDonutIdx, setHoveredDonutIdx] = useState(null);
  const [hoveredBarIdx, setHoveredBarIdx] = useState(null);
  const [selectedBomLifecycleStage, setSelectedBomLifecycleStage] = useState('ALL'); // Default to ALL factory BOM orders

  // Close KPI Popup on Escape key
  useEffect(() => {
    if (!activeKpiPopup) return;
    const handleEsc = (e) => {
      if (e.key === 'Escape') setActiveKpiPopup(null);
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [activeKpiPopup]);

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
    if (period === 'All' || period === 'All Time') return true;
    const d = parseRecordDate(rec);
    if (!d) {
      return period === 'YTD' || period === 'All';
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

  // Lifecycle-filtered BOM orders for the BOM sub-tab & Order-to-Cash summary (strictly synced to selectedPeriod)
  const displayBomList = useMemo(() => {
    const sourceBoms = bomList;
    if (selectedBomLifecycleStage === 'ALL') return sourceBoms;
    return sourceBoms.filter(b => {
      const st = String(b.status || '').toLowerCase();
      if (selectedBomLifecycleStage === 'STEP 01') {
        return Boolean(b.sourcePiNo || b.piNo || b.piNumber || b.bomConverted || b.source_pi_no || b.sourcePi || b.pi_no);
      }
      if (selectedBomLifecycleStage === 'STEP 02') {
        return Boolean(b.salesConfirmed) || st.includes('confirm') || st.includes('bom');
      }
      if (selectedBomLifecycleStage === 'STEP 03') {
        return b.packingStatus === 'PACKING_VERIFIED' || st.includes('pack');
      }
      if (selectedBomLifecycleStage === 'STEP 04') {
        return Boolean(b.isAccountsDone || b.accountsVerification?.verified);
      }
      if (selectedBomLifecycleStage === 'STEP 05') {
        return Boolean(b.invoiceConfirmed || st.includes('invoice'));
      }
      if (selectedBomLifecycleStage === 'STEP 06') {
        return Boolean(b.fullyCompleted || st.includes('dispatched') || st.includes('completed'));
      }
      return true;
    });
  }, [bomList, selectedBomLifecycleStage]);

  const displayPiList = useMemo(() => {
    return piList;
  }, [piList]);

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
    return userRole === 'HR' ? 'HR Operations' : 'Velmurugan Rathinam';
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
      setCurrentLoggedName(userRole === 'HR' ? 'HR Operations' : 'Velmurugan Rathinam');
    };

    window.addEventListener('storage', handleUserUpdate);
    window.addEventListener('controlroom_storage_update', handleUserUpdate);
    return () => {
      window.removeEventListener('storage', handleUserUpdate);
      window.removeEventListener('controlroom_storage_update', handleUserUpdate);
    };
  }, [userRole]);

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
        fetchWithTimeout('/api/proforma-invoices', { timeout: 6000 })
          .then(r => r.json())
          .then(j => Array.isArray(j?.data) ? j.data : (Array.isArray(j) ? j : []))
          .catch(() => [])
          .then(async (dbPis) => {
            if (Array.isArray(dbPis) && dbPis.length > 0) return dbPis;
            const cloud1 = await fetchCloudStore('sales_pi_store', []).catch(() => []);
            if (Array.isArray(cloud1) && cloud1.length > 0) return cloud1;
            return fetchCloudStore('proforma_invoices', []).catch(() => []);
          })
          .then(remotePis => {
            const map = new Map();
            (remotePis || []).forEach(p => {
              const k = String(p.piNo || p.id || '').trim().toLowerCase();
              if (k) map.set(k, p);
            });
            (localPis || []).forEach(p => {
              const k = String(p.piNo || p.id || '').trim().toLowerCase();
              if (k && !map.has(k)) map.set(k, p);
            });
            return Array.from(map.values());
          }),
        fetchWithTimeout('/api/boms', { timeout: 8000 })
          .then(r => r.json())
          .then(j => Array.isArray(j?.data) ? j.data : (Array.isArray(j) ? j : []))
          .catch(() => [])
          .then(async (dbBoms) => {
            if (Array.isArray(dbBoms) && dbBoms.length > 0) return dbBoms;
            const cloud1 = await fetchCloudStore('bom_orders', []).catch(() => []);
            if (Array.isArray(cloud1) && cloud1.length > 0) return cloud1;
            return fetchCloudStore('bom_store', []).catch(() => []);
          })
          .then(remoteBoms => {
            const map = new Map();
            (remoteBoms || []).forEach(b => {
              const k = String(b.bomCode || b.code || b.id || '').trim().toLowerCase();
              if (k) map.set(k, b);
            });
            (localBoms || []).forEach(b => {
              const k = String(b.bomCode || b.code || b.id || '').trim().toLowerCase();
              if (k && !map.has(k)) map.set(k, b);
            });
            return Array.from(map.values());
          }),
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

  const pendingMdPoValNum = useMemo(() => {
    return pendingMdPOs.reduce((acc, po) => acc + parseAmt(po.amount || po.total), 0);
  }, [pendingMdPOs]);
  const pendingMdPoValFormatted = formatRealCurrency(pendingMdPoValNum);

  const totalPoSpendNum = useMemo(() => {
    return poList.reduce((acc, po) => acc + parseAmt(po.amount || po.total), 0);
  }, [poList]);

  const totalPoSpendCr = (totalPoSpendNum / 10000000).toFixed(2);
  const totalPoSpendFormatted = formatRealCurrency(totalPoSpendNum);

  const todayPoList = useMemo(() => {
    const todayGB = new Date().toLocaleDateString('en-GB'); // 'DD/MM/YYYY'
    const todayISO = new Date().toISOString().slice(0, 10); // 'YYYY-MM-DD'
    return allPoList.filter(po => {
      if (matchesSelectedPeriod(po, 'Today')) return true;
      const rawDate = String(po.date || po.poDate || po.createdAt || po.created_at || '');
      return rawDate.includes(todayGB) || rawDate.includes(todayISO);
    });
  }, [allPoList]);

  const todayPoCount = todayPoList.length;
  const todayPoSpendNum = useMemo(() => {
    return todayPoList.reduce((acc, po) => acc + parseAmt(po.amount || po.total), 0);
  }, [todayPoList]);
  const todayPoSpendFormatted = formatRealCurrency(todayPoSpendNum);

  const todayDraftCount = useMemo(() => {
    return todayPoList.filter(p => {
      const st = String(p.stage || p.status || '').toLowerCase();
      return st.includes('draft') || st.includes('pending') || st.includes('approval');
    }).length;
  }, [todayPoList]);
  const todayApprovedCount = Math.max(0, todayPoCount - todayDraftCount);

  const totalPiPipelineNum = useMemo(() => {
    return piList
      .filter(pi => !pi.cancelled && String(pi.status || '').toLowerCase() !== 'cancelled')
      .reduce((acc, pi) => {
        const amt = parseAmt(pi.grandTotal || pi.amount || pi.total);
        return amt < 1000000000 ? acc + amt : acc;
      }, 0);
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

  // Operational KPIs for Sub-Tabs
  const inactiveLeadsCount = useMemo(() => {
    return leadsList.filter(l => Boolean(l.is_unattended_2h || l.is_unattended_24h || l.is_unattended_48h || ['inactive', 'dropped', 'lost', 'disqualified'].includes(String(l.status || '').toLowerCase()))).length;
  }, [leadsList]);

  const newCustomersCount = useMemo(() => {
    const periodFiltered = customersList.filter(c => matchesSelectedPeriod(c, selectedPeriod));
    return periodFiltered.length > 0 ? periodFiltered.length : customersList.length;
  }, [customersList, matchesSelectedPeriod, selectedPeriod]);

  const activeQuotesCount = useMemo(() => {
    return quotesList.filter(q => !q.cancelled && !['rejected', 'expired', 'lost'].includes(String(q.status || '').toLowerCase())).length;
  }, [quotesList]);

  const completedWorkOrdersCount = useMemo(() => {
    return workOrdersList.filter(w => String(w.status || '').toLowerCase() === 'completed').length;
  }, [workOrdersList]);

  const activeWorkOrdersCount = useMemo(() => {
    return workOrdersList.filter(w => String(w.status || '').toLowerCase() !== 'completed').length;
  }, [workOrdersList]);

  const todayDispatchesCount = useMemo(() => {
    const todayBoms = allBomList.filter(r => matchesSelectedPeriod(r, 'Today') && !r.cancelled && (r.fullyCompleted || String(r.status || '').toLowerCase().includes('dispatched') || String(r.status || '').toLowerCase().includes('completed'))).length;
    const todayChallans = allChallansList.filter(r => matchesSelectedPeriod(r, 'Today')).length;
    const todayDispatches = allDispatchesList.filter(r => matchesSelectedPeriod(r, 'Today')).length;
    return Math.max(todayBoms, todayChallans + todayDispatches);
  }, [allBomList, allChallansList, allDispatchesList]);

  const completedGrnCount = useMemo(() => {
    return grnList.filter(g => {
      const st = String(g.status || '').toUpperCase();
      return st.includes('CLOSED') || st.includes('FULLY') || st.includes('APPROVED') || st.includes('COMPLETED') || g.forceClosePO;
    }).length;
  }, [grnList]);

  const completedGrnPoValNum = useMemo(() => {
    const fromPOs = poList
      .filter(p => {
        const st = String(p.status || p.order_status || '').toUpperCase();
        return st.includes('CLOSED') || st.includes('COMPLETED') || st.includes('INWARDED');
      })
      .reduce((acc, p) => acc + parseAmt(p.amount || p.total), 0);
    const fromGrns = grnList
      .filter(g => {
        const st = String(g.status || '').toUpperCase();
        return st.includes('CLOSED') || st.includes('FULLY') || st.includes('APPROVED') || st.includes('COMPLETED') || g.forceClosePO;
      })
      .reduce((acc, g) => acc + parseAmt(g.totalAmount || g.amount || g.poAmount || g.total || 0), 0);
    return Math.max(fromPOs, fromGrns);
  }, [poList, grnList]);
  const completedGrnPoValFormatted = formatRealCurrency(completedGrnPoValNum);

  const pendingGrnCount = useMemo(() => {
    const openGrns = grnList.filter(g => {
      const st = String(g.status || '').toUpperCase();
      return !st.includes('CLOSED') && !st.includes('FULLY') && !st.includes('APPROVED') && !st.includes('COMPLETED') && !g.forceClosePO;
    }).length;
    const posAwaitingInwarding = poList.filter(p => {
      const st = String(p.status || p.order_status || '').toUpperCase();
      return (st.includes('APPROVED') || st.includes('ISSUED') || st.includes('OPEN') || st.includes('PARTIAL') || st.includes('PROCEED')) && !st.includes('CLOSED');
    }).length;
    return Math.max(openGrns, posAwaitingInwarding > 0 ? posAwaitingInwarding : openGrns);
  }, [grnList, poList]);

  const pendingGrnPoList = useMemo(() => {
    return poList.filter(p => {
      const st = String(p.status || p.order_status || '').toUpperCase();
      return (st.includes('APPROVED') || st.includes('ISSUED') || st.includes('OPEN') || st.includes('PARTIAL') || st.includes('PROCEED')) && !st.includes('CLOSED');
    });
  }, [poList]);

  const pendingGrnPoValNum = useMemo(() => {
    return pendingGrnPoList.reduce((acc, p) => acc + parseAmt(p.amount || p.total), 0);
  }, [pendingGrnPoList]);
  const pendingGrnPoValFormatted = formatRealCurrency(pendingGrnPoValNum);

  // Operational drilldown records for the 6 CEO KPI popup modals
  const dispatchKpiRecords = useMemo(() => {
    const seen = new Set();
    const list = [];
    (dispatchesList || []).forEach(d => {
      const id = d.id || d.orderNo || d.bomCode;
      if (id && !seen.has(id)) {
        seen.add(id);
        list.push({
          id,
          code: d.bomCode || d.orderNo || d.code || id,
          customer: d.customerName || d.customer || '—',
          transporter: d.transporterName || d.transportMode || d.carrier || 'Standard Transport',
          vehicle: d.lrNumber || d.vehicleNumber || d.lrNo || '—',
          date: d.dispatchDate || d.date || d.created_at,
          status: d.status || 'Dispatched',
          value: d.totalAmount || d.amount || 0
        });
      }
    });

    (bomList || []).forEach(b => {
      if (!b || b.cancelled) return;
      const code = b.bomCode || b.code || b.id;
      if (code && !seen.has(code)) {
        const st = String(b.status || '').toLowerCase();
        const isDone = Boolean(b.fullyCompleted || st.includes('completed') || st.includes('dispatched'));
        const isPacked = b.packingStatus === 'PACKING_VERIFIED' || st.includes('packed');
        const isReady = b.invoiceConfirmed || st.includes('loading') || b.isAccountsDone;
        if (isDone || isPacked || isReady || st !== 'draft') {
          seen.add(code);
          list.push({
            id: code,
            code: code,
            customer: b.customerName || b.customer || '—',
            transporter: b.transporterName || b.transportMode || 'Pending Assignment',
            vehicle: b.lrNumber || b.vehicleNumber || '—',
            date: b.dispatchDate || b.date || b.createdAt,
            status: isDone ? 'Dispatched' : (isPacked ? 'Packing Verified' : 'In Dispatch Queue'),
            value: b.grandTotal || b.totalAmount || b.amount || 0
          });
        }
      }
    });
    return list;
  }, [dispatchesList, bomList]);

  const accountsKpiRecords = useMemo(() => {
    const list = [];
    (paymentsList || []).forEach(p => {
      list.push({
        id: p.id || p.receiptNo || p.reference,
        refNo: p.receiptNo || p.reference || p.paymentId || p.id || 'PAY-VOUCHER',
        date: p.paymentDate || p.date || p.created_at,
        customer: p.customerName || p.customer || '—',
        mode: p.paymentMode || p.mode || p.type || 'Bank Transfer',
        amount: Number(p.amount || p.receivedAmount || 0),
        status: p.status || 'Realized'
      });
    });

    (bomList || []).forEach(b => {
      if (b?.accountsVerification?.verified && b.accountsVerification?.amount) {
        list.push({
          id: `bom-acc-${b.bomCode || b.code}`,
          refNo: `BOM-${b.bomCode || b.code}`,
          date: b.accountsVerification?.paymentDate || b.date,
          customer: b.customerName || b.customer || '—',
          mode: b.accountsVerification?.paymentMode || b.paymentTerms || 'Bank Transfer',
          amount: Number(b.accountsVerification?.amount || b.grandTotal || 0),
          status: 'Verified by Accounts'
        });
      }
    });
    return list;
  }, [paymentsList, bomList]);

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
        if (d && d.getMonth() === mIdx && !pi.cancelled && String(pi.status || '').toLowerCase() !== 'cancelled') {
          const amt = parseAmt(pi.grandTotal || pi.amount || pi.total);
          return amt < 1000000000 ? acc + amt : acc;
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

    const targetBoms = bomList;
    const targetPis = piList;
    const targetInvs = invList;
    const targetDispatches = dispatchesList;
    const multiplier = 1;

    const activeBoms = targetBoms.filter(b => b && !b.cancelled && !String(b.status || '').toLowerCase().includes('cancel'));
    const totalBomVal = activeBoms.reduce((acc, b) => acc + parseAmt(b.grandTotal || b.totalAmount || b.amount || b.value || 0), 0) * multiplier;

    const activePis = targetPis.filter(p => !p.cancelled && String(p.status || '').toLowerCase() !== 'cancelled');
    const confirmedPis = activePis.filter(p => {
      const st = String(p.status || '').toLowerCase();
      return st.includes('confirm') || st.includes('bom') || st.includes('convert') || p.bomConverted;
    });
    const totalPiVal = activePis.reduce((acc, p) => {
      const amt = parseAmt(p.grandTotal || p.totalAmount || p.amount || 0);
      return amt < 1000000000 ? acc + amt : acc;
    }, 0) * multiplier;

    // STEP 03: Dispatch Packing
    const packedBoms = activeBoms.filter(b => {
      const st = String(b.status || '').toLowerCase();
      return b.packingStatus === 'PACKING_VERIFIED' || st.includes('packed') || b.isAccountsDone || b.accountsVerification?.verified || b.invoiceConfirmed || st.includes('loading') || st.includes('dispatched') || st.includes('completed') || b.fullyCompleted;
    });
    const pendingPackingBoms = Math.max(0, activeBoms.length - packedBoms.length);
    const packedVal = packedBoms.reduce((acc, b) => acc + parseAmt(b.grandTotal || b.totalAmount || b.amount || b.value || 0), 0) * multiplier;

    // STEP 04: Accounts Verification (Subset of Packed Orders)
    const accountsVerifiedBoms = packedBoms.filter(b => {
      const st = String(b.status || '').toLowerCase();
      return Boolean(b.isAccountsDone || b.accountsVerification?.verified || b.invoiceConfirmed || st.includes('invoice') || st.includes('loading') || st.includes('dispatched') || st.includes('completed') || b.fullyCompleted);
    });
    const pendingAccountsBoms = Math.max(0, packedBoms.length - accountsVerifiedBoms.length);
    const accountsVerifiedVal = accountsVerifiedBoms.reduce((acc, b) => acc + parseAmt(b.grandTotal || b.totalAmount || b.amount || b.value || 0), 0) * multiplier;

    // STEP 05: Billing & Invoicing (Strict Subset of Accounts Verified Orders)
    const invoicedBoms = accountsVerifiedBoms.filter(b => {
      const st = String(b.status || '').toLowerCase();
      return Boolean(b.invoiceConfirmed || b.invoiceNo || st.includes('invoice') || st.includes('loading') || st.includes('dispatched') || st.includes('completed') || b.fullyCompleted);
    });
    const pendingInvoicingBoms = Math.max(0, accountsVerifiedBoms.length - invoicedBoms.length);
    const invoicedVal = invoicedBoms.reduce((acc, b) => acc + parseAmt(b.grandTotal || b.totalAmount || b.amount || b.value || 0), 0) * multiplier;

    // STEP 06: Final Dispatch (Strict Subset of Invoiced Orders)
    const completedDispatchBoms = invoicedBoms.filter(b => {
      const st = String(b.status || '').toLowerCase();
      return Boolean(b.fullyCompleted || st.includes('completed') || st.includes('dispatched'));
    });
    const awaitingLoadBoms = Math.max(0, invoicedBoms.length - completedDispatchBoms.length);
    const dispatchedVal = completedDispatchBoms.reduce((acc, b) => acc + parseAmt(b.grandTotal || b.totalAmount || b.amount || b.value || 0), 0) * multiplier;

    const baseTotal = Math.max(1, activePis.length, activeBoms.length);

    const piKeys = activePis.map(p => String(p.piNo || p.id || '').trim().toLowerCase()).filter(Boolean);
    const bomKeys = activeBoms.map(b => String(b.bomCode || b.code || b.id || '').trim().toLowerCase()).filter(Boolean);
    const packedKeys = packedBoms.map(b => String(b.bomCode || b.code || b.id || '').trim().toLowerCase()).filter(Boolean);
    const accountsKeys = accountsVerifiedBoms.map(b => String(b.bomCode || b.code || b.id || '').trim().toLowerCase()).filter(Boolean);
    const invoicedKeys = invoicedBoms.map(b => String(b.bomCode || b.code || b.id || '').trim().toLowerCase()).filter(Boolean);
    const dispatchedKeys = completedDispatchBoms.map(b => String(b.bomCode || b.code || b.id || '').trim().toLowerCase()).filter(Boolean);

    return [
      {
        step: 'STEP 01',
        stage: 'Proforma Invoice',
        subtitle: 'Sales Commercial PI',
        primaryMetric: `${activePis.length} PIs`,
        value: fmtCompact(totalPiVal),
        valueLabel: 'Pipeline Value',
        statusBadge: `${confirmedPis.length} Confirmed`,
        progressPct: activePis.length > 0 ? Math.min(100, Math.max(18, Math.round((confirmedPis.length / Math.max(1, activePis.length)) * 100))) : 0,
        icon: Receipt,
        color: '#0E7490',
        bg: '#ECFEFF',
        border: '#A5F3FC',
        targetTab: 'Proforma Invoice',
        stageType: 'pi',
        targetKeys: piKeys,
        sourceLabel: 'Proforma Invoice Stage',
        action: 'Open PIs'
      },
      {
        step: 'STEP 02',
        stage: 'BOM',
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
        stageType: 'bom',
        targetKeys: bomKeys,
        sourceLabel: 'BOM Orders Stage',
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
        progressPct: activeBoms.length > 0 ? Math.min(100, Math.round((packedBoms.length / Math.max(1, activeBoms.length)) * 100)) : 0,
        icon: Package,
        color: '#D97706',
        bg: '#FFFBEB',
        border: '#FDE68A',
        targetTab: 'BOM Orders',
        stageType: 'bom',
        targetKeys: packedKeys,
        sourceLabel: 'Dispatch Packing Stage',
        action: 'Packing Queue'
      },
      {
        step: 'STEP 04',
        stage: 'Accounts Verification',
        subtitle: 'Payment & Hard Copy',
        primaryMetric: `${accountsVerifiedBoms.length} Verified`,
        value: fmtCompact(accountsVerifiedVal),
        valueLabel: 'Cleared Value',
        statusBadge: `${pendingAccountsBoms} In Queue`,
        progressPct: activeBoms.length > 0 ? Math.min(100, Math.round((accountsVerifiedBoms.length / Math.max(1, activeBoms.length)) * 100)) : 0,
        icon: ShieldCheck,
        color: '#7C3AED',
        bg: '#F5F3FF',
        border: '#DDD6FE',
        targetTab: 'BOM Orders',
        stageType: 'bom',
        targetKeys: accountsKeys,
        sourceLabel: 'Accounts Verification Stage',
        action: 'Verify Queue'
      },
      {
        step: 'STEP 05',
        stage: 'Billing & Invoice',
        subtitle: '3-Way Match & Stock Lock',
        primaryMetric: `${invoicedBoms.length} Billed`,
        value: fmtCompact(invoicedVal),
        valueLabel: 'GST Invoiced',
        statusBadge: `${pendingInvoicingBoms} Awaiting Billing`,
        progressPct: activeBoms.length > 0 ? Math.min(100, Math.round((invoicedBoms.length / Math.max(1, activeBoms.length)) * 100)) : 0,
        icon: FileCheck,
        color: '#2563EB',
        bg: '#EFF6FF',
        border: '#BFDBFE',
        targetTab: 'BOM Orders',
        stageType: 'bom',
        targetKeys: invoicedKeys,
        sourceLabel: 'Billing & Invoice Stage',
        action: 'Tax Invoices'
      },
      {
        step: 'STEP 06',
        stage: 'Final Dispatch',
        subtitle: 'Vehicle Loading & LR Copy',
        primaryMetric: `${completedDispatchBoms.length} Dispatched`,
        value: fmtCompact(dispatchedVal),
        valueLabel: 'Delivered Value',
        statusBadge: `${awaitingLoadBoms} Ready to Load`,
        progressPct: activeBoms.length > 0 ? Math.min(100, Math.round((completedDispatchBoms.length / Math.max(1, activeBoms.length)) * 100)) : 0,
        icon: Truck,
        color: '#16A34A',
        bg: '#F0FDF4',
        border: '#BBF7D0',
        targetTab: 'BOM Orders',
        stageType: 'bom',
        targetKeys: dispatchedKeys,
        sourceLabel: 'Final Dispatch Stage',
        action: 'Dispatch Log'
      }
    ];
  }, [allPiList, piList, allBomList, bomList, allInvList, invList, allDispatchesList, dispatchesList, otcScope, periodMultiplier, totalPiPipelineNum, totalInvoicedNum]);

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

  // Kits sold summary calculation for HR / CEO dashboard
  const { hrKitsSoldCount, hrKitsOrderValueFormatted } = useMemo(() => {
    let totalSets = 0;
    let totalVal = 0;
    (bomList || []).forEach(b => {
      if (!b || b.cancelled) return;
      const st = String(b.status || '').toLowerCase();
      if (st === 'draft' || st === 'cancelled') return;
      if (b.presetGroups && typeof b.presetGroups === 'object') {
        const grps = Array.isArray(b.presetGroups) ? b.presetGroups : Object.values(b.presetGroups);
        grps.forEach(g => {
          if (!g) return;
          const sCount = parseFloat(g.setCount || g.quantity || 1) || 1;
          const kPrice = parseFloat(g.kitPrice || g.price || 0) || 0;
          const val = parseFloat(g.groupTotal || g.groupSubtotal || (kPrice * sCount)) || (kPrice * sCount);
          totalSets += sCount;
          totalVal += val;
        });
      } else if (b.presetName || b.selectedPreset) {
        const sCount = parseFloat(b.setCount || b.quantity || 1) || 1;
        const val = parseFloat(b.grandTotal || b.presetKitPrice || b.amount || 0) || 0;
        totalSets += sCount;
        totalVal += val;
      }
    });
    const fmt = totalVal >= 10000000 
      ? `₹ ${(totalVal / 10000000).toFixed(2)} Cr` 
      : (totalVal >= 100000 ? `₹ ${(totalVal / 100000).toFixed(2)} L` : `₹ ${Math.round(totalVal).toLocaleString('en-IN')}`);
    return { hrKitsSoldCount: totalSets, hrKitsOrderValueFormatted: fmt };
  }, [bomList]);

  // Operational Dispatch & Fulfillment Bottleneck Statistics (CEO View)
  const dispatchBottleneckStats = useMemo(() => {
    const activeBoms = (bomList || []).filter(b => b && !b.cancelled && !String(b.status || '').toLowerCase().includes('cancel'));
    const now = new Date().getTime();

    let totalAgingDays = 0;
    const stageCounts = {
      step2_confirmed: 0,
      step3_packed: 0,
      step4_accounts: 0,
      step5_invoiced: 0,
      step6_dispatched: 0
    };

    let onTimeCount = 0;
    let dueSoonCount = 0;
    let overdueCount = 0;

    const actionableBlockers = [];

    activeBoms.forEach(b => {
      const st = String(b.status || '').toLowerCase();
      const bDate = parseRecordDate(b) || new Date();
      const days = Math.max(0, Math.floor((now - bDate.getTime()) / (1000 * 60 * 60 * 24)));
      totalAgingDays += days;

      let stageNum = 2;
      if (b.fullyCompleted || st.includes('completed') || st.includes('dispatched')) {
        stageNum = 6;
        stageCounts.step6_dispatched++;
      } else if (b.invoiceConfirmed || st.includes('invoice') || st.includes('billing')) {
        stageNum = 5;
        stageCounts.step5_invoiced++;
      } else if (b.isAccountsDone || b.accountsVerification?.verified || st.includes('accounts')) {
        stageNum = 4;
        stageCounts.step4_accounts++;
      } else if (b.packingStatus === 'PACKING_VERIFIED' || st.includes('pack')) {
        stageNum = 3;
        stageCounts.step3_packed++;
      } else {
        stageNum = 2;
        stageCounts.step2_confirmed++;
      }

      let targetDateMs = b.deliveryDate ? new Date(b.deliveryDate).getTime() : (bDate.getTime() + (5 * 24 * 60 * 60 * 1000));
      if (isNaN(targetDateMs)) targetDateMs = bDate.getTime() + (5 * 24 * 60 * 60 * 1000);
      const diffDays = Math.floor((targetDateMs - now) / (1000 * 60 * 60 * 24));

      if (stageNum === 6) {
        onTimeCount++;
      } else if (diffDays < 0) {
        overdueCount++;
      } else if (diffDays <= 2) {
        dueSoonCount++;
      } else {
        onTimeCount++;
      }

      if (stageNum === 2) {
        actionableBlockers.push({
          bom: b,
          code: b.bomCode || b.id,
          customer: b.customerName || b.customer || 'Customer',
          stage: 'Step 2 · Confirmed',
          blocker: 'Awaiting Packing Checklist & Photo Verification',
          days,
          severity: days > 2 ? 'high' : 'medium',
          targetTab: 'Dispatch'
        });
      } else if (stageNum === 3) {
        actionableBlockers.push({
          bom: b,
          code: b.bomCode || b.id,
          customer: b.customerName || b.customer || 'Customer',
          stage: 'Step 3 · Packed',
          blocker: 'Awaiting Accounts Receipt & Verification',
          days,
          severity: days > 1 ? 'high' : 'medium',
          targetTab: 'Finance & Accounts'
        });
      } else if (stageNum === 4) {
        actionableBlockers.push({
          bom: b,
          code: b.bomCode || b.id,
          customer: b.customerName || b.customer || 'Customer',
          stage: 'Step 4 · Accounts Done',
          blocker: 'Awaiting Tax Invoice Generation & Stock Lock',
          days,
          severity: days > 1 ? 'high' : 'low',
          targetTab: 'Invoice Management'
        });
      } else if (stageNum === 5) {
        actionableBlockers.push({
          bom: b,
          code: b.bomCode || b.id,
          customer: b.customerName || b.customer || 'Customer',
          stage: 'Step 5 · Invoiced',
          blocker: 'Awaiting Vehicle Loading, Transporter & LR Copy',
          days,
          severity: days > 1 ? 'high' : 'medium',
          targetTab: 'Dispatch'
        });
      }
    });

    const avgAgingDays = activeBoms.length > 0 ? (totalAgingDays / activeBoms.length).toFixed(1) : '0';
    const totalCount = activeBoms.length;
    const onTimePct = totalCount > 0 ? Math.round((onTimeCount / totalCount) * 100) : 100;

    return {
      activeCount: totalCount,
      avgAgingDays,
      stageCounts,
      onTimeCount,
      dueSoonCount,
      overdueCount,
      onTimePct,
      actionableBlockers: actionableBlockers.slice(0, 5)
    };
  }, [bomList]);

  // Customer-Wise Order Fulfillment Matrix (CEO View)
  const customerFulfillmentMatrix = useMemo(() => {
    const activeBoms = (bomList || []).filter(b => b && !b.cancelled && !String(b.status || '').toLowerCase().includes('cancel'));
    const customerMap = new Map();

    activeBoms.forEach(b => {
      const custName = String(b.customerName || b.customer || 'Unknown Customer').trim();
      const amt = parseAmt(b.grandTotal || b.totalAmount || b.amount || b.value || 0);
      const st = String(b.status || '').toLowerCase();

      let stageStep = 2;
      let stageLabel = 'Step 2 · Confirmed';
      let stageColor = '#0284C7';
      let stageBg = '#F0F9FF';
      let stageBorder = '#BAE6FD';

      if (b.fullyCompleted || st.includes('completed') || st.includes('dispatched')) {
        stageStep = 6;
        stageLabel = 'Step 6 · Dispatched';
        stageColor = '#16A34A';
        stageBg = '#F0FDF4';
        stageBorder = '#BBF7D0';
      } else if (b.invoiceConfirmed || st.includes('invoice') || st.includes('billing')) {
        stageStep = 5;
        stageLabel = 'Step 5 · Invoiced';
        stageColor = '#2563EB';
        stageBg = '#EFF6FF';
        stageBorder = '#BFDBFE';
      } else if (b.isAccountsDone || b.accountsVerification?.verified || st.includes('accounts')) {
        stageStep = 4;
        stageLabel = 'Step 4 · Accounts Done';
        stageColor = '#7C3AED';
        stageBg = '#F5F3FF';
        stageBorder = '#DDD6FE';
      } else if (b.packingStatus === 'PACKING_VERIFIED' || st.includes('pack')) {
        stageStep = 3;
        stageLabel = 'Step 3 · Packed';
        stageColor = '#D97706';
        stageBg = '#FFFBEB';
        stageBorder = '#FDE68A';
      }

      if (!customerMap.has(custName)) {
        customerMap.set(custName, {
          customerName: custName,
          totalValue: 0,
          ordersCount: 0,
          boms: [],
          maxStageStep: stageStep,
          latestStageLabel: stageLabel,
          stageColor,
          stageBg,
          stageBorder
        });
      }

      const entry = customerMap.get(custName);
      entry.totalValue += amt;
      entry.ordersCount += 1;
      entry.boms.push(b);
      if (stageStep > entry.maxStageStep) {
        entry.maxStageStep = stageStep;
        entry.latestStageLabel = stageLabel;
        entry.stageColor = stageColor;
        entry.stageBg = stageBg;
        entry.stageBorder = stageBorder;
      }
    });

    return Array.from(customerMap.values()).sort((a, b) => b.totalValue - a.totalValue);
  }, [bomList]);

  // 2-Hour Order-to-Dispatch Stopwatch & Bottleneck Audit (CEO Exclusively)
  const confirmedBomsStopwatchAudit = useMemo(() => {
    const activeBoms = (bomList || []).filter(b => {
      if (!b || b.cancelled) return false;
      const st = String(b.status || '').toLowerCase();
      if (st.includes('cancel') || st === 'draft') return false;
      return true;
    });

    const now = Date.now();
    const TARGET_MINUTES = 120; // 2 Hours Target SLA

    let withinSlaCount = 0;
    let approachingSlaCount = 0;
    let breachedSlaCount = 0;

    let totalTatMinutes = 0;
    let tatRecordedCount = 0;

    const stageDurations = {
      step2_to_3: { name: 'Dispatch Packing', totalMins: 0, count: 0 },
      step3_to_4: { name: 'Accounts Verification', totalMins: 0, count: 0 },
      step4_to_5: { name: 'GST Billing / Invoice', totalMins: 0, count: 0 },
      step5_to_6: { name: 'Vehicle Loading & Dispatch', totalMins: 0, count: 0 }
    };

    const formatTimeOnly = (dt) => {
      if (!dt || isNaN(dt.getTime())) return null;
      return dt.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });
    };

    const formatDateShort = (dt) => {
      if (!dt || isNaN(dt.getTime())) return '';
      return dt.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });
    };

    const formatDiff = (mins) => {
      if (mins === null || mins === undefined || isNaN(mins) || mins < 0) return '—';
      if (mins < 60) return `${Math.round(mins)}m`;
      const h = Math.floor(mins / 60);
      const m = Math.round(mins % 60);
      return m > 0 ? `${h}h ${m}m` : `${h}h`;
    };

    const processedOrders = activeBoms.map(b => {
      const st = String(b.status || '').toLowerCase();

      const rawConfirmed = b.salesConfirmedAt || b.confirmedAt || b.date || b.createdAt;
      const confirmedDate = rawConfirmed ? new Date(rawConfirmed) : null;

      const rawPacking = b.packingCompletedAt || b.packedAt || b.packingVerifiedAt || b.accountsVerification?.packedAt || (b.packingStatus === 'PACKING_VERIFIED' ? b.updatedAt : null);
      const packingDate = rawPacking ? new Date(rawPacking) : null;

      const rawAccounts = b.accountsVerifiedAt || b.accountsVerification?.verifiedAt || (b.isAccountsDone ? b.updatedAt : null);
      let accountsDate = null;
      if (rawAccounts) {
        accountsDate = new Date(rawAccounts);
        if (isNaN(accountsDate.getTime()) && typeof rawAccounts === 'string') {
          const p = Date.parse(rawAccounts);
          if (!isNaN(p)) accountsDate = new Date(p);
        }
      }

      const rawInvoice = b.invoiceConfirmedAt || b.invoicedAt || b.stockDeductionDate || (b.invoiceConfirmed ? b.updatedAt : null);
      const invoiceDate = rawInvoice ? new Date(rawInvoice) : null;

      const rawDispatch = b.dispatchedAt || b.vehicleLoading?.loadedAt || (b.fullyCompleted || st.includes('completed') || st.includes('dispatched') ? b.updatedAt : null);
      const dispatchDate = rawDispatch ? new Date(rawDispatch) : null;

      let currentStageNum = 2;
      let currentStageName = 'Step 2 · Confirmed';
      if (dispatchDate || b.fullyCompleted || st.includes('dispatched') || st.includes('completed')) {
        currentStageNum = 6;
        currentStageName = 'Step 6 · Dispatched';
      } else if (invoiceDate || b.invoiceConfirmed || st.includes('invoice')) {
        currentStageNum = 5;
        currentStageName = 'Step 5 · Invoiced';
      } else if (accountsDate || b.isAccountsDone || b.accountsVerification?.verified) {
        currentStageNum = 4;
        currentStageName = 'Step 4 · Accounts Done';
      } else if (packingDate || b.packingStatus === 'PACKING_VERIFIED' || st.includes('pack')) {
        currentStageNum = 3;
        currentStageName = 'Step 3 · Packed';
      }

      const confirmedMs = confirmedDate ? confirmedDate.getTime() : null;
      const packingMs = packingDate ? packingDate.getTime() : null;
      const accountsMs = accountsDate ? accountsDate.getTime() : null;
      const invoiceMs = invoiceDate ? invoiceDate.getTime() : null;
      const dispatchMs = dispatchDate ? dispatchDate.getTime() : null;

      let step2To3Mins = null;
      if (confirmedMs && packingMs && packingMs >= confirmedMs) {
        step2To3Mins = (packingMs - confirmedMs) / 60000;
        stageDurations.step2_to_3.totalMins += step2To3Mins;
        stageDurations.step2_to_3.count++;
      } else if (confirmedMs && currentStageNum === 2) {
        step2To3Mins = Math.max(0, (now - confirmedMs) / 60000);
      }

      let step3To4Mins = null;
      const step3StartMs = packingMs || confirmedMs;
      if (step3StartMs && accountsMs && accountsMs >= step3StartMs) {
        step3To4Mins = (accountsMs - step3StartMs) / 60000;
        stageDurations.step3_to_4.totalMins += step3To4Mins;
        stageDurations.step3_to_4.count++;
      } else if (step3StartMs && currentStageNum === 3) {
        step3To4Mins = Math.max(0, (now - step3StartMs) / 60000);
      }

      let step4To5Mins = null;
      const step4StartMs = accountsMs || packingMs || confirmedMs;
      if (step4StartMs && invoiceMs && invoiceMs >= step4StartMs) {
        step4To5Mins = (invoiceMs - step4StartMs) / 60000;
        stageDurations.step4_to_5.totalMins += step4To5Mins;
        stageDurations.step4_to_5.count++;
      } else if (step4StartMs && currentStageNum === 4) {
        step4To5Mins = Math.max(0, (now - step4StartMs) / 60000);
      }

      let step5To6Mins = null;
      const step5StartMs = invoiceMs || accountsMs || packingMs || confirmedMs;
      if (step5StartMs && dispatchMs && dispatchMs >= step5StartMs) {
        step5To6Mins = (dispatchMs - step5StartMs) / 60000;
        stageDurations.step5_to_6.totalMins += step5To6Mins;
        stageDurations.step5_to_6.count++;
      } else if (step5StartMs && currentStageNum === 5) {
        step5To6Mins = Math.max(0, (now - step5StartMs) / 60000);
      }

      let totalElapsedMins = 0;
      if (confirmedMs) {
        if (currentStageNum === 6 && dispatchMs) {
          totalElapsedMins = Math.max(0, (dispatchMs - confirmedMs) / 60000);
        } else {
          totalElapsedMins = Math.max(0, (now - confirmedMs) / 60000);
        }
        totalTatMinutes += totalElapsedMins;
        tatRecordedCount++;
      }

      let slaStatus = 'on_track';
      if (totalElapsedMins <= TARGET_MINUTES) {
        withinSlaCount++;
        slaStatus = 'on_track';
      } else if (totalElapsedMins <= TARGET_MINUTES + 30) {
        approachingSlaCount++;
        slaStatus = 'approaching';
      } else {
        breachedSlaCount++;
        slaStatus = 'breached';
      }

      const stageMinsList = [
        { name: 'Step 3 Packing', mins: step2To3Mins || 0 },
        { name: 'Step 4 Accounts', mins: step3To4Mins || 0 },
        { name: 'Step 5 Invoicing', mins: step4To5Mins || 0 },
        { name: 'Step 6 Loading', mins: step5To6Mins || 0 }
      ];
      stageMinsList.sort((x, y) => y.mins - x.mins);
      const biggestBottleneck = stageMinsList[0]?.mins > 20 ? stageMinsList[0] : null;

      return {
        bom: b,
        bomCode: b.bomCode || b.id,
        linkedPi: b.sourcePiNo || b.piNo || b.piNumber || null,
        customerName: b.customerName || b.customer || 'Customer',
        orderValue: parseAmt(b.grandTotal || b.totalAmount || b.amount || b.value || 0),
        currentStageNum,
        currentStageName,
        confirmedAtStr: formatTimeOnly(confirmedDate),
        confirmedDateStr: formatDateShort(confirmedDate),
        packingAtStr: formatTimeOnly(packingDate),
        packingDurationStr: formatDiff(step2To3Mins),
        accountsAtStr: formatTimeOnly(accountsDate),
        accountsDurationStr: formatDiff(step3To4Mins),
        invoiceAtStr: formatTimeOnly(invoiceDate),
        invoiceDurationStr: formatDiff(step4To5Mins),
        dispatchAtStr: formatTimeOnly(dispatchDate),
        dispatchDurationStr: formatDiff(step5To6Mins),
        totalElapsedMins,
        totalElapsedStr: formatDiff(totalElapsedMins),
        slaStatus,
        biggestBottleneck,
        isCompleted: currentStageNum === 6
      };
    });

    const avgTatPerDept = [
      {
        dept: 'Packing & Checklist',
        step: 'Step 2 → 3',
        avgMins: stageDurations.step2_to_3.count > 0 ? Math.round(stageDurations.step2_to_3.totalMins / stageDurations.step2_to_3.count) : 0,
        targetMins: 30,
        color: '#D97706',
        bg: '#FFFBEB',
        border: '#FDE68A'
      },
      {
        dept: 'Accounts Verification',
        step: 'Step 3 → 4',
        avgMins: stageDurations.step3_to_4.count > 0 ? Math.round(stageDurations.step3_to_4.totalMins / stageDurations.step3_to_4.count) : 0,
        targetMins: 30,
        color: '#7C3AED',
        bg: '#F5F3FF',
        border: '#DDD6FE'
      },
      {
        dept: 'Tax Invoicing',
        step: 'Step 4 → 5',
        avgMins: stageDurations.step4_to_5.count > 0 ? Math.round(stageDurations.step4_to_5.totalMins / stageDurations.step4_to_5.count) : 0,
        targetMins: 30,
        color: '#2563EB',
        bg: '#EFF6FF',
        border: '#BFDBFE'
      },
      {
        dept: 'Vehicle Loading',
        step: 'Step 5 → 6',
        avgMins: stageDurations.step5_to_6.count > 0 ? Math.round(stageDurations.step5_to_6.totalMins / stageDurations.step5_to_6.count) : 0,
        targetMins: 30,
        color: '#16A34A',
        bg: '#F0FDF4',
        border: '#BBF7D0'
      }
    ];

    const sortedDepts = [...avgTatPerDept].sort((a, b) => b.avgMins - a.avgMins);
    const primaryBottleneckDept = sortedDepts[0]?.avgMins > 0 ? sortedDepts[0] : null;

    const totalOrdersCount = processedOrders.length;
    const overallCompliancePct = totalOrdersCount > 0 ? Math.round((withinSlaCount / totalOrdersCount) * 100) : 100;
    const avgTotalTatMins = tatRecordedCount > 0 ? Math.round(totalTatMinutes / tatRecordedCount) : 0;

    return {
      totalOrdersCount,
      withinSlaCount,
      approachingSlaCount,
      breachedSlaCount,
      overallCompliancePct,
      avgTotalTatMins,
      avgTotalTatStr: formatDiff(avgTotalTatMins),
      avgTatPerDept,
      primaryBottleneckDept,
      processedOrders
    };
  }, [bomList]);

  // Date range calculator for period filtering navigation
  const getPeriodDateRange = (period) => {
    const now = new Date();
    const todayStr = now.toISOString().slice(0, 10);
    if (period === 'Today') {
      return { start: todayStr, end: todayStr };
    }
    if (period === 'This Week') {
      const d = new Date(now);
      const day = d.getDay();
      const diff = day === 0 ? 6 : day - 1;
      d.setDate(d.getDate() - diff);
      return { start: d.toISOString().slice(0, 10), end: todayStr };
    }
    if (period === 'MTD' || period === 'This Month') {
      const start = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
      return { start, end: todayStr };
    }
    if (period === 'Q2 FY27') {
      return { start: '2026-07-01', end: '2026-09-30' };
    }
    if (period === 'YTD') {
      return { start: `${now.getFullYear()}-01-01`, end: todayStr };
    }
    return { start: '', end: '' };
  };

  const handleNavigateWithPiFilter = () => {
    const { start, end } = getPeriodDateRange(selectedPeriod);
    const targetKeys = (piList || []).map(p => String(p.piNo || p.id || '').trim().toLowerCase()).filter(Boolean);
    try {
      sessionStorage.setItem('controlroom_pi_initial_date_filter', JSON.stringify({ 
        start, 
        end, 
        targetKeys,
        periodLabel: selectedPeriod,
        count: targetKeys.length
      }));
    } catch (_) {}
    window.dispatchEvent(new CustomEvent('controlroom_pi_filter_date', { 
      detail: { 
        startDate: start, 
        endDate: end, 
        targetKeys,
        periodLabel: selectedPeriod,
        count: targetKeys.length
      } 
    }));
    if (onNavigateTab) onNavigateTab('Proforma Invoice');
  };

  const handleNavigateWithBomFilter = () => {
    const { start, end } = getPeriodDateRange(selectedPeriod);
    const targetKeys = (bomList || []).map(b => String(b.bomCode || b.code || b.id || '').trim().toLowerCase()).filter(Boolean);
    try {
      sessionStorage.setItem('controlroom_bom_initial_date_filter', JSON.stringify({ 
        start, 
        end, 
        targetKeys,
        periodLabel: selectedPeriod,
        count: targetKeys.length
      }));
    } catch (_) {}
    window.dispatchEvent(new CustomEvent('controlroom_bom_filter_date', { 
      detail: { 
        startDate: start, 
        endDate: end, 
        targetKeys,
        periodLabel: selectedPeriod,
        count: targetKeys.length
      } 
    }));
    if (onNavigateTab) onNavigateTab('BOM Orders');
  };

  const handleNavigateWithPoFilter = (period = selectedPeriod, initialTab = 'All') => {
    const { start, end } = getPeriodDateRange(period);
    const targetPOs = period === 'Today' ? todayPoList : (initialTab === 'Draft' ? pendingMdPOs : poList);
    const targetKeys = (targetPOs || []).map(p => String(p.poNumber || p.id || '').trim().toLowerCase()).filter(Boolean);
    try {
      sessionStorage.setItem('controlroom_po_initial_date_filter', JSON.stringify({ 
        start, 
        end, 
        targetKeys,
        periodLabel: period,
        count: targetKeys.length
      }));
    } catch (_) {}
    window.dispatchEvent(new CustomEvent('controlroom_po_filter_date', { 
      detail: { 
        startDate: start, 
        endDate: end, 
        targetKeys,
        periodLabel: period,
        count: targetKeys.length
      } 
    }));
    if (onNavigateTab) onNavigateTab('Purchase Orders', null, initialTab);
  };

  const handleNavigateFunnelStage = (stage) => {
    if (!stage) return;
    const { start, end } = getPeriodDateRange(selectedPeriod);
    const targetKeys = stage.targetKeys || [];
    const periodLabel = selectedPeriod;
    const sourceLabel = stage.sourceLabel || stage.stage || 'Order-to-Cash';

    if (stage.stageType === 'pi') {
      try {
        sessionStorage.setItem('controlroom_pi_initial_date_filter', JSON.stringify({
          start,
          end,
          targetKeys,
          periodLabel,
          sourceLabel,
          count: targetKeys.length
        }));
      } catch (_) {}
      window.dispatchEvent(new CustomEvent('controlroom_pi_filter_date', {
        detail: {
          startDate: start,
          endDate: end,
          targetKeys,
          periodLabel,
          sourceLabel,
          count: targetKeys.length
        }
      }));
      if (onNavigateTab) onNavigateTab(stage.targetTab || 'Proforma Invoice');
    } else {
      try {
        sessionStorage.setItem('controlroom_bom_initial_date_filter', JSON.stringify({
          start,
          end,
          targetKeys,
          periodLabel,
          sourceLabel,
          count: targetKeys.length
        }));
      } catch (_) {}
      window.dispatchEvent(new CustomEvent('controlroom_bom_filter_date', {
        detail: {
          startDate: start,
          endDate: end,
          targetKeys,
          periodLabel,
          sourceLabel,
          count: targetKeys.length
        }
      }));
      if (onNavigateTab) onNavigateTab(stage.targetTab || 'BOM Orders');
    }
  };

  const handleOpenFilteredFullPage = () => {
    const { start, end } = getPeriodDateRange(selectedPeriod);
    if (activeKpiPopup === 'pi') {
      try {
        sessionStorage.setItem('controlroom_pi_initial_date_filter', JSON.stringify({ start, end }));
      } catch (_) {}
      window.dispatchEvent(new CustomEvent('controlroom_pi_filter_date', { detail: { startDate: start, endDate: end } }));
      setActiveKpiPopup(null);
      if (onNavigateTab) onNavigateTab('Proforma Invoice');
    } else if (activeKpiPopup === 'bom' || activeKpiPopup === 'kits') {
      try {
        sessionStorage.setItem('controlroom_bom_initial_date_filter', JSON.stringify({ start, end }));
      } catch (_) {}
      window.dispatchEvent(new CustomEvent('controlroom_bom_filter_date', { detail: { startDate: start, endDate: end } }));
      setActiveKpiPopup(null);
      if (onNavigateTab) onNavigateTab('BOM Orders');
    } else if (activeKpiPopup === 'po') {
      setActiveKpiPopup(null);
      if (onNavigateTab) onNavigateTab('Purchase Orders', null, pendingMdPOs.length > 0 ? 'WAITING FOR APPROVAL' : undefined);
    } else if (activeKpiPopup === 'billing') {
      setActiveKpiPopup(null);
      if (onNavigateTab) onNavigateTab('Invoice Management');
    } else if (activeKpiPopup === 'dispatch') {
      setActiveKpiPopup(null);
      if (onNavigateTab) onNavigateTab('Delivery Challans');
    }
  };

  // Configuration for 6 CEO KPI Popup Modals
  const kpiModalConfig = useMemo(() => {
    switch (activeKpiPopup) {
      case 'pi':
        return {
          title: 'PROFORMA INVOICES (PI)',
          subtitle: `Commercial proforma invoices and deal pipeline (${selectedPeriod})`,
          badge: `${piList.length} Invoices`,
          valueLabel: 'Pipeline Value',
          value: totalPiPipelineFormatted,
          themeColor: '#0E7490',
          themeBg: '#ECFEFF',
          icon: Receipt,
          columns: ['#', 'PI NO.', 'Date', 'Customer Name', 'Sales Person', 'Total Value', 'Status', 'Action'],
          targetTab: 'Proforma Invoice',
          targetTabLabel: 'Proforma Invoices'
        };
      case 'bom':
        return {
          title: 'BOM & PRODUCTION ORDERS',
          subtitle: `Active Bill of Materials & manufacturing orders (${selectedPeriod})`,
          badge: `${bomList.length} Orders`,
          valueLabel: 'Order Book Value',
          value: totalBomOrderValueFormatted,
          themeColor: '#0284C7',
          themeBg: '#F0F9FF',
          icon: Factory,
          columns: ['#', 'BOM Code', 'Date', 'Customer Name', 'Product / Structure', 'Order Value', 'Status', 'Action'],
          targetTab: 'BOM Orders',
          targetTabLabel: 'BOM Orders'
        };
      case 'po':
        return {
          title: 'PURCHASE ORDERS (PO)',
          subtitle: `Procurement orders & vendor spend authorizations (${selectedPeriod})`,
          badge: `${poList.length} POs`,
          valueLabel: 'Authorized Spend',
          value: totalPoSpendFormatted,
          themeColor: '#2563EB',
          themeBg: '#EFF6FF',
          icon: ShoppingCart,
          columns: ['#', 'PO Number', 'Date', 'Vendor Name', 'Spend Amount', 'Approval Status', 'Action'],
          targetTab: 'Purchase Orders',
          targetTabLabel: 'Purchase Orders'
        };
      case 'dispatch':
        return {
          title: 'DISPATCH & LOGISTICS',
          subtitle: `Completed final deliveries and active packing queue (${selectedPeriod})`,
          badge: `${completedDispatchesCount} Dispatched`,
          valueLabel: 'Packing Queue',
          value: `${pendingDispatchQueueCount} Orders`,
          themeColor: '#059669',
          themeBg: '#ECFDF5',
          icon: Truck,
          columns: ['#', 'Order / BOM Code', 'Date', 'Customer Name', 'Transporter / Carrier', 'LR / Vehicle No.', 'Status', 'Action'],
          targetTab: 'Delivery Challans',
          targetTabLabel: 'Delivery Challans'
        };
      case 'billing':
        return {
          title: 'BILLING & TAX INVOICES',
          subtitle: `Official GST tax invoices issued and billed (${selectedPeriod})`,
          badge: `${invList.length} Invoices`,
          valueLabel: 'Total GST Billed',
          value: totalRevenueFormatted,
          themeColor: '#9333EA',
          themeBg: '#FAF5FF',
          icon: FileCheck,
          columns: ['#', 'Invoice No.', 'Date', 'Customer Name', 'Billed Value', 'Tax Status', 'Action'],
          targetTab: 'Invoice Management',
          targetTabLabel: 'Invoices'
        };
      case 'accounts':
        return {
          title: 'ACCOUNTS & CASH COLLECTIONS',
          subtitle: `Customer payments realized and verified payment receipts (${selectedPeriod})`,
          badge: `${accountsKpiRecords.length} Receipts`,
          valueLabel: 'Total Realized',
          value: totalCollectedFormatted,
          themeColor: '#16A34A',
          themeBg: '#F0FDF4',
          icon: Wallet,
          columns: ['#', 'Ref / Receipt No.', 'Date', 'Customer Name', 'Payment Mode', 'Amount Received', 'Status', 'Action'],
          targetTab: 'Invoice Management',
          targetTabLabel: 'Accounts'
        };
      case 'kits':
        return {
          title: 'MMS KITS SOLD & ORDERS',
          subtitle: `MMS kit sales, presets, and order book (${selectedPeriod})`,
          badge: `${hrKitsSoldCount} Kits Sold`,
          valueLabel: 'Kit Order Book',
          value: hrKitsOrderValueFormatted,
          themeColor: '#0E7490',
          themeBg: '#ECFEFF',
          icon: Boxes,
          columns: ['#', 'BOM Code', 'Date', 'Customer Name', 'Kit Description', 'Order Value', 'Status', 'Action'],
          targetTab: 'BOM Orders',
          targetTabLabel: 'BOM Orders'
        };
      default:
        return null;
    }
  }, [activeKpiPopup, selectedPeriod, piList.length, totalPiPipelineFormatted, bomList.length, totalBomOrderValueFormatted, poList.length, totalPoSpendFormatted, completedDispatchesCount, pendingDispatchQueueCount, invList.length, totalRevenueFormatted, accountsKpiRecords.length, totalCollectedFormatted, hrKitsSoldCount, hrKitsOrderValueFormatted]);

  // Data rows for Active KPI Popup Modal with search filtering
  const kpiModalRows = useMemo(() => {
    if (!activeKpiPopup) return [];
    const q = (kpiPopupSearch || '').toLowerCase().trim();

    if (activeKpiPopup === 'pi') {
      return (piList || []).filter(pi => {
        if (!q) return true;
        return (
          (pi.piNo || '').toLowerCase().includes(q) ||
          (pi.customerName || '').toLowerCase().includes(q) ||
          (pi.salesPerson || '').toLowerCase().includes(q) ||
          (pi.status || '').toLowerCase().includes(q)
        );
      }).map((pi, idx) => ({
        id: pi.piNo || idx,
        rawRecord: pi,
        col1: pi.piNo || '—',
        col1Style: { color: '#0E7490', fontWeight: '800' },
        col2: pi.piDate || pi.date || '—',
        col3: pi.customerName || '—',
        col4: pi.salesPerson || 'Sales Team',
        col5: formatRealCurrency(pi.totalAmount || pi.grandTotal || pi.amount || 0),
        col5Style: { fontWeight: '800', textAlign: 'right', color: '#0F172A' },
        status: pi.status || 'Active',
        statusType: String(pi.status || '').toLowerCase().includes('confirm') ? 'success' : (String(pi.status || '').toLowerCase().includes('cancel') ? 'danger' : 'info')
      }));
    }

    if (activeKpiPopup === 'bom') {
      return (bomList || []).filter(b => {
        if (!q) return true;
        return (
          (b.bomCode || b.code || '').toLowerCase().includes(q) ||
          (b.customerName || b.customer || '').toLowerCase().includes(q) ||
          (b.productName || b.structureType || '').toLowerCase().includes(q) ||
          (b.status || '').toLowerCase().includes(q)
        );
      }).map((b, idx) => ({
        id: b.bomCode || b.code || idx,
        rawRecord: b,
        col1: b.bomCode || b.code || `BOM-${idx + 1}`,
        col1Style: { color: '#0284C7', fontWeight: '800' },
        col2: b.date || b.createdAt ? new Date(b.date || b.createdAt).toLocaleDateString('en-GB') : '—',
        col3: b.customerName || b.customer || '—',
        col4: b.productName || b.structureType || (b.systemCapacity ? `${b.systemCapacity} kW` : 'Solar Kit'),
        col5: formatRealCurrency(b.grandTotal || b.totalAmount || b.amount || 0),
        col5Style: { fontWeight: '800', textAlign: 'right', color: '#0F172A' },
        status: b.packingStatus === 'PACKING_VERIFIED' ? 'Packing Verified' : (b.status || 'Confirmed'),
        statusType: b.packingStatus === 'PACKING_VERIFIED' ? 'success' : (String(b.status || '').toLowerCase().includes('draft') ? 'warning' : 'info')
      }));
    }

    if (activeKpiPopup === 'po') {
      return (poList || []).filter(po => {
        if (!q) return true;
        return (
          (po.po_number || po.poNumber || '').toLowerCase().includes(q) ||
          (po.vendor_name || po.vendorName || '').toLowerCase().includes(q) ||
          (po.status || '').toLowerCase().includes(q)
        );
      }).map((po, idx) => {
        const isPending = String(po.status || '').toLowerCase().includes('pending') || (!po.status && !po.is_approved);
        return {
          id: po.po_number || po.poNumber || idx,
          rawRecord: po,
          col1: po.po_number || po.poNumber || `PO-${idx + 1}`,
          col1Style: { color: '#2563EB', fontWeight: '800' },
          col2: po.date || po.created_time || '—',
          col3: po.vendor_name || po.vendorName || '—',
          col4: '',
          col5: formatRealCurrency(po.total || po.amount || 0),
          col5Style: { fontWeight: '800', textAlign: 'right', color: '#0F172A' },
          status: isPending ? 'Pending MD Approval' : (po.status || 'Approved'),
          statusType: isPending ? 'warning' : 'success'
        };
      });
    }

    if (activeKpiPopup === 'dispatch') {
      return dispatchKpiRecords.filter(d => {
        if (!q) return true;
        return (
          (d.code || '').toLowerCase().includes(q) ||
          (d.customer || '').toLowerCase().includes(q) ||
          (d.transporter || '').toLowerCase().includes(q) ||
          (d.vehicle || '').toLowerCase().includes(q) ||
          (d.status || '').toLowerCase().includes(q)
        );
      }).map((d, idx) => ({
        id: d.id || idx,
        rawRecord: d,
        col1: d.code,
        col1Style: { color: '#059669', fontWeight: '800' },
        col2: d.date ? (typeof d.date === 'string' && d.date.includes('.') ? d.date : new Date(d.date).toLocaleDateString('en-GB')) : '—',
        col3: d.customer,
        col4: d.transporter,
        col5: d.vehicle,
        col5Style: { fontWeight: '600', color: '#475569' },
        status: d.status,
        statusType: d.status === 'Dispatched' ? 'success' : (d.status === 'Packing Verified' ? 'info' : 'warning')
      }));
    }

    if (activeKpiPopup === 'billing') {
      return (invList || []).filter(inv => {
        if (!q) return true;
        return (
          (inv.invNo || inv.invoice_number || '').toLowerCase().includes(q) ||
          (inv.customerName || inv.customer || '').toLowerCase().includes(q) ||
          (inv.status || '').toLowerCase().includes(q)
        );
      }).map((inv, idx) => ({
        id: inv.invNo || inv.invoice_number || idx,
        rawRecord: inv,
        col1: inv.invNo || inv.invoice_number || `INV-${idx + 1}`,
        col1Style: { color: '#9333EA', fontWeight: '800' },
        col2: inv.invDate || inv.date || '—',
        col3: inv.customerName || inv.customer || '—',
        col4: inv.salesPerson || 'Accounts Billing',
        col5: formatRealCurrency(inv.totalAmount || inv.grandTotal || inv.amount || 0),
        col5Style: { fontWeight: '800', textAlign: 'right', color: '#0F172A' },
        status: inv.status || 'Billed / Confirmed',
        statusType: 'success'
      }));
    }

    if (activeKpiPopup === 'accounts') {
      return accountsKpiRecords.filter(p => {
        if (!q) return true;
        return (
          (p.refNo || '').toLowerCase().includes(q) ||
          (p.customer || '').toLowerCase().includes(q) ||
          (p.mode || '').toLowerCase().includes(q) ||
          (p.status || '').toLowerCase().includes(q)
        );
      }).map((p, idx) => ({
        id: p.id || idx,
        rawRecord: p,
        col1: p.refNo,
        col1Style: { color: '#16A34A', fontWeight: '800' },
        col2: p.date ? (typeof p.date === 'string' && p.date.includes('.') ? p.date : new Date(p.date).toLocaleDateString('en-GB')) : '—',
        col3: p.customer,
        col4: p.mode,
        col5: formatRealCurrency(p.amount),
        col5Style: { fontWeight: '800', textAlign: 'right', color: '#16A34A' },
        status: p.status,
        statusType: 'success'
      }));
    }

    if (activeKpiPopup === 'kits') {
      return (bomList || []).filter(b => !b.cancelled).filter(b => {
        if (!q) return true;
        return (
          (b.bomCode || b.code || '').toLowerCase().includes(q) ||
          (b.customerName || b.customer || '').toLowerCase().includes(q) ||
          (b.productName || b.structureType || '').toLowerCase().includes(q)
        );
      }).map((b, idx) => ({
        id: b.bomCode || b.code || idx,
        rawRecord: b,
        col1: b.bomCode || b.code || `KIT-${idx + 1}`,
        col1Style: { color: '#0E7490', fontWeight: '800' },
        col2: b.date || b.createdAt ? new Date(b.date || b.createdAt).toLocaleDateString('en-GB') : '—',
        col3: b.customerName || b.customer || '—',
        col4: b.productName || b.structureType || `${b.systemCapacity || '10'} kW MMS Kit`,
        col5: formatRealCurrency(b.grandTotal || b.totalAmount || b.amount || 0),
        col5Style: { fontWeight: '800', textAlign: 'right', color: '#0F172A' },
        status: b.status || 'Active',
        statusType: 'info'
      }));
    }

    return [];
  }, [activeKpiPopup, kpiPopupSearch, piList, bomList, poList, invList, dispatchKpiRecords, accountsKpiRecords]);

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
                {userRole === 'HR' ? 'HR OPERATIONS & KIT COMMAND' : (userRole === 'MD' || userRole === 'Managing Director' ? 'MD COMMAND CENTER' : 'CEO & MD DASHBOARD')}
              </span>
            </div>
            <p style={{ fontSize: '12px', color: '#64748B', margin: '3px 0 0 0', fontWeight: '500' }}>
              {userRole === 'HR'
                ? 'Operations & Kit Analytics Center • Real-time enterprise tracking for MMS Kits Sold, Component Separation, BOM, Sales & Logistics.'
                : 'Executive Leadership Command Center • Real-time enterprise overview across Sales, Purchase, Procurement, Accounts & Person-Wise Performance.'}
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
            {['Today', 'This Week', 'MTD', 'Q2 FY27', 'YTD', 'All'].map((period) => (
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

      {/* Dynamic Sub-Tab Switcher Pills */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '6px',
        overflowX: 'auto',
        padding: '2px 0 6px 0',
        scrollbarWidth: 'none',
        msOverflowStyle: 'none'
      }}>
        {[
          ...(userRole === 'HR' ? [
            { id: 'kit-analytics', label: 'Kit & Materials Analytics', icon: Boxes },
            { id: 'overview', label: 'Operations Overview', icon: LayoutDashboard }
          ] : [
            { id: 'overview', label: 'Company Overview', icon: LayoutDashboard }
          ]),
          { id: 'crm-dashboard', label: 'Sales', icon: Users },
          { id: 'bom', label: 'Dispatch', icon: Truck },
          { id: 'procurement', label: 'Procurement', icon: ShoppingCart },
          { id: 'inventory-dashboard', label: 'Inventory', icon: Warehouse },
          { id: 'production', label: 'Production', icon: Factory },
          ...(userRole !== 'HR' ? [
            { id: 'accounts', label: 'Accounts & Finance', icon: Wallet }
          ] : [])
        ].map(tab => {
          const isActive = (tab.id === 'overview' && (activeSubTab === 'overview' || activeSubTab === 'performance' || activeSubTab === 'action-center' || activeSubTab === 'alerts')) ||
            (tab.id === 'accounts' && (activeSubTab === 'accounts' || activeSubTab === 'finance')) ||
            (tab.id === 'bom' && (activeSubTab === 'bom' || activeSubTab === 'bom-workflow')) ||
            (tab.id === 'dispatch' && activeSubTab === 'dispatch') ||
            (tab.id === 'production' && activeSubTab === 'production') ||
            (tab.id === 'inventory-dashboard' && (activeSubTab === 'inventory-dashboard' || activeSubTab === 'inventory')) ||
            activeSubTab === tab.id;
          const TabIcon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => {
                setActiveSubTab(tab.id);
                localStorage.setItem('controlroom_ceo_sub_tab', tab.id);
              }}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '7px 14px',
                borderRadius: '20px',
                border: isActive ? '1.5px solid #0E7490' : '1px solid #E2E8F0',
                backgroundColor: isActive ? '#0E7490' : '#FFFFFF',
                color: isActive ? '#FFFFFF' : '#475569',
                fontSize: '11.5px',
                fontWeight: isActive ? '800' : '600',
                cursor: 'pointer',
                whiteSpace: 'nowrap',
                boxShadow: isActive ? '0 2px 8px rgba(14, 116, 144, 0.25)' : '0 1px 2px rgba(0,0,0,0.03)',
                transition: 'all 0.15s ease'
              }}
            >
              {TabIcon && <TabIcon size={13} color={isActive ? '#FFFFFF' : '#64748B'} />}
              <span>{tab.label}</span>
            </button>
          );
        })}
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
              onClick: handleNavigateWithPiFilter
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
              onClick: handleNavigateWithBomFilter
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
              onClick: () => onNavigateTab && onNavigateTab('Purchase Orders', null, pendingMdPOs.length > 0 ? 'WAITING FOR APPROVAL' : undefined)
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
              onClick: () => onNavigateTab && onNavigateTab('Invoice Management')
            },
            ...(userRole === 'HR' ? [
              {
                title: 'MMS KITS SOLD',
                value: `${hrKitsSoldCount} Kits Sold`,
                trend: `${bomList.filter(b => b && !b.cancelled && String(b.status || '').toLowerCase() !== 'draft').length} Orders`,
                trendUp: hrKitsSoldCount > 0,
                icon: Boxes,
                iconColor: '#0E7490',
                iconBg: '#ECFEFF',
                bottomPrefix: 'Kit order book ',
                bottomHighlight: hrKitsOrderValueFormatted,
                onClick: handleNavigateWithBomFilter
              }
            ] : [])
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
                    PO Approval <ArrowRight size={12} />
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

          {/* Sales Representatives Performance & Pipeline Contribution */}
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

        </div>
      )}

      {/* ======================================================== */}
      {/* KIT & MATERIALS ANALYTICS (HR & OPERATIONS)             */}
      {/* ======================================================== */}
      {activeSubTab === 'kit-analytics' && (
        <HrKitAnalyticsDashboard 
          allBomList={allBomList}
          selectedPeriod={selectedPeriod}
          onPeriodChange={setSelectedPeriod}
          matchesSelectedPeriod={matchesSelectedPeriod}
        />
      )}

      {/* ======================================================== */}
      {/* CATEGORY 2: CRM & LEADS DASHBOARD                        */}
      {/* ======================================================== */}
      {activeSubTab === 'crm-dashboard' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          {/* Category 2 Top KPIs (BUSINZ DESIGN SYSTEM) */}
          <CeoKpiGrid kpis={[
            {
              title: 'TOTAL LEADS',
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
              title: 'INACTIVE LEADS',
              value: `${inactiveLeadsCount} Leads`,
              trend: inactiveLeadsCount > 0 ? `${inactiveLeadsCount} Inactive` : 'All Active',
              trendUp: inactiveLeadsCount === 0,
              highlightCard: inactiveLeadsCount > 0,
              icon: Clock,
              iconColor: inactiveLeadsCount > 0 ? '#EA580C' : '#16A34A',
              iconBg: inactiveLeadsCount > 0 ? '#FFF7ED' : '#F0FDF4',
              bottomPrefix: 'Pipeline status ',
              bottomHighlight: inactiveLeadsCount > 0 ? 'Unattended / Inactive Stage' : 'All Leads Active',
              onClick: () => onNavigateTab && onNavigateTab('Leads')
            },
            {
              title: 'NEW CUSTOMERS',
              value: `${newCustomersCount} Accounts`,
              trend: `${newCustomersCount} New`,
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
              value: `${activeQuotesCount} Quotes`,
              trend: activeQuotesCount > 0 ? `${activeQuotesCount} Active` : '0 Quotes',
              trendUp: activeQuotesCount > 0,
              icon: FileText,
              iconColor: '#16A34A',
              iconBg: '#F0FDF4',
              bottomPrefix: 'Commercial stage ',
              bottomHighlight: 'In Follow-up',
              onClick: () => onNavigateTab && onNavigateTab('Quotations')
            }
          ]} />

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
          
          {/* Procurement Top Ribbon (BUSINZ DESIGN SYSTEM - DISPATCH LIFECYCLE PARITY) */}
          <CeoKpiGrid kpis={[
            {
              title: 'TOTAL POS TODAY',
              value: `${todayPoCount} Raised Today`,
              trend: todayPoCount > 0 ? `${todayDraftCount} Pending · ${todayApprovedCount} Active` : '0 Today',
              trendUp: todayPoCount > 0,
              icon: Calendar,
              iconColor: '#0E7490',
              iconBg: '#ECFEFF',
              bottomPrefix: "Today's PO spend ",
              bottomHighlight: todayPoSpendFormatted,
              onClick: () => handleNavigateWithPoFilter('Today', 'All')
            },
            {
              title: 'TOTAL PO SPEND HANDLED',
              value: `₹ ${totalPoSpendCr} Cr`,
              trend: `${poList.length} Active POs`,
              trendUp: poList.length > 0,
              icon: ShoppingCart,
              iconColor: '#2563EB',
              iconBg: '#EFF6FF',
              bottomPrefix: 'Spend authorized ',
              bottomHighlight: totalPoSpendFormatted,
              onClick: () => handleNavigateWithPoFilter(selectedPeriod, 'All')
            },
            {
              title: 'PENDING MD APPROVALS',
              value: `${pendingMdPOs.length} Awaiting MD`,
              trend: pendingMdPOs.length > 0 ? `${pendingMdPOs.length} In Queue` : 'All Approved',
              trendUp: pendingMdPOs.length === 0,
              highlightCard: pendingMdPOs.length > 0,
              icon: AlertCircle,
              iconColor: pendingMdPOs.length > 0 ? '#DC2626' : '#16A34A',
              iconBg: pendingMdPOs.length > 0 ? '#FEF2F2' : '#F0FDF4',
              bottomPrefix: 'Value pending ',
              bottomHighlight: pendingMdPOs.length > 0 ? `${pendingMdPoValFormatted} Awaiting CEO / MD` : 'Fully Authorized (₹ 0)',
              onClick: () => handleNavigateWithPoFilter(selectedPeriod, 'Draft')
            },
            {
              title: 'PENDING GRN',
              value: `${pendingGrnCount} Inward Queue`,
              trend: pendingGrnCount > 0 ? `${pendingGrnCount} In Transit` : 'All Inwarded',
              trendUp: pendingGrnCount === 0,
              highlightCard: pendingGrnCount > 0,
              icon: Package,
              iconColor: pendingGrnCount > 0 ? '#D97706' : '#16A34A',
              iconBg: pendingGrnCount > 0 ? '#FFFBEB' : '#F0FDF4',
              bottomPrefix: 'Pending inward ',
              bottomHighlight: pendingGrnCount > 0 ? `${pendingGrnPoValFormatted} Awaiting Delivery` : 'All Inwarded (₹ 0)',
              onClick: () => onNavigateTab && onNavigateTab('Goods Receipt Note')
            },
            {
              title: 'COMPLETED GRN',
              value: `${completedGrnCount} Inwarded`,
              trend: `${completedGrnCount} Verified`,
              trendUp: true,
              icon: CheckCircle2,
              iconColor: '#16A34A',
              iconBg: '#F0FDF4',
              bottomPrefix: 'Received value ',
              bottomHighlight: `${completedGrnPoValFormatted} Inwarded & Stock Updated`,
              onClick: () => onNavigateTab && onNavigateTab('Goods Receipt Note')
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
                PO Approval <ArrowRight size={12} />
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
      {(activeSubTab === 'accounts' || activeSubTab === 'finance') && userRole !== 'HR' && (
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
      {/* CATEGORY 4: BOM OPERATIONS (BILL OF MATERIALS)           */}
      {/* ======================================================== */}
      {(activeSubTab === 'bom' || activeSubTab === 'bom-workflow') && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          
          {/* Order-to-Cash Lifecycle KPIs (BUSINZ DESIGN SYSTEM) */}
          <CeoKpiGrid kpis={funnelStages.map(stage => {
            return {
              title: stage.stage.toUpperCase(),
              value: stage.primaryMetric,
              trend: stage.statusBadge,
              trendUp: true,
              trendNeutral: false,
              hideTrendIcon: true,
              icon: stage.icon,
              iconColor: stage.color,
              iconBg: stage.bg,
              bottomPrefix: `${stage.valueLabel} `,
              bottomHighlight: stage.value,
              onClick: () => handleNavigateFunnelStage(stage)
            };
          })} />

          {/* ======================================================== */}
          {/* OPTION 1: DISPATCH & FULFILLMENT BOTTLENECK ANALYTICS   */}
          {/* ======================================================== */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
            gap: '12px'
          }}>
            {/* Card 1: 2-Hour Dispatch SLA Stopwatch */}
            <div style={{
              backgroundColor: '#FFFFFF',
              borderRadius: '16px',
              border: '1px solid #EAEFEF',
              padding: '16px',
              boxShadow: '0 4px 18px rgba(15, 23, 42, 0.03)',
              display: 'flex',
              flexDirection: 'column',
              gap: '12px'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <div style={{ width: '28px', height: '28px', borderRadius: '8px', backgroundColor: '#F0FDF4', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#16A34A' }}>
                    <Clock size={15} />
                  </div>
                  <div>
                    <div style={{ fontSize: '12px', fontWeight: '800', color: '#0F172A', textTransform: 'uppercase', letterSpacing: '0.3px' }}>
                      2-Hour Dispatch SLA Stopwatch
                    </div>
                    <div style={{ fontSize: '10.5px', color: '#64748B' }}>BOM confirmation to dispatch loading</div>
                  </div>
                </div>
                <span style={{
                  fontSize: '11px',
                  fontWeight: '800',
                  color: confirmedBomsStopwatchAudit.overallCompliancePct >= 80 ? '#16A34A' : (confirmedBomsStopwatchAudit.overallCompliancePct >= 50 ? '#D97706' : '#DC2626'),
                  backgroundColor: confirmedBomsStopwatchAudit.overallCompliancePct >= 80 ? '#F0FDF4' : (confirmedBomsStopwatchAudit.overallCompliancePct >= 50 ? '#FFFBEB' : '#FEF2F2'),
                  border: `1px solid ${confirmedBomsStopwatchAudit.overallCompliancePct >= 80 ? '#BBF7D0' : (confirmedBomsStopwatchAudit.overallCompliancePct >= 50 ? '#FDE68A' : '#FECACA')}`,
                  padding: '3px 8px',
                  borderRadius: '12px'
                }}>
                  {confirmedBomsStopwatchAudit.overallCompliancePct}% Within 2h
                </span>
              </div>

              {/* Progress Bar */}
              <div style={{ width: '100%', height: '8px', borderRadius: '4px', backgroundColor: '#F1F5F9', overflow: 'hidden', display: 'flex' }}>
                <div style={{ width: `${confirmedBomsStopwatchAudit.overallCompliancePct}%`, backgroundColor: '#16A34A', height: '100%' }} />
                <div style={{ width: `${100 - confirmedBomsStopwatchAudit.overallCompliancePct}%`, backgroundColor: confirmedBomsStopwatchAudit.breachedSlaCount > 0 ? '#EF4444' : '#F59E0B', height: '100%' }} />
              </div>

              {/* Status Buckets */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px', marginTop: '4px' }}>
                <div style={{ padding: '8px 10px', borderRadius: '8px', backgroundColor: '#F0FDF4', border: '1px solid #BBF7D0', textAlign: 'center' }}>
                  <div style={{ fontSize: '14px', fontWeight: '900', color: '#16A34A' }}>{confirmedBomsStopwatchAudit.withinSlaCount}</div>
                  <div style={{ fontSize: '10px', fontWeight: '700', color: '#15803D', marginTop: '2px' }}>≤ 2 Hours</div>
                </div>
                <div style={{ padding: '8px 10px', borderRadius: '8px', backgroundColor: '#FFFBEB', border: '1px solid #FDE68A', textAlign: 'center' }}>
                  <div style={{ fontSize: '14px', fontWeight: '900', color: '#D97706' }}>{confirmedBomsStopwatchAudit.approachingSlaCount}</div>
                  <div style={{ fontSize: '10px', fontWeight: '700', color: '#B45309', marginTop: '2px' }}>Near SLA (2-2.5h)</div>
                </div>
                <div style={{ padding: '8px 10px', borderRadius: '8px', backgroundColor: '#FEF2F2', border: '1px solid #FECACA', textAlign: 'center' }}>
                  <div style={{ fontSize: '14px', fontWeight: '900', color: '#DC2626' }}>{confirmedBomsStopwatchAudit.breachedSlaCount}</div>
                  <div style={{ fontSize: '10px', fontWeight: '700', color: '#B91C1C', marginTop: '2px' }}>Breached (&gt; 2h)</div>
                </div>
              </div>

              <div style={{
                marginTop: 'auto',
                paddingTop: '8px',
                borderTop: '1px solid #F1F5F9',
                fontSize: '10.5px',
                color: '#64748B',
                lineHeight: '1.4',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center'
              }}>
                <span>Avg Fulfillment: <strong style={{ color: '#0F172A' }}>{confirmedBomsStopwatchAudit.avgTotalTatStr}</strong></span>
                {confirmedBomsStopwatchAudit.primaryBottleneckDept ? (
                  <span style={{ color: '#D97706', fontWeight: '700', fontSize: '10px' }}>
                    Slowest: {confirmedBomsStopwatchAudit.primaryBottleneckDept.dept} ({confirmedBomsStopwatchAudit.primaryBottleneckDept.avgMins}m)
                  </span>
                ) : (
                  <span style={{ color: '#16A34A', fontWeight: '700', fontSize: '10px' }}>All stages on pace</span>
                )}
              </div>
            </div>

            {/* Card 3: Actionable Fast-Track Blockers */}
            <div style={{
              backgroundColor: '#FFFFFF',
              borderRadius: '16px',
              border: '1px solid #EAEFEF',
              padding: '16px',
              boxShadow: '0 4px 18px rgba(15, 23, 42, 0.03)',
              display: 'flex',
              flexDirection: 'column',
              gap: '12px'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <div style={{ width: '28px', height: '28px', borderRadius: '8px', backgroundColor: '#FFFBEB', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#D97706' }}>
                    <AlertTriangle size={15} />
                  </div>
                  <div>
                    <div style={{ fontSize: '12px', fontWeight: '800', color: '#0F172A', textTransform: 'uppercase', letterSpacing: '0.3px' }}>
                      Actionable Fast-Track Queue
                    </div>
                    <div style={{ fontSize: '10.5px', color: '#64748B' }}>Fulfillment stage transitions</div>
                  </div>
                </div>
                <span style={{
                  fontSize: '11px',
                  fontWeight: '800',
                  color: '#D97706',
                  backgroundColor: '#FFFBEB',
                  border: '1px solid #FDE68A',
                  padding: '3px 8px',
                  borderRadius: '12px'
                }}>
                  {dispatchBottleneckStats.actionableBlockers.length} In Queue
                </span>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', overflowY: 'auto', maxHeight: '165px' }}>
                {dispatchBottleneckStats.actionableBlockers.length > 0 ? (
                  dispatchBottleneckStats.actionableBlockers.map((blk, bIdx) => (
                    <div
                      key={bIdx}
                      onClick={() => setViewingBomModal(blk.bom)}
                      style={{
                        padding: '7px 10px',
                        borderRadius: '8px',
                        backgroundColor: '#F8FAFC',
                        border: '1px solid #E2E8F0',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        cursor: 'pointer',
                        transition: 'background-color 0.15s ease'
                      }}
                      onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#F1F5F9'}
                      onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#F8FAFC'}
                    >
                      <div style={{ minWidth: 0, flex: 1 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <span style={{ fontSize: '11px', fontWeight: '800', color: '#0E7490' }}>{blk.code}</span>
                          <span style={{ fontSize: '10.5px', color: '#64748B' }}>· {blk.customer}</span>
                        </div>
                        <div style={{ fontSize: '10px', color: '#475569', marginTop: '1px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {blk.blocker}
                        </div>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginLeft: '8px' }}>
                        <span style={{ fontSize: '9.5px', fontWeight: '700', padding: '2px 5px', borderRadius: '4px', backgroundColor: blk.severity === 'high' ? '#FEE2E2' : '#FEF3C7', color: blk.severity === 'high' ? '#DC2626' : '#D97706' }}>
                          {blk.days}d ago
                        </span>
                        <ChevronRight size={13} color="#94A3B8" />
                      </div>
                    </div>
                  ))
                ) : (
                  <div style={{ padding: '24px 12px', textAlign: 'center', color: '#64748B', fontSize: '11px' }}>
                    ✓ All orders are flowing smoothly through the dispatch lifecycle.
                  </div>
                )}
              </div>

              <div style={{
                marginTop: 'auto',
                paddingTop: '8px',
                borderTop: '1px solid #F1F5F9',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                fontSize: '10.5px',
                color: '#64748B'
              }}>
                <span>Click any order to view full lifecycle verification</span>
              </div>
            </div>
          </div>

        </div>
      )}

      {/* ======================================================== */}
      {/* CATEGORY 5: PRODUCTION OPERATIONS (PLANT & MACHINERY)     */}
      {/* ======================================================== */}
      {activeSubTab === 'production' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          
          {/* Production Top Ribbon (BUSINZ DESIGN SYSTEM) */}
          <CeoKpiGrid kpis={[
            {
              title: 'WORK ORDERS',
              value: `${workOrdersList.length} Work Orders`,
              trend: `${activeWorkOrdersCount} In-Progress`,
              trendUp: workOrdersList.length > 0,
              icon: ClipboardList,
              iconColor: '#0E7490',
              iconBg: '#ECFEFF',
              bottomPrefix: 'Active lines ',
              bottomHighlight: `${activeWorkOrdersCount} In Production`,
              onClick: () => onNavigateTab && onNavigateTab('Work Orders')
            },
            {
              title: 'COMPLETED WORK ORDERS',
              value: `${completedWorkOrdersCount} Completed`,
              trend: `${workOrdersList.length > 0 ? Math.round((completedWorkOrdersCount / workOrdersList.length) * 100) : 100}% Done`,
              trendUp: true,
              icon: CheckCircle2,
              iconColor: '#16A34A',
              iconBg: '#F0FDF4',
              bottomPrefix: 'Completion rate ',
              bottomHighlight: `${completedWorkOrdersCount} of ${workOrdersList.length} Finished`,
              onClick: () => onNavigateTab && onNavigateTab('Work Orders')
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
                  onClick={() => onNavigateTab && onNavigateTab('Production Monitoring')}
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
                  Production Monitoring <ArrowRight size={12} />
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
              title: 'TOTAL DISPATCH TODAY',
              value: `${todayDispatchesCount} Dispatches`,
              trend: todayDispatchesCount > 0 ? `${todayDispatchesCount} Dispatched` : '0 Today',
              trendUp: todayDispatchesCount > 0,
              icon: Truck,
              iconColor: '#059669',
              iconBg: '#ECFDF5',
              bottomPrefix: 'Today activity ',
              bottomHighlight: `${todayDispatchesCount} Dispatches Cleared`,
              onClick: () => onNavigateTab && onNavigateTab('Delivery Challans')
            },
            {
              title: 'PENDING DISPATCH',
              value: `${pendingDispatchQueueCount} Pending`,
              trend: pendingDispatchQueueCount > 0 ? `${pendingDispatchQueueCount} In Queue` : '0 Pending',
              trendUp: pendingDispatchQueueCount === 0,
              highlightCard: pendingDispatchQueueCount > 0,
              icon: Clock,
              iconColor: pendingDispatchQueueCount > 0 ? '#D97706' : '#16A34A',
              iconBg: pendingDispatchQueueCount > 0 ? '#FFFBEB' : '#F0FDF4',
              bottomPrefix: 'Dispatch stage ',
              bottomHighlight: 'Packing & Loading Queue',
              onClick: () => onNavigateTab && onNavigateTab('BOM Orders')
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
      {(activeSubTab === 'inventory-dashboard' || activeSubTab === 'inventory') && (
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
              title: 'RESERVED FOR BOMS',
              value: `${bomList.length} Active BOMs`,
              trend: `${totalProductionTonnage.toFixed(1)} MT`,
              trendUp: bomList.length > 0,
              icon: Layers,
              iconColor: '#2563EB',
              iconBg: '#EFF6FF',
              bottomPrefix: 'Material allocation ',
              bottomHighlight: `${totalProductionTonnage.toFixed(1)} MT Allocated`,
              onClick: () => onNavigateTab && onNavigateTab('Stock Status')
            }
          ]} />

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
                PO Approval →
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

      {/* 6. MODAL: CEO EXECUTIVE KPI DRILLDOWN POPUP */}
      {activeKpiPopup && kpiModalConfig && (
        <div
          onClick={() => setActiveKpiPopup(null)}
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(15, 23, 42, 0.7)',
            backdropFilter: 'blur(4px)',
            zIndex: 999999,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '16px',
            boxSizing: 'border-box'
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              backgroundColor: '#FFFFFF',
              borderRadius: '16px',
              width: '100%',
              maxWidth: '1020px',
              maxHeight: '90vh',
              display: 'flex',
              flexDirection: 'column',
              boxShadow: '0 25px 50px -12px rgba(15, 23, 42, 0.35)',
              border: '1px solid #CBD5E1',
              overflow: 'hidden',
              fontFamily: "'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, sans-serif"
            }}
          >
            {/* Modal Header */}
            <div style={{
              padding: '18px 22px',
              backgroundColor: kpiModalConfig.themeColor,
              color: '#FFFFFF',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              gap: '12px'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{
                  width: '38px',
                  height: '38px',
                  borderRadius: '10px',
                  backgroundColor: 'rgba(255, 255, 255, 0.2)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#FFFFFF',
                  flexShrink: 0
                }}>
                  {React.createElement(kpiModalConfig.icon, { size: 20 })}
                </div>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                    <h3 style={{ margin: 0, fontSize: '16px', fontWeight: '800', letterSpacing: '-0.01em' }}>
                      {kpiModalConfig.title}
                    </h3>
                    <span style={{
                      fontSize: '11px',
                      fontWeight: '800',
                      padding: '2px 8px',
                      borderRadius: '12px',
                      backgroundColor: 'rgba(255, 255, 255, 0.25)',
                      color: '#FFFFFF'
                    }}>
                      {kpiModalConfig.badge}
                    </span>
                    <span style={{
                      fontSize: '11px',
                      fontWeight: '700',
                      padding: '2px 8px',
                      borderRadius: '12px',
                      backgroundColor: '#FFFFFF',
                      color: kpiModalConfig.themeColor
                    }}>
                      {kpiModalConfig.valueLabel}: {kpiModalConfig.value}
                    </span>
                  </div>
                  <span style={{ fontSize: '11.5px', opacity: 0.9, marginTop: '2px', display: 'block' }}>
                    {kpiModalConfig.subtitle}
                  </span>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                {kpiModalConfig.targetTab && (
                  <button
                    type="button"
                    onClick={() => handleOpenFilteredFullPage()}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '6px',
                      padding: '7px 14px',
                      borderRadius: '8px',
                      backgroundColor: '#FFFFFF',
                      color: kpiModalConfig.themeColor,
                      border: 'none',
                      fontSize: '12px',
                      fontWeight: '800',
                      cursor: 'pointer',
                      boxShadow: '0 2px 6px rgba(0,0,0,0.15)',
                      transition: 'all 0.15s ease'
                    }}
                    title={`Open full ${kpiModalConfig.targetTabLabel || kpiModalConfig.targetTab} view with these ${kpiModalRows.length} records filtered`}
                  >
                    <span>Open Full Page (Filtered)</span>
                    <ArrowRight size={13} />
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setActiveKpiPopup(null)}
                  style={{
                    background: 'rgba(255, 255, 255, 0.2)',
                    border: 'none',
                    color: '#FFFFFF',
                    cursor: 'pointer',
                    width: '32px',
                    height: '32px',
                    borderRadius: '8px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '16px',
                    fontWeight: 'bold',
                    transition: 'background 0.15s ease'
                  }}
                  title="Close (Esc)"
                >
                  <X size={18} />
                </button>
              </div>
            </div>

            {/* Filter / Search Bar */}
            <div style={{
              padding: '12px 22px',
              backgroundColor: '#F8FAFC',
              borderBottom: '1px solid #E2E8F0',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              gap: '12px',
              flexWrap: 'wrap'
            }}>
              <div style={{ position: 'relative', flex: '1 1 260px', maxWidth: '400px' }}>
                <Search size={14} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: '#94A3B8' }} />
                <input
                  type="text"
                  value={kpiPopupSearch}
                  onChange={(e) => setKpiPopupSearch(e.target.value)}
                  placeholder={`Search ${kpiModalConfig.title.toLowerCase()} by customer, number, or status...`}
                  style={{
                    width: '100%',
                    padding: '7px 12px 7px 32px',
                    fontSize: '12px',
                    border: '1px solid #CBD5E1',
                    borderRadius: '8px',
                    backgroundColor: '#FFFFFF',
                    outline: 'none',
                    boxSizing: 'border-box'
                  }}
                  autoFocus
                />
                {kpiPopupSearch && (
                  <button
                    onClick={() => setKpiPopupSearch('')}
                    style={{
                      position: 'absolute',
                      right: '8px',
                      top: '50%',
                      transform: 'translateY(-50%)',
                      border: 'none',
                      background: 'none',
                      color: '#94A3B8',
                      cursor: 'pointer',
                      fontSize: '12px',
                      padding: 0
                    }}
                  >
                    ✕
                  </button>
                )}
              </div>

              <div style={{ fontSize: '12px', color: '#64748B', fontWeight: '600' }}>
                Showing <strong>{kpiModalRows.length}</strong> {kpiModalRows.length === 1 ? 'record' : 'records'}
              </div>
            </div>

            {/* Modal Body - Table */}
            <div style={{ flex: 1, overflowY: 'auto', maxHeight: 'calc(90vh - 180px)', backgroundColor: '#FFFFFF' }}>
              {kpiModalRows.length === 0 ? (
                <div style={{ padding: '48px 24px', textAlign: 'center', color: '#94A3B8' }}>
                  <AlertCircle size={36} color="#CBD5E1" style={{ margin: '0 auto 10px auto' }} />
                  <div style={{ fontSize: '14px', fontWeight: '800', color: '#475569' }}>
                    {kpiPopupSearch ? 'No matching records found' : `No records recorded for ${selectedPeriod}`}
                  </div>
                  <div style={{ fontSize: '12px', color: '#64748B', marginTop: '4px' }}>
                    {kpiPopupSearch ? 'Try clearing your search query' : 'Switch the time period filter on top to This Week, MTD, or YTD to inspect historical data.'}
                  </div>
                </div>
              ) : (
                <div style={{ overflowX: 'auto', width: '100%' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12.5px', textAlign: 'left' }}>
                    <thead>
                      <tr style={{ backgroundColor: '#F8FAFC', borderBottom: '1.5px solid #E2E8F0', position: 'sticky', top: 0, zIndex: 2 }}>
                        {kpiModalConfig.columns.map((col, cIdx) => (
                          <th
                            key={cIdx}
                            style={{
                              padding: '11px 14px',
                              fontWeight: '800',
                              color: '#475569',
                              fontSize: '11px',
                              textTransform: 'uppercase',
                              letterSpacing: '0.04em',
                              whiteSpace: 'nowrap',
                              textAlign: cIdx === kpiModalConfig.columns.length - 3 ? 'right' : (cIdx >= kpiModalConfig.columns.length - 2 ? 'center' : 'left'),
                              backgroundColor: '#F8FAFC'
                            }}
                          >
                            {col}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {kpiModalRows.map((row, rIdx) => {
                        let stBg = '#F1F5F9';
                        let stColor = '#475569';
                        let stBorder = '#E2E8F0';
                        if (row.statusType === 'success') {
                          stBg = '#ECFDF5'; stColor = '#047857'; stBorder = '#A7F3D0';
                        } else if (row.statusType === 'warning') {
                          stBg = '#FFFBEB'; stColor = '#B45309'; stBorder = '#FDE68A';
                        } else if (row.statusType === 'danger') {
                          stBg = '#FEF2F2'; stColor = '#DC2626'; stBorder = '#FECACA';
                        } else if (row.statusType === 'info') {
                          stBg = '#F0FDFA'; stColor = '#0E7490'; stBorder = '#CCFBF1';
                        }

                        return (
                          <tr
                            key={row.id || rIdx}
                            style={{
                              borderBottom: '1px solid #F1F5F9',
                              transition: 'background-color 0.15s ease',
                              cursor: 'pointer'
                            }}
                            onClick={() => {
                              if (activeKpiPopup === 'pi' && row.rawRecord) {
                                setViewingPiModal(row.rawRecord);
                              } else if ((activeKpiPopup === 'bom' || activeKpiPopup === 'kits') && row.rawRecord) {
                                setViewingBomModal(row.rawRecord);
                              } else if (activeKpiPopup === 'po' && onNavigateTab) {
                                setActiveKpiPopup(null);
                                onNavigateTab('Purchase Orders', row.rawRecord?.po_number || row.rawRecord?.poNumber || row.id);
                              } else if (activeKpiPopup === 'billing' && onNavigateTab) {
                                setActiveKpiPopup(null);
                                onNavigateTab('Invoice Management');
                              } else if (activeKpiPopup === 'dispatch' && onNavigateTab) {
                                setActiveKpiPopup(null);
                                onNavigateTab('Delivery Challans');
                              }
                            }}
                            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#F0FDFA'}
                            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                          >
                            <td style={{ padding: '10px 14px', color: '#94A3B8', fontSize: '11.5px', width: '36px' }}>
                              {rIdx + 1}
                            </td>
                            <td style={{ padding: '10px 14px', whiteSpace: 'nowrap', ...(row.col1Style || {}) }}>
                              {row.col1}
                            </td>
                            <td style={{ padding: '10px 14px', color: '#64748B', whiteSpace: 'nowrap', fontSize: '12px' }}>
                              {row.col2}
                            </td>
                            <td style={{ padding: '10px 14px', color: '#0F172A', fontWeight: '700', minWidth: '180px' }}>
                              {row.col3}
                            </td>
                            {row.col4 !== undefined && (
                              <td style={{ padding: '10px 14px', color: '#475569', fontSize: '12px' }}>
                                {row.col4}
                              </td>
                            )}
                            <td style={{ padding: '10px 14px', whiteSpace: 'nowrap', ...(row.col5Style || {}) }}>
                              {row.col5}
                            </td>
                            <td style={{ padding: '10px 14px', textAlign: 'center', whiteSpace: 'nowrap' }}>
                              <span style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '4px',
                                padding: '3px 9px',
                                borderRadius: '12px',
                                fontSize: '11px',
                                fontWeight: '700',
                                backgroundColor: stBg,
                                color: stColor,
                                border: `1px solid ${stBorder}`
                              }}>
                                {row.status}
                              </span>
                            </td>
                            <td style={{ padding: '10px 14px', textAlign: 'center', whiteSpace: 'nowrap' }}>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  if (activeKpiPopup === 'pi' && row.rawRecord) {
                                    setViewingPiModal(row.rawRecord);
                                  } else if ((activeKpiPopup === 'bom' || activeKpiPopup === 'kits') && row.rawRecord) {
                                    setViewingBomModal(row.rawRecord);
                                  } else if (activeKpiPopup === 'po' && onNavigateTab) {
                                    setActiveKpiPopup(null);
                                    onNavigateTab('Purchase Orders', row.rawRecord?.po_number || row.rawRecord?.poNumber || row.id);
                                  } else if (activeKpiPopup === 'billing' && onNavigateTab) {
                                    setActiveKpiPopup(null);
                                    onNavigateTab('Invoice Management');
                                  } else if (activeKpiPopup === 'dispatch' && onNavigateTab) {
                                    setActiveKpiPopup(null);
                                    onNavigateTab('Delivery Challans');
                                  }
                                }}
                                style={{
                                  padding: '4px 10px',
                                  borderRadius: '6px',
                                  border: '1px solid #CBD5E1',
                                  backgroundColor: '#FFFFFF',
                                  color: '#0E7490',
                                  fontSize: '11px',
                                  fontWeight: '700',
                                  cursor: 'pointer',
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '4px'
                                }}
                              >
                                <Eye size={12} />
                                <span>View</span>
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
              padding: '12px 22px',
              backgroundColor: '#F8FAFC',
              borderTop: '1px solid #E2E8F0',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: '10px'
            }}>
              <span style={{ fontSize: '11.5px', color: '#64748B' }}>
                Period Filter: <strong>{selectedPeriod}</strong> • Showing <strong>{kpiModalRows.length}</strong> matching records
              </span>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                {kpiModalConfig.targetTab && (
                  <button
                    type="button"
                    onClick={() => handleOpenFilteredFullPage()}
                    style={{
                      padding: '7px 14px',
                      borderRadius: '8px',
                      border: 'none',
                      backgroundColor: kpiModalConfig.themeColor,
                      color: '#FFFFFF',
                      fontSize: '12px',
                      fontWeight: '800',
                      cursor: 'pointer',
                      boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '6px'
                    }}
                  >
                    <span>Open Full {kpiModalConfig.targetTabLabel || kpiModalConfig.targetTab} (Filtered)</span>
                    <ArrowRight size={13} />
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setActiveKpiPopup(null)}
                  style={{
                    padding: '7px 16px',
                    borderRadius: '8px',
                    border: '1px solid #CBD5E1',
                    backgroundColor: '#FFFFFF',
                    color: '#334155',
                    fontSize: '12px',
                    fontWeight: '700',
                    cursor: 'pointer',
                    boxShadow: '0 1px 2px rgba(0,0,0,0.05)'
                  }}
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: PROFORMA INVOICE (PI) DETAIL VIEW */}
      {viewingPiModal && (() => {
        const pi = viewingPiModal;
        const piNo = pi.piNo || pi.id || 'PI';
        const piDate = pi.date || pi.piDate || '—';
        const customer = pi.customerName || pi.customer || pi.companyName || '—';
        const salesPerson = pi.salesPerson || pi.createdBy || 'Sales Team';
        const items = Array.isArray(pi.items) ? pi.items : [];
        const grandTotal = parseAmt(pi.grandTotal || pi.totalAmount || pi.amount || 0);
        const subtotal = parseAmt(pi.subtotal || pi.taxableAmount || (grandTotal > 0 ? grandTotal / 1.18 : 0));
        const taxTotal = parseAmt(pi.taxTotal || (grandTotal - subtotal));
        const paymentTerms = pi.paymentTerms || pi.terms || '100% Advance / Net 30';
        const isBOMConverted = Boolean(pi.bomConverted || pi.bomCode);
        const matchingBom = isBOMConverted ? allBomList.find(b => (b.bomCode === pi.bomCode || b.id === pi.bomCode || b.sourcePiNo === piNo)) : null;

        return (
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
              width: '920px',
              maxWidth: '100%',
              maxHeight: '90vh',
              display: 'flex',
              flexDirection: 'column',
              boxShadow: '0 25px 50px -12px rgba(15, 23, 42, 0.35)',
              border: '1px solid #E2E8F0',
              overflow: 'hidden'
            }}>
              {/* Header */}
              <div style={{
                padding: '16px 22px',
                borderBottom: '1px solid #E2E8F0',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                backgroundColor: '#F8FAFC'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <div style={{
                    width: '38px',
                    height: '38px',
                    borderRadius: '10px',
                    backgroundColor: '#ECFEFF',
                    color: '#0E7490',
                    border: '1px solid #A5F3FC',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0
                  }}>
                    <Receipt size={20} />
                  </div>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ fontSize: '15px', fontWeight: '800', color: '#0F172A' }}>
                        Proforma Invoice • {piNo}
                      </span>
                      <span style={{
                        fontSize: '10px',
                        fontWeight: '800',
                        padding: '2px 8px',
                        borderRadius: '999px',
                        backgroundColor: '#ECFEFF',
                        color: '#0E7490',
                        border: '1px solid #A5F3FC'
                      }}>
                        {pi.status || 'Active'}
                      </span>
                      {isBOMConverted && (
                        <span style={{
                          fontSize: '10px',
                          fontWeight: '800',
                          padding: '2px 8px',
                          borderRadius: '999px',
                          backgroundColor: '#F0FDF4',
                          color: '#16A34A',
                          border: '1px solid #BBF7D0'
                        }}>
                          ✓ BOM Generated {pi.bomCode ? `(${pi.bomCode})` : ''}
                        </span>
                      )}
                    </div>
                    <div style={{ fontSize: '11.5px', color: '#64748B', marginTop: '2px' }}>
                      Commercial Sales PI • Generated on {piDate} • Executive: <strong>{salesPerson}</strong>
                    </div>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setViewingPiModal(null)}
                  style={{
                    border: 'none',
                    background: 'none',
                    width: '32px',
                    height: '32px',
                    borderRadius: '8px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                    color: '#64748B',
                    backgroundColor: '#F1F5F9'
                  }}
                >
                  <X size={18} />
                </button>
              </div>

              {/* Body */}
              <div style={{ padding: '18px 22px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                {/* Info Cards Grid */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '10px' }}>
                  <div style={{ backgroundColor: '#F8FAFC', padding: '10px 12px', borderRadius: '10px', border: '1px solid #E2E8F0' }}>
                    <div style={{ fontSize: '10.5px', color: '#64748B', fontWeight: '700', textTransform: 'uppercase' }}>Customer / Client</div>
                    <div style={{ fontSize: '13px', fontWeight: '800', color: '#0F172A', marginTop: '3px' }}>{customer}</div>
                    {pi.customerPhone && <div style={{ fontSize: '11px', color: '#64748B', marginTop: '2px' }}>📞 {pi.customerPhone}</div>}
                  </div>
                  <div style={{ backgroundColor: '#F8FAFC', padding: '10px 12px', borderRadius: '10px', border: '1px solid #E2E8F0' }}>
                    <div style={{ fontSize: '10.5px', color: '#64748B', fontWeight: '700', textTransform: 'uppercase' }}>Payment Terms</div>
                    <div style={{ fontSize: '12px', fontWeight: '700', color: '#0F172A', marginTop: '3px' }}>{paymentTerms}</div>
                    <div style={{ fontSize: '11px', color: '#64748B', marginTop: '2px' }}>Date: {piDate}</div>
                  </div>
                  <div style={{ backgroundColor: '#F8FAFC', padding: '10px 12px', borderRadius: '10px', border: '1px solid #E2E8F0' }}>
                    <div style={{ fontSize: '10.5px', color: '#64748B', fontWeight: '700', textTransform: 'uppercase' }}>Total Line Items</div>
                    <div style={{ fontSize: '13px', fontWeight: '800', color: '#0F172A', marginTop: '3px' }}>{items.length} Products / Kits</div>
                    <div style={{ fontSize: '11px', color: '#64748B', marginTop: '2px' }}>Sales Rep: {salesPerson}</div>
                  </div>
                  <div style={{ backgroundColor: '#ECFEFF', padding: '10px 12px', borderRadius: '10px', border: '1px solid #A5F3FC' }}>
                    <div style={{ fontSize: '10.5px', color: '#0E7490', fontWeight: '800', textTransform: 'uppercase' }}>PI Grand Total</div>
                    <div style={{ fontSize: '16px', fontWeight: '900', color: '#0E7490', marginTop: '3px' }}>
                      ₹ {Math.round(grandTotal).toLocaleString('en-IN')}
                    </div>
                    <div style={{ fontSize: '10.5px', color: '#0E7490', marginTop: '2px' }}>Incl. GST (18%)</div>
                  </div>
                </div>

                {/* Items Table with Grouped Presets and Kit Value Header */}
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px', flexWrap: 'wrap', gap: '6px' }}>
                    <div style={{ fontSize: '12px', fontWeight: '800', color: '#0F172A', textTransform: 'uppercase' }}>
                      Quoted Products & Preset Kits ({items.length} components)
                    </div>
                    <div style={{ fontSize: '11px', color: '#64748B', fontWeight: '600' }}>
                      Grouped by Preset Kit with distinct pricing & boundaries
                    </div>
                  </div>

                  {(() => {
                    let presetGroupsData = pi.presetGroups || {};
                    if (typeof presetGroupsData === 'string') {
                      try {
                        presetGroupsData = JSON.parse(presetGroupsData);
                      } catch (e) {
                        presetGroupsData = {};
                      }
                    }
                    const sections = [];
                    const sectionMap = new Map();

                    const allZeroRates = items.length > 0 && items.every(it => (parseFloat(it.rate || it.price || 0) || 0) === 0);

                    items.forEach((it, idx) => {
                      const isPreset = Boolean(it.isPresetItem || it.presetGroupId || it.presetName || (allZeroRates && pi.presetName));
                      const secKey = isPreset
                        ? (it.presetGroupId || it.presetName || pi.presetName || 'PRESET_1')
                        : '__CUSTOM_ITEMS__';

                      if (!sectionMap.has(secKey)) {
                        const secObj = {
                          key: secKey,
                          isPreset,
                          presetGroupId: it.presetGroupId,
                          presetName: isPreset ? (it.presetName || (it.presetGroupId && presetGroupsData[it.presetGroupId]?.presetName) || pi.presetName || 'Preset Structure Kit') : 'Custom / Standalone Products',
                          items: []
                        };
                        sectionMap.set(secKey, secObj);
                        sections.push(secObj);
                      }
                      sectionMap.get(secKey).items.push({ item: it, originalIndex: idx });
                    });

                    // Pre-compute custom items taxable sum
                    const customTaxableTotal = sections
                      .filter(s => !s.isPreset)
                      .flatMap(s => s.items)
                      .reduce((sum, { item }) => {
                        const q = parseFloat(item.qty !== undefined ? item.qty : (item.quantity || 0)) || 0;
                        const r = parseFloat(item.rate || item.price || 0) || 0;
                        return sum + (q * r);
                      }, 0);

                    const presetTaxablePool = Math.max(0, subtotal - customTaxableTotal);
                    const presetSections = sections.filter(s => s.isPreset);
                    const presetGroupsList = Array.isArray(presetGroupsData)
                      ? presetGroupsData
                      : (presetGroupsData && typeof presetGroupsData === 'object' ? Object.values(presetGroupsData) : []);

                    return (
                      <div style={{ border: '1px solid #E2E8F0', borderRadius: '10px', overflowX: 'auto' }}>
                        <table style={{ width: '100%', fontSize: '11px', borderCollapse: 'collapse', textAlign: 'left' }}>
                          <thead>
                            <tr style={{ backgroundColor: '#F8FAFC', borderBottom: '1px solid #E2E8F0', color: '#64748B' }}>
                              <th style={{ padding: '8px 10px', width: '38px', textAlign: 'center' }}>#</th>
                              <th style={{ padding: '8px 10px' }}>Product / Component</th>
                              <th style={{ padding: '8px 10px', width: '80px', textAlign: 'center' }}>HSN / SAC</th>
                              <th style={{ padding: '8px 10px', textAlign: 'center', width: '65px' }}>Qty</th>
                              <th style={{ padding: '8px 10px', textAlign: 'center', width: '55px' }}>UOM</th>
                              <th style={{ padding: '8px 10px', textAlign: 'center', width: '110px' }}>Rate (₹)</th>
                              <th style={{ padding: '8px 10px', textAlign: 'center', width: '55px' }}>GST</th>
                              <th style={{ padding: '8px 10px', textAlign: 'right', width: '110px' }}>Total (₹)</th>
                            </tr>
                          </thead>
                          <tbody>
                            {sections.length > 0 ? (
                              sections.map((sec, secIdx) => {
                                if (sec.isPreset) {
                                  const presetIdx = presetSections.indexOf(sec);
                                  let grpConfig = (sec.presetGroupId && presetGroupsData[sec.presetGroupId]) || (presetGroupsData[sec.key]) || null;
                                  if (!grpConfig && presetGroupsList.length > 0) {
                                    grpConfig = presetGroupsList.find(g =>
                                      (sec.presetGroupId && (g.id === sec.presetGroupId || g.groupId === sec.presetGroupId)) ||
                                      (sec.presetName && g.presetName && g.presetName.toLowerCase().trim() === sec.presetName.toLowerCase().trim()) ||
                                      (g.name && sec.presetName && g.name.toLowerCase().trim() === sec.presetName.toLowerCase().trim())
                                    ) || null;
                                  }
                                  const setCount = parseFloat(grpConfig?.setCount || grpConfig?.quantity || pi.presetSetCount || 1) || 1;
                                  const pUnit = grpConfig?.unit || grpConfig?.unitType || pi.presetUnit || 'Sets';

                                  // Calculate kit taxable
                                  let taxable = 0;
                                  if (grpConfig?.kitPrice && parseFloat(grpConfig.kitPrice) > 0) {
                                    taxable = (parseFloat(grpConfig.kitPrice) || 0) * setCount;
                                  } else if (pi.presetKitPrice && parseFloat(pi.presetKitPrice) > 0) {
                                    taxable = (parseFloat(pi.presetKitPrice) || 0) * setCount;
                                  } else if (pi.unitValue && parseFloat(pi.unitValue) > 0) {
                                    taxable = parseFloat(pi.unitValue) || 0;
                                  } else if (pi.kitSubtotal && parseFloat(pi.kitSubtotal) > 0) {
                                    taxable = parseFloat(pi.kitSubtotal) || 0;
                                  } else if (presetSections.length === 1) {
                                    taxable = presetTaxablePool || (grandTotal > 0 ? Math.round(grandTotal / 1.18) : 0);
                                  } else if (presetSections.length > 0) {
                                    taxable = Math.round(presetTaxablePool / presetSections.length);
                                  }

                                  const rawGst = grpConfig?.gstRate || sec.items[0]?.item?.gstRate || pi.gstRate || '18%';
                                  const gstPct = parseFloat(String(rawGst).replace('%', '').trim()) || 18;
                                  const kitGst = Math.round(taxable * (gstPct / 100));
                                  const kitTotal = Math.round(taxable + kitGst);

                                  return (
                                    <React.Fragment key={sec.key}>
                                      {/* PRESET HEADER BANNER WITH KIT VALUE PROMINENTLY IN THE MIDDLE */}
                                      <tr style={{ backgroundColor: '#F0FDFA', borderTop: '2.5px solid #0E7490', borderBottom: '1.5px solid #A5F3FC' }}>
                                        <td colSpan={8} style={{ padding: '9px 12px' }}>
                                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px' }}>
                                            {/* Left: Preset Badge & Name */}
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                              <span style={{
                                                backgroundColor: '#0E7490',
                                                color: '#FFFFFF',
                                                fontSize: '10.5px',
                                                fontWeight: '900',
                                                padding: '2.5px 8px',
                                                borderRadius: '6px',
                                                letterSpacing: '0.5px',
                                                display: 'inline-flex',
                                                alignItems: 'center',
                                                gap: '4px'
                                              }}>
                                                <Boxes size={12} />
                                                PRESET {presetIdx + 1}
                                              </span>
                                              <strong style={{ fontSize: '13px', color: '#0F172A', fontWeight: '800' }}>
                                                {sec.presetName}
                                              </strong>
                                              <span style={{
                                                fontSize: '11px',
                                                color: '#0E7490',
                                                fontWeight: '700',
                                                backgroundColor: '#ECFEFF',
                                                padding: '2px 8px',
                                                borderRadius: '12px',
                                                border: '1px solid #A5F3FC'
                                              }}>
                                                Total Qty: {setCount} {pUnit} ({sec.items.length} components)
                                              </span>
                                            </div>

                                            {/* Center / Right: PROMINENT PRESET KIT VALUE BADGE */}
                                            <div style={{
                                              display: 'inline-flex',
                                              alignItems: 'center',
                                              gap: '10px',
                                              backgroundColor: '#FFFFFF',
                                              border: '1.5px solid #0E7490',
                                              borderRadius: '8px',
                                              padding: '4px 12px',
                                              boxShadow: '0 1px 3px rgba(14, 116, 144, 0.08)'
                                            }}>
                                              <div style={{ display: 'flex', alignItems: 'baseline', gap: '4px' }}>
                                                <span style={{ fontSize: '9.5px', color: '#64748B', fontWeight: '800', textTransform: 'uppercase' }}>KIT VALUE:</span>
                                                <strong style={{ fontSize: '12.5px', color: '#0F172A', fontWeight: '900' }}>
                                                  ₹ {Math.round(taxable).toLocaleString('en-IN')}
                                                </strong>
                                              </div>
                                              <span style={{ color: '#CBD5E1', fontWeight: '300' }}>|</span>
                                              <div style={{ display: 'flex', alignItems: 'baseline', gap: '4px' }}>
                                                <span style={{ fontSize: '9.5px', color: '#64748B', fontWeight: '800', textTransform: 'uppercase' }}>GST ({gstPct}%):</span>
                                                <strong style={{ fontSize: '11.5px', color: '#0F172A', fontWeight: '800' }}>
                                                  ₹ {kitGst.toLocaleString('en-IN')}
                                                </strong>
                                              </div>
                                              <span style={{ color: '#CBD5E1', fontWeight: '300' }}>|</span>
                                              <div style={{ display: 'flex', alignItems: 'baseline', gap: '4px' }}>
                                                <span style={{ fontSize: '9.5px', color: '#0E7490', fontWeight: '800', textTransform: 'uppercase' }}>TOTAL:</span>
                                                <strong style={{ fontSize: '13.5px', color: '#0E7490', fontWeight: '900' }}>
                                                  ₹ {kitTotal.toLocaleString('en-IN')}
                                                </strong>
                                              </div>
                                            </div>
                                          </div>
                                        </td>
                                      </tr>

                                      {/* Individual Component Items */}
                                      {sec.items.map(({ item: it, originalIndex }, cIdx) => {
                                        const q = parseFloat(it.qty !== undefined ? it.qty : (it.quantity || 0)) || 0;
                                        const r = parseFloat(it.rate || it.price || 0) || 0;
                                        const taxRateStr = String(it.gstRate || it.gst || '18%').replace('%', '').trim();
                                        const taxRate = parseFloat(taxRateStr) || gstPct;
                                        const hasExplicitRate = r > 0;
                                        const taxableItem = q * r;
                                        const itemTotal = taxableItem + (taxableItem * (taxRate / 100));

                                        return (
                                          <tr key={originalIndex} style={{ borderBottom: '1px solid #F1F5F9', backgroundColor: cIdx % 2 === 1 ? '#FAFDFD' : '#FFFFFF' }}>
                                            <td style={{ padding: '7px 10px', color: '#64748B', fontWeight: '700', textAlign: 'center' }}>
                                              {presetIdx + 1}.{cIdx + 1}
                                            </td>
                                            <td style={{ padding: '7px 10px', fontWeight: '700', color: '#0F172A' }}>
                                              <div>{it.name || it.productName || 'Item'}</div>
                                              {it.subPresetName && (
                                                <div style={{ fontSize: '10px', color: '#0D9488', fontWeight: '700', marginTop: '1px' }}>
                                                  ↳ Sub-Kit: {it.subPresetName}
                                                </div>
                                              )}
                                            </td>
                                            <td style={{ padding: '7px 10px', color: '#64748B', textAlign: 'center' }}>{it.hsn || it.hsn_or_sac || '—'}</td>
                                            <td style={{ padding: '7px 10px', textAlign: 'center', fontWeight: '800', color: '#0F172A' }}>{q}</td>
                                            <td style={{ padding: '7px 10px', textAlign: 'center', color: '#64748B' }}>{it.uom || it.unit || 'NOS'}</td>
                                            <td style={{ padding: '7px 10px', textAlign: 'center' }}>
                                              {hasExplicitRate ? (
                                                <span style={{ color: '#475569', fontWeight: '700' }}>₹ {r.toLocaleString('en-IN')}</span>
                                              ) : (
                                                <span style={{ fontSize: '10px', color: '#0E7490', fontWeight: '700', backgroundColor: '#ECFEFF', padding: '2px 7px', borderRadius: '4px', border: '1px solid #CFFAFE' }}>
                                                  Incl. in Kit
                                                </span>
                                              )}
                                            </td>
                                            <td style={{ padding: '7px 10px', textAlign: 'center', color: '#64748B' }}>{taxRate}%</td>
                                            <td style={{ padding: '7px 10px', textAlign: 'right' }}>
                                              {hasExplicitRate ? (
                                                <strong style={{ color: '#0F172A' }}>₹ {Math.round(itemTotal).toLocaleString('en-IN')}</strong>
                                              ) : (
                                                <span style={{ fontSize: '10px', color: '#0E7490', fontWeight: '700', backgroundColor: '#ECFEFF', padding: '2px 7px', borderRadius: '4px', border: '1px solid #CFFAFE' }}>
                                                  Incl. in Kit
                                                </span>
                                              )}
                                            </td>
                                          </tr>
                                        );
                                      })}

                                      {/* END OF PRESET DIVIDER */}
                                      <tr style={{ backgroundColor: '#F0FDFA', borderTop: '1px dashed #99F6E4', borderBottom: '2.5px solid #0E7490' }}>
                                        <td colSpan={8} style={{ padding: '8px 14px', textAlign: 'center' }}>
                                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px' }}>
                                            <div style={{ height: '1.5px', flex: 1, backgroundColor: '#5EEAD4' }} />
                                            <span style={{
                                              fontSize: '11px',
                                              fontWeight: '800',
                                              color: '#0F766E',
                                              backgroundColor: '#CCFBF1',
                                              padding: '3px 12px',
                                              borderRadius: '999px',
                                              border: '1px solid #99F6E4',
                                              letterSpacing: '0.4px',
                                              display: 'inline-flex',
                                              alignItems: 'center',
                                              gap: '6px'
                                            }}>
                                              ✓ END OF PRESET {presetIdx + 1}: {sec.presetName} ({sec.items.length} Components • Total Kit Value: ₹ {kitTotal.toLocaleString('en-IN')})
                                            </span>
                                            <div style={{ height: '1.5px', flex: 1, backgroundColor: '#5EEAD4' }} />
                                          </div>
                                        </td>
                                      </tr>
                                    </React.Fragment>
                                  );
                                }

                                // CUSTOM / STANDALONE PRODUCTS SECTION
                                const customSecTaxable = sec.items.reduce((sum, { item }) => {
                                  const q = parseFloat(item.qty !== undefined ? item.qty : (item.quantity || 0)) || 0;
                                  const r = parseFloat(item.rate || item.price || 0) || 0;
                                  return sum + (q * r);
                                }, 0);

                                return (
                                  <React.Fragment key="custom_section">
                                    {/* START OF CUSTOM PRODUCTS HEADER */}
                                    <tr style={{ backgroundColor: '#F8FAFC', borderTop: '2.5px solid #475569', borderBottom: '1.5px solid #CBD5E1' }}>
                                      <td colSpan={8} style={{ padding: '9px 12px' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px' }}>
                                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                            <span style={{
                                              backgroundColor: '#475569',
                                              color: '#FFFFFF',
                                              fontSize: '10.5px',
                                              fontWeight: '900',
                                              padding: '2.5px 8px',
                                              borderRadius: '6px',
                                              letterSpacing: '0.5px'
                                            }}>
                                              START OF NEW PRODUCTS (STANDALONE)
                                            </span>
                                            <strong style={{ fontSize: '13px', color: '#1E293B', fontWeight: '800' }}>
                                              Additional Materials / Standalone Products ({sec.items.length} items)
                                            </strong>
                                          </div>
                                          <span style={{ fontSize: '11px', color: '#64748B', fontWeight: '700' }}>
                                            Individually Priced Components • Subtotal: ₹ {Math.round(customSecTaxable).toLocaleString('en-IN')}
                                          </span>
                                        </div>
                                      </td>
                                    </tr>

                                    {/* Custom Line Items */}
                                    {sec.items.map(({ item: it, originalIndex }, cIdx) => {
                                      const q = parseFloat(it.qty !== undefined ? it.qty : (it.quantity || 0)) || 0;
                                      const r = parseFloat(it.rate || it.price || 0) || 0;
                                      const taxRateStr = String(it.gstRate || it.gst || '18%').replace('%', '').trim();
                                      const taxRate = parseFloat(taxRateStr) || 18;
                                      const taxableItem = q * r;
                                      const itemTotal = taxableItem + (taxableItem * (taxRate / 100));

                                      return (
                                        <tr key={originalIndex} style={{ borderBottom: '1px solid #F1F5F9', backgroundColor: cIdx % 2 === 1 ? '#F8FAFC' : '#FFFFFF' }}>
                                          <td style={{ padding: '7px 10px', color: '#64748B', fontWeight: '700', textAlign: 'center' }}>
                                            C.{cIdx + 1}
                                          </td>
                                          <td style={{ padding: '7px 10px', fontWeight: '700', color: '#0F172A' }}>
                                            <div>{it.name || it.productName || 'Item'}</div>
                                            {it.category && (
                                              <div style={{ fontSize: '10px', color: '#64748B', marginTop: '1px' }}>
                                                {it.category}
                                              </div>
                                            )}
                                          </td>
                                          <td style={{ padding: '7px 10px', color: '#64748B', textAlign: 'center' }}>{it.hsn || it.hsn_or_sac || '—'}</td>
                                          <td style={{ padding: '7px 10px', textAlign: 'center', fontWeight: '800', color: '#0F172A' }}>{q}</td>
                                          <td style={{ padding: '7px 10px', textAlign: 'center', color: '#64748B' }}>{it.uom || it.unit || 'NOS'}</td>
                                          <td style={{ padding: '7px 10px', textAlign: 'right', color: '#334155', fontWeight: '700' }}>
                                            ₹ {r.toLocaleString('en-IN')}
                                          </td>
                                          <td style={{ padding: '7px 10px', textAlign: 'center', color: '#64748B' }}>{taxRate}%</td>
                                          <td style={{ padding: '7px 10px', textAlign: 'right', fontWeight: '800', color: '#0F172A' }}>
                                            ₹ {Math.round(itemTotal).toLocaleString('en-IN')}
                                          </td>
                                        </tr>
                                      );
                                    })}

                                    {/* END OF CUSTOM PRODUCTS DIVIDER */}
                                    <tr style={{ backgroundColor: '#F8FAFC', borderTop: '1px dashed #CBD5E1', borderBottom: '2.5px solid #475569' }}>
                                      <td colSpan={8} style={{ padding: '7px 14px', textAlign: 'center' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px' }}>
                                          <div style={{ height: '1px', flex: 1, backgroundColor: '#CBD5E1' }} />
                                          <span style={{ fontSize: '11px', fontWeight: '800', color: '#475569', letterSpacing: '0.4px' }}>
                                            ✓ END OF STANDALONE PRODUCTS ({sec.items.length} Items)
                                          </span>
                                          <div style={{ height: '1px', flex: 1, backgroundColor: '#CBD5E1' }} />
                                        </div>
                                      </td>
                                    </tr>
                                  </React.Fragment>
                                );
                              })
                            ) : (
                              <tr>
                                <td colSpan={8} style={{ padding: '16px', textAlign: 'center', color: '#94A3B8' }}>
                                  No individual line items listed.
                                </td>
                              </tr>
                            )}
                          </tbody>
                        </table>
                      </div>
                    );
                  })()}
                </div>

                {/* Financial Summary */}
                <div style={{
                  display: 'flex',
                  justifyContent: 'flex-end',
                  marginTop: '4px'
                }}>
                  <div style={{ width: '280px', display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '12px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', color: '#64748B' }}>
                      <span>Subtotal (Taxable):</span>
                      <strong style={{ color: '#0F172A' }}>₹ {Math.round(subtotal).toLocaleString('en-IN')}</strong>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', color: '#64748B' }}>
                      <span>Estimated GST (18%):</span>
                      <strong style={{ color: '#0F172A' }}>₹ {Math.round(taxTotal).toLocaleString('en-IN')}</strong>
                    </div>
                    <div style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      borderTop: '2px solid #0E7490',
                      paddingTop: '6px',
                      fontSize: '14px',
                      color: '#0E7490'
                    }}>
                      <span><strong>Total Quoted:</strong></span>
                      <strong style={{ fontSize: '15px' }}>₹ {Math.round(grandTotal).toLocaleString('en-IN')}</strong>
                    </div>
                  </div>
                </div>
              </div>

              {/* Footer */}
              <div style={{
                padding: '12px 22px',
                backgroundColor: '#F8FAFC',
                borderTop: '1px solid #E2E8F0',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: '8px'
              }}>
                <div style={{ display: 'flex', gap: '8px' }}>
                  {isBOMConverted && matchingBom && (
                    <button
                      type="button"
                      onClick={() => {
                        setViewingPiModal(null);
                        setViewingBomModal(matchingBom);
                      }}
                      style={{
                        padding: '7px 14px',
                        borderRadius: '8px',
                        border: '1px solid #BBF7D0',
                        backgroundColor: '#F0FDF4',
                        color: '#16A34A',
                        fontSize: '11.5px',
                        fontWeight: '800',
                        cursor: 'pointer',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '4px'
                      }}
                    >
                      <Factory size={13} /> View Linked BOM ({matchingBom.bomCode || matchingBom.id}) →
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => {
                      setViewingPiModal(null);
                      if (onNavigateTab) {
                        onNavigateTab('Performa Invoice', null, null, null);
                      }
                    }}
                    style={{
                      padding: '7px 14px',
                      borderRadius: '8px',
                      border: '1px solid #0E7490',
                      backgroundColor: '#ECFEFF',
                      color: '#0E7490',
                      fontSize: '11.5px',
                      fontWeight: '800',
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '4px'
                    }}
                  >
                    <ExternalLink size={13} /> Open in Proforma Invoice View ↗
                  </button>
                </div>

                <button
                  type="button"
                  onClick={() => setViewingPiModal(null)}
                  style={{
                    padding: '7px 16px',
                    borderRadius: '8px',
                    border: '1px solid #CBD5E1',
                    backgroundColor: '#FFFFFF',
                    color: '#334155',
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
        );
      })()}

      {/* MODAL: BOM ORDER & LIFECYCLE DETAIL VIEW */}
      {viewingBomModal && (() => {
        const bom = viewingBomModal;
        const bomCode = bom.bomCode || bom.id || 'BOM';
        const bomDate = bom.bomDate || bom.date || bom.createdAt || '—';
        const customer = bom.customerName || bom.customer || '—';
        const salesPerson = bom.salesPerson || bom.createdBy || 'Sales / Engineering';
        const linkedPiNo = bom.sourcePiNo || bom.piNo || bom.piNumber || bom.source_pi_no;
        const matchingPi = linkedPiNo ? allPiList.find(p => (p.piNo === linkedPiNo || p.id === linkedPiNo)) : null;
        const items = Array.isArray(bom.items) && bom.items.length > 0 ? bom.items : (Array.isArray(bom.materials) && bom.materials.length > 0 ? bom.materials : (Array.isArray(matchingPi?.items) ? matchingPi.items : []));
        const grandTotal = parseAmt(bom.grandTotal || bom.totalAmount || bom.amount || bom.value || matchingPi?.grandTotal || 0);
        const subtotal = parseAmt(bom.subtotal || bom.taxableAmount || bom.unitValue || matchingPi?.subtotal || (grandTotal > 0 ? Math.round(grandTotal / 1.18) : 0));
        const taxTotal = parseAmt(bom.taxTotal || matchingPi?.taxTotal || Math.max(0, grandTotal - subtotal));
        const totalUnits = items.reduce((sum, it) => sum + (parseFloat(it.totalDispatchQty || it.qty || it.quantity || 0) || 0), 0);
        const st = String(bom.status || '').toLowerCase();

        // Payment Proof Documents for CEO
        const pDocs = (Array.isArray(bom.paymentProofDocs) && bom.paymentProofDocs.length > 0)
          ? bom.paymentProofDocs
          : (Array.isArray(bom.payments?.proofDocObjs) && bom.payments.proofDocObjs.length > 0)
            ? bom.payments.proofDocObjs
            : (bom.paymentProofDoc
                ? (Array.isArray(bom.paymentProofDoc) ? bom.paymentProofDoc : [bom.paymentProofDoc])
                : (bom.payments?.proofDoc
                    ? [{ name: bom.payments.proofDoc, dataUrl: bom.payments.proofDocData }]
                    : (matchingPi?.paymentProofDocs && matchingPi.paymentProofDocs.length > 0
                        ? matchingPi.paymentProofDocs
                        : (matchingPi?.paymentProofDoc ? [matchingPi.paymentProofDoc] : []))));
        const validPDocs = (pDocs || []).filter(d => Boolean(d && (typeof d === 'string' ? d.trim() : (d.name || d.url || d.dataUrl || d.storagePath))));

        // Address Proof Documents for CEO
        const aDocs = (Array.isArray(bom.deliveryAddressProofDocs) && bom.deliveryAddressProofDocs.length > 0)
          ? bom.deliveryAddressProofDocs
          : (Array.isArray(bom.deliveryProofDocs) && bom.deliveryProofDocs.length > 0)
            ? bom.deliveryProofDocs
            : (bom.deliveryAddressProofDoc
                ? (Array.isArray(bom.deliveryAddressProofDoc) ? bom.deliveryAddressProofDoc : [bom.deliveryAddressProofDoc])
                : (bom.deliveryProofDoc
                    ? (Array.isArray(bom.deliveryProofDoc) ? bom.deliveryProofDoc : [bom.deliveryProofDoc])
                    : (matchingPi?.deliveryAddressProofDocs && matchingPi.deliveryAddressProofDocs.length > 0
                        ? matchingPi.deliveryAddressProofDocs
                        : (matchingPi?.deliveryAddressProofDoc
                            ? [matchingPi.deliveryAddressProofDoc]
                            : (matchingPi?.deliveryProofDoc ? [matchingPi.deliveryProofDoc] : [])))));
        const validADocs = (aDocs || []).filter(d => Boolean(d && (typeof d === 'string' ? d.trim() : (d.name || d.url || d.dataUrl || d.storagePath))));

        const timing = getBomStageTiming(bom, matchingPi);

        // 6 Lifecycle stage indicators with Real Operational Timestamps & Active Processing Stage
        const stages = [
          {
            num: 1,
            label: 'PI Commercial',
            done: timing?.hasPi,
            active: false,
            date: timing?.piDate || '—',
            completedTime: timing?.piTime,
            receivedTime: timing?.piTime,
            duration: null,
            subtext: timing?.hasPi ? 'Issued to Client' : 'Direct Order'
          },
          {
            num: 2,
            label: 'BOM Confirmed',
            done: timing?.hasConfirmed,
            active: !timing?.hasConfirmed,
            date: timing?.confirmedDate || '—',
            completedTime: timing?.confirmedTime,
            receivedTime: timing?.piTime || timing?.confirmedTime,
            duration: null,
            subtext: timing?.hasConfirmed ? 'Sales Confirmed' : 'Draft Order'
          },
          {
            num: 3,
            label: 'Dispatch Packing',
            done: timing?.hasPacking,
            active: timing?.isPackingActive,
            date: timing?.packingDate || (timing?.isPackingActive ? timing?.confirmedDate : '—'),
            completedTime: timing?.packingCompletedTime,
            receivedTime: timing?.packingReceivedTime,
            duration: timing?.packingDuration,
            subtext: timing?.hasPacking ? 'Packing Verified' : 'Awaiting Packing'
          },
          {
            num: 4,
            label: 'Accounts Verified',
            done: timing?.hasAccounts,
            active: timing?.isAccountsActive,
            date: timing?.accountsDate || (timing?.isAccountsActive ? (timing?.packingDate || timing?.confirmedDate) : '—'),
            completedTime: timing?.accountsCompletedTime,
            receivedTime: timing?.accountsReceivedTime,
            duration: timing?.accountsDuration,
            subtext: timing?.hasAccounts ? 'Accounts Verified' : 'Awaiting Accounts'
          },
          {
            num: 5,
            label: 'GST Invoiced',
            done: timing?.hasInvoice,
            active: timing?.isInvoiceActive,
            date: timing?.invoiceDate || (timing?.isInvoiceActive ? (timing?.accountsDate || timing?.packingDate) : '—'),
            completedTime: timing?.invoiceCompletedTime,
            receivedTime: timing?.invoiceReceivedTime,
            duration: timing?.invoiceDuration,
            subtext: timing?.hasInvoice ? 'Invoice Confirmed' : 'Awaiting Billing'
          },
          {
            num: 6,
            label: 'Final Dispatched',
            done: timing?.hasDispatch,
            active: timing?.isDispatchActive,
            date: timing?.dispatchDate || (timing?.isDispatchActive ? (timing?.invoiceDate || timing?.accountsDate) : '—'),
            completedTime: timing?.dispatchCompletedTime,
            receivedTime: timing?.dispatchReceivedTime,
            duration: timing?.dispatchDuration,
            subtext: timing?.hasDispatch ? 'Dispatched' : 'Awaiting Loading'
          }
        ];

        return (
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
              width: '920px',
              maxWidth: '100%',
              maxHeight: '90vh',
              display: 'flex',
              flexDirection: 'column',
              boxShadow: '0 25px 50px -12px rgba(15, 23, 42, 0.35)',
              border: '1px solid #E2E8F0',
              overflow: 'hidden'
            }}>
              {/* Header */}
              <div style={{
                padding: '16px 22px',
                borderBottom: '1px solid #E2E8F0',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                backgroundColor: '#F8FAFC'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <div style={{
                    width: '38px',
                    height: '38px',
                    borderRadius: '10px',
                    backgroundColor: '#F0F9FF',
                    color: '#0284C7',
                    border: '1px solid #BAE6FD',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0
                  }}>
                    <Factory size={20} />
                  </div>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ fontSize: '15px', fontWeight: '800', color: '#0F172A' }}>
                        BOM Order • {bomCode}
                      </span>
                      <span style={{
                        fontSize: '10px',
                        fontWeight: '800',
                        padding: '2px 8px',
                        borderRadius: '999px',
                        backgroundColor: '#ECFEFF',
                        color: '#0E7490',
                        border: '1px solid #A5F3FC'
                      }}>
                        {bom.status || 'Active'}
                      </span>
                    </div>
                    <div style={{ fontSize: '11.5px', color: '#64748B', marginTop: '2px' }}>
                      Customer Project: <strong>{customer}</strong> • Date: {bomDate} • Rep: {salesPerson}
                    </div>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setViewingBomModal(null)}
                  style={{
                    border: 'none',
                    background: 'none',
                    width: '32px',
                    height: '32px',
                    borderRadius: '8px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                    color: '#64748B',
                    backgroundColor: '#F1F5F9'
                  }}
                >
                  <X size={18} />
                </button>
              </div>

              {/* Body */}
              <div style={{ padding: '18px 22px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                {/* 6-Stage Progress Stepper Bar with Date & 2-Hour SLA Stopwatch */}
                <div style={{
                  backgroundColor: '#F8FAFC',
                  borderRadius: '12px',
                  padding: '12px 14px',
                  border: '1px solid #E2E8F0'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px', flexWrap: 'wrap', gap: '6px' }}>
                    <div style={{ fontSize: '11px', fontWeight: '800', color: '#475569', textTransform: 'uppercase', letterSpacing: '0.4px' }}>
                      Order-to-Cash Lifecycle Progress
                    </div>
                    {timing && (
                      <span style={{
                        fontSize: '10.5px',
                        fontWeight: '800',
                        color: timing.isCompleted ? '#16A34A' : '#0E7490',
                        backgroundColor: timing.isCompleted ? '#F0FDF4' : '#ECFEFF',
                        border: `1px solid ${timing.isCompleted ? '#BBF7D0' : '#BAE6FD'}`,
                        padding: '2px 10px',
                        borderRadius: '999px',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '5px'
                      }}>
                        {timing.isCompleted ? (
                          <>✓ Order Completed & Dispatched {timing.totalTurnaround ? `(Turnaround: ${timing.totalTurnaround})` : ''}</>
                        ) : (
                          <>Current: {timing.activeStageName} (In Processing)</>
                        )}
                      </span>
                    )}
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: '6px' }}>
                    {stages.map((stg) => {
                      const isComplete = stg.done;
                      const isCurrent = stg.active;
                      return (
                        <div
                          key={stg.num}
                          style={{
                            backgroundColor: isComplete ? '#F0FDF4' : (isCurrent ? '#ECFEFF' : '#FFFFFF'),
                            border: `1.5px solid ${isComplete ? '#BBF7D0' : (isCurrent ? '#0E7490' : '#E2E8F0')}`,
                            borderRadius: '10px',
                            padding: '8px 6px',
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            textAlign: 'center',
                            gap: '3px',
                            minHeight: '94px',
                            boxSizing: 'border-box'
                          }}
                        >
                          <span style={{
                            fontSize: '9.5px',
                            fontWeight: '800',
                            color: isComplete ? '#16A34A' : (isCurrent ? '#0E7490' : '#94A3B8'),
                            textTransform: 'uppercase',
                            letterSpacing: '0.4px'
                          }}>
                            {isComplete ? '✓ STEP ' + stg.num : 'STEP ' + stg.num}
                          </span>
                          <span style={{
                            fontSize: '11px',
                            fontWeight: '800',
                            color: isComplete ? '#15803D' : (isCurrent ? '#0E7490' : '#475569'),
                            lineHeight: 1.15
                          }}>
                            {stg.label}
                          </span>
                          {/* DATE */}
                          <span style={{
                            fontSize: '10px',
                            fontWeight: '700',
                            color: isComplete ? '#166534' : (isCurrent ? '#0E7490' : '#64748B'),
                            marginTop: '2px',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '2px'
                          }}>
                            {stg.date}
                          </span>
                          {/* TIME & STAGE STATUS */}
                          <div style={{
                            backgroundColor: isComplete ? '#DCFCE7' : (isCurrent ? '#E0F2FE' : '#F1F5F9'),
                            border: `1.5px solid ${isComplete ? '#BBF7D0' : (isCurrent ? '#0E7490' : '#E2E8F0')}`,
                            padding: '4px 4px',
                            borderRadius: '8px',
                            marginTop: 'auto',
                            width: '100%',
                            boxSizing: 'border-box',
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            gap: '2px'
                          }}>
                            {/* Primary Status */}
                            <span style={{
                              fontSize: '9.5px',
                              fontWeight: '900',
                              color: isComplete ? '#15803D' : (isCurrent ? '#0369A1' : '#64748B'),
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '2px'
                            }}>
                              {isComplete ? '✓ Completed' : (isCurrent ? 'Processing' : 'Pending')}
                            </span>

                            {/* Exact Operational Timestamp */}
                            {isComplete ? (
                              <span style={{
                                fontSize: '9px',
                                fontWeight: '800',
                                color: '#166534',
                                lineHeight: '1.2'
                              }}>
                                {stg.completedTime ? `At ${stg.completedTime}` : (stg.date !== '—' ? stg.date : 'Done')}
                              </span>
                            ) : isCurrent ? (
                              <span style={{
                                fontSize: '9px',
                                fontWeight: '800',
                                color: '#0E7490',
                                lineHeight: '1.2'
                              }}>
                                {stg.receivedTime ? `Received: ${stg.receivedTime}` : 'In Progress'}
                              </span>
                            ) : (
                              <span style={{
                                fontSize: '8.5px',
                                fontWeight: '600',
                                color: '#94A3B8'
                              }}>
                                Waiting
                              </span>
                            )}

                            {/* Turnaround Duration if Completed */}
                            {isComplete && stg.duration && (
                              <span style={{
                                fontSize: '8px',
                                fontWeight: '700',
                                color: '#15803D',
                                opacity: 0.85
                              }}>
                                Took {stg.duration}
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Info Cards Grid */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '10px' }}>
                  <div style={{ backgroundColor: '#F8FAFC', padding: '10px 12px', borderRadius: '10px', border: '1px solid #E2E8F0', minHeight: '68px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                    <div style={{ fontSize: '10.5px', color: '#64748B', fontWeight: '700', textTransform: 'uppercase' }}>Linked PI Reference</div>
                    {linkedPiNo ? (
                      <div style={{ marginTop: '3px' }}>
                        <button
                          type="button"
                          onClick={() => {
                            const targetPi = matchingPi || {
                              piNo: linkedPiNo,
                              id: linkedPiNo,
                              customerName: customer,
                              customer: customer,
                              date: timing?.piDate !== '—' ? timing?.piDate : bomDate,
                              salesPerson: salesPerson,
                              grandTotal: grandTotal,
                              subtotal: subtotal,
                              taxTotal: taxTotal,
                              items: items,
                              paymentTerms: bom.paymentType || '100% Paid',
                              status: 'Converted to BOM',
                              convertedBomCode: bomCode,
                              bomCode: bomCode
                            };
                            setViewingBomModal(null);
                            setViewingPiModal(targetPi);
                          }}
                          style={{
                            border: 'none',
                            background: 'none',
                            padding: 0,
                            fontSize: '13px',
                            fontWeight: '800',
                            color: '#0284C7',
                            textDecoration: 'underline',
                            cursor: 'pointer',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px'
                          }}
                          title="Open Commercial PI Details (same page, in-modal)"
                        >
                          {linkedPiNo} <Receipt size={13} />
                        </button>
                        <div style={{ fontSize: '10.5px', color: '#64748B', marginTop: '2px' }}>Click to view Commercial PI</div>
                      </div>
                    ) : (
                      <div style={{ fontSize: '12px', color: '#64748B', marginTop: '3px' }}>Direct Factory BOM</div>
                    )}
                  </div>

                  {/* Payment Attachment */}
                  <div style={{ backgroundColor: validPDocs.length > 0 ? '#F0FDF4' : '#F8FAFC', padding: '10px 12px', borderRadius: '10px', border: validPDocs.length > 0 ? '1px solid #BBF7D0' : '1px solid #E2E8F0', minHeight: '68px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '4px' }}>
                      <span style={{ fontSize: '10.5px', color: validPDocs.length > 0 ? '#15803D' : '#64748B', fontWeight: '700', textTransform: 'uppercase', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                        <CreditCard size={12} /> Payment Attachment
                      </span>
                      {validPDocs.length > 0 && (
                        <span style={{ fontSize: '9px', fontWeight: '800', color: '#16A34A', backgroundColor: '#DCFCE7', padding: '1px 6px', borderRadius: '999px', border: '1px solid #BBF7D0' }}>
                          ✓ {validPDocs.length} {validPDocs.length === 1 ? 'File' : 'Files'}
                        </span>
                      )}
                    </div>
                    {validPDocs.length > 0 ? (
                      <div style={{ marginTop: '4px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        {validPDocs.map((pDoc, pIdx) => {
                          const rawName = typeof pDoc === 'string' ? pDoc : (pDoc?.name || pDoc?.originalName || `Payment Slip #${pIdx + 1}`);
                          const isPdf = /\.pdf($|\?)/i.test(rawName);
                          return (
                            <button
                              key={pIdx}
                              type="button"
                              onClick={() => setPreviewDocModal({ title: `Payment Proof #${pIdx + 1}: ${rawName}`, doc: pDoc, bomCode })}
                              style={{
                                border: '1px solid #BBF7D0',
                                backgroundColor: '#FFFFFF',
                                borderRadius: '6px',
                                padding: '3px 6px',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                cursor: 'pointer',
                                textAlign: 'left',
                                gap: '6px',
                                width: '100%',
                                boxSizing: 'border-box'
                              }}
                              title={`Click to preview ${rawName}`}
                            >
                              <span style={{ fontSize: '11px', color: '#166534', fontWeight: '700', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '140px', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                                {isPdf ? '📑' : '🖼️'} {rawName}
                              </span>
                              <span style={{ fontSize: '10px', color: '#0E7490', fontWeight: '800', display: 'inline-flex', alignItems: 'center', gap: '2px', flexShrink: 0 }}>
                                <Eye size={10} /> View
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    ) : (
                      <div style={{ marginTop: '4px' }}>
                        <div style={{ fontSize: '12px', fontWeight: '700', color: '#94A3B8' }}>Not Attached</div>
                        <div style={{ fontSize: '10px', color: '#94A3B8', marginTop: '1px' }}>No payment receipt on file</div>
                      </div>
                    )}
                  </div>

                  {/* Address Proof */}
                  <div style={{ backgroundColor: validADocs.length > 0 ? '#F0FDFA' : '#F8FAFC', padding: '10px 12px', borderRadius: '10px', border: validADocs.length > 0 ? '1px solid #99F6E4' : '1px solid #E2E8F0', minHeight: '68px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '4px' }}>
                      <span style={{ fontSize: '10.5px', color: validADocs.length > 0 ? '#0F766E' : '#64748B', fontWeight: '700', textTransform: 'uppercase', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                        <Truck size={12} /> Address Proof
                      </span>
                      {validADocs.length > 0 && (
                        <span style={{ fontSize: '9px', fontWeight: '800', color: '#0D9488', backgroundColor: '#CCFBF1', padding: '1px 6px', borderRadius: '999px', border: '1px solid #99F6E4' }}>
                          ✓ {validADocs.length} {validADocs.length === 1 ? 'File' : 'Files'}
                        </span>
                      )}
                    </div>
                    {validADocs.length > 0 ? (
                      <div style={{ marginTop: '4px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        {validADocs.map((aDoc, aIdx) => {
                          const rawName = typeof aDoc === 'string' ? aDoc : (aDoc?.name || aDoc?.originalName || `Address Proof #${aIdx + 1}`);
                          const isPdf = /\.pdf($|\?)/i.test(rawName);
                          return (
                            <button
                              key={aIdx}
                              type="button"
                              onClick={() => setPreviewDocModal({ title: `Address Proof #${aIdx + 1}: ${rawName}`, doc: aDoc, bomCode })}
                              style={{
                                border: '1px solid #99F6E4',
                                backgroundColor: '#FFFFFF',
                                borderRadius: '6px',
                                padding: '3px 6px',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                cursor: 'pointer',
                                textAlign: 'left',
                                gap: '6px',
                                width: '100%',
                                boxSizing: 'border-box'
                              }}
                              title={`Click to preview ${rawName}`}
                            >
                              <span style={{ fontSize: '11px', color: '#0F766E', fontWeight: '700', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '140px', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                                {isPdf ? '📑' : '📍'} {rawName}
                              </span>
                              <span style={{ fontSize: '10px', color: '#0E7490', fontWeight: '800', display: 'inline-flex', alignItems: 'center', gap: '2px', flexShrink: 0 }}>
                                <Eye size={10} /> View
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    ) : (
                      <div style={{ marginTop: '4px' }}>
                        <div style={{ fontSize: '12px', fontWeight: '700', color: '#94A3B8' }}>Not Attached</div>
                        <div style={{ fontSize: '10px', color: '#94A3B8', marginTop: '1px' }}>No address proof on file</div>
                      </div>
                    )}
                  </div>

                  <div style={{ backgroundColor: '#F0F9FF', padding: '10px 12px', borderRadius: '10px', border: '1px solid #BAE6FD', minHeight: '68px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                    <div style={{ fontSize: '10.5px', color: '#0284C7', fontWeight: '800', textTransform: 'uppercase' }}>BOM Order Value</div>
                    <div style={{ fontSize: '16px', fontWeight: '900', color: '#0284C7', marginTop: '3px' }}>
                      ₹ {Math.round(grandTotal).toLocaleString('en-IN')}
                    </div>
                    <div style={{ fontSize: '10.5px', color: '#0284C7', marginTop: '2px' }}>
                      {bom.invoiceConfirmed ? '✓ Invoiced & Locked' : 'Pending Invoice'}
                    </div>
                  </div>
                </div>

                {/* Items Table with Grouped Presets and Kit Value Header (PI Formatted for CEO) */}
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px', flexWrap: 'wrap', gap: '6px' }}>
                    <div style={{ fontSize: '12px', fontWeight: '800', color: '#0F172A', textTransform: 'uppercase' }}>
                      BOM Materials & Preset Structure Kits ({items.length} components)
                    </div>
                    <div style={{ fontSize: '11px', color: '#64748B', fontWeight: '600' }}>
                      Grouped by Structure Kit with commercial rates, GST & boundaries
                    </div>
                  </div>

                  {(() => {
                    let presetGroupsData = bom.presetGroups || matchingPi?.presetGroups || {};
                    if (typeof presetGroupsData === 'string') {
                      try {
                        presetGroupsData = JSON.parse(presetGroupsData);
                      } catch (e) {
                        presetGroupsData = {};
                      }
                    }
                    const sections = [];
                    const sectionMap = new Map();

                    const allZeroRates = items.length > 0 && items.every(it => (parseFloat(it.rate || it.price || 0) || 0) === 0);

                    items.forEach((it, idx) => {
                      const isPreset = Boolean(it.isPresetItem || it.presetGroupId || it.presetName || (allZeroRates && (bom.presetName || matchingPi?.presetName)));
                      const secKey = isPreset
                        ? (it.presetGroupId || it.presetName || bom.presetName || matchingPi?.presetName || 'PRESET_1')
                        : '__CUSTOM_ITEMS__';

                      if (!sectionMap.has(secKey)) {
                        const secObj = {
                          key: secKey,
                          isPreset,
                          presetGroupId: it.presetGroupId,
                          presetName: isPreset ? (it.presetName || (it.presetGroupId && presetGroupsData[it.presetGroupId]?.presetName) || bom.presetName || matchingPi?.presetName || 'Preset Structure Kit') : 'Custom / Standalone Products',
                          items: []
                        };
                        sectionMap.set(secKey, secObj);
                        sections.push(secObj);
                      }
                      sectionMap.get(secKey).items.push({ item: it, originalIndex: idx });
                    });

                    // Fallback single section if items is empty
                    if (sections.length === 0 && (bom.presetName || matchingPi?.presetName || grandTotal > 0)) {
                      sections.push({
                        key: 'PRESET_1',
                        isPreset: true,
                        presetGroupId: 'group_1',
                        presetName: bom.presetName || matchingPi?.presetName || 'Solar Mounting Structure Kit',
                        items: [{
                          item: {
                            name: bom.presetName || matchingPi?.presetName || 'Solar Mounting Structure Kit',
                            hsn: '73089090',
                            qty: bom.presetSetCount || matchingPi?.presetSetCount || 1,
                            uom: bom.presetUnit || matchingPi?.presetUnit || 'SET',
                            rate: subtotal,
                            gstRate: '18%'
                          },
                          originalIndex: 0
                        }]
                      });
                    }

                    // Pre-compute custom items taxable sum
                    const customTaxableTotal = sections
                      .filter(s => !s.isPreset)
                      .flatMap(s => s.items)
                      .reduce((sum, { item }) => {
                        const q = (parseFloat(item.totalDispatchQty) > 0 ? parseFloat(item.totalDispatchQty) : (parseFloat(item.qty || item.bomQty || item.quantity || 0) || 0));
                        const r = parseFloat(item.rate || item.price || 0) || 0;
                        return sum + (q * r);
                      }, 0);

                    const presetTaxablePool = Math.max(0, subtotal - customTaxableTotal);
                    const presetSections = sections.filter(s => s.isPreset);
                    const presetGroupsList = Array.isArray(presetGroupsData)
                      ? presetGroupsData
                      : (presetGroupsData && typeof presetGroupsData === 'object' ? Object.values(presetGroupsData) : []);

                    return (
                      <div style={{ border: '1px solid #E2E8F0', borderRadius: '10px', overflowX: 'auto' }}>
                        <table style={{ width: '100%', fontSize: '11px', borderCollapse: 'collapse', textAlign: 'left' }}>
                          <thead>
                            <tr style={{ backgroundColor: '#F8FAFC', borderBottom: '1px solid #E2E8F0', color: '#64748B' }}>
                              <th style={{ padding: '8px 10px', width: '38px', textAlign: 'center' }}>#</th>
                              <th style={{ padding: '8px 10px' }}>Product / Component</th>
                              <th style={{ padding: '8px 10px', width: '80px', textAlign: 'center' }}>HSN / SAC</th>
                              <th style={{ padding: '8px 10px', textAlign: 'center', width: '65px' }}>Qty</th>
                              <th style={{ padding: '8px 10px', textAlign: 'center', width: '55px' }}>UOM</th>
                              <th style={{ padding: '8px 10px', textAlign: 'center', width: '110px' }}>Rate (₹)</th>
                              <th style={{ padding: '8px 10px', textAlign: 'center', width: '55px' }}>GST</th>
                              <th style={{ padding: '8px 10px', textAlign: 'right', width: '110px' }}>Total (₹)</th>
                            </tr>
                          </thead>
                          <tbody>
                            {sections.length > 0 ? (
                              sections.map((sec, secIdx) => {
                                if (sec.isPreset) {
                                  const presetIdx = presetSections.indexOf(sec);
                                  let grpConfig = (sec.presetGroupId && presetGroupsData[sec.presetGroupId]) || (presetGroupsData[sec.key]) || null;
                                  if (!grpConfig && presetGroupsList.length > 0) {
                                    grpConfig = presetGroupsList.find(g =>
                                      (sec.presetGroupId && (g.id === sec.presetGroupId || g.groupId === sec.presetGroupId)) ||
                                      (sec.presetName && g.presetName && g.presetName.toLowerCase().trim() === sec.presetName.toLowerCase().trim()) ||
                                      (g.name && sec.presetName && g.name.toLowerCase().trim() === sec.presetName.toLowerCase().trim())
                                    ) || null;
                                  }
                                  const setCount = parseFloat(grpConfig?.setCount || grpConfig?.quantity || bom.presetSetCount || matchingPi?.presetSetCount || 1) || 1;
                                  const pUnit = grpConfig?.unit || grpConfig?.unitType || bom.presetUnit || matchingPi?.presetUnit || 'Sets';

                                  // Calculate kit taxable
                                  let taxable = 0;
                                  if (grpConfig?.kitPrice && parseFloat(grpConfig.kitPrice) > 0) {
                                    taxable = (parseFloat(grpConfig.kitPrice) || 0) * setCount;
                                  } else if (bom.presetKitPrice && parseFloat(bom.presetKitPrice) > 0) {
                                    taxable = (parseFloat(bom.presetKitPrice) || 0) * setCount;
                                  } else if (matchingPi?.presetKitPrice && parseFloat(matchingPi.presetKitPrice) > 0) {
                                    taxable = (parseFloat(matchingPi.presetKitPrice) || 0) * setCount;
                                  } else if (bom.unitValue && parseFloat(bom.unitValue) > 0) {
                                    taxable = parseFloat(bom.unitValue) || 0;
                                  } else if (presetSections.length === 1) {
                                    taxable = presetTaxablePool || (grandTotal > 0 ? Math.round(grandTotal / 1.18) : 0);
                                  } else if (presetSections.length > 0) {
                                    taxable = Math.round(presetTaxablePool / presetSections.length);
                                  }

                                  const rawGst = grpConfig?.gstRate || sec.items[0]?.item?.gstRate || bom.gstRate || matchingPi?.gstRate || '18%';
                                  const gstPct = parseFloat(String(rawGst).replace('%', '').trim()) || 18;
                                  const kitGst = Math.round(taxable * (gstPct / 100));
                                  const kitTotal = Math.round(taxable + kitGst);

                                  return (
                                    <React.Fragment key={sec.key}>
                                      {/* PRESET HEADER BANNER WITH KIT VALUE */}
                                      <tr style={{ backgroundColor: '#F0FDFA', borderTop: '2.5px solid #0E7490', borderBottom: '1.5px solid #A5F3FC' }}>
                                        <td colSpan={8} style={{ padding: '9px 12px' }}>
                                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                              <span style={{
                                                backgroundColor: '#0E7490',
                                                color: '#FFFFFF',
                                                fontSize: '10.5px',
                                                fontWeight: '900',
                                                padding: '2.5px 8px',
                                                borderRadius: '6px',
                                                letterSpacing: '0.5px',
                                                display: 'inline-flex',
                                                alignItems: 'center',
                                                gap: '4px'
                                              }}>
                                                <Boxes size={12} />
                                                PRESET {presetIdx + 1}
                                              </span>
                                              <strong style={{ fontSize: '13px', color: '#0F172A', fontWeight: '800' }}>
                                                {sec.presetName}
                                              </strong>
                                              <span style={{
                                                fontSize: '11px',
                                                color: '#0E7490',
                                                fontWeight: '700',
                                                backgroundColor: '#ECFEFF',
                                                padding: '2px 8px',
                                                borderRadius: '12px',
                                                border: '1px solid #A5F3FC'
                                              }}>
                                                Total Qty: {setCount} {pUnit} ({sec.items.length} components)
                                              </span>
                                            </div>

                                            <div style={{
                                              display: 'inline-flex',
                                              alignItems: 'center',
                                              gap: '10px',
                                              backgroundColor: '#FFFFFF',
                                              border: '1.5px solid #0E7490',
                                              borderRadius: '8px',
                                              padding: '4px 12px',
                                              boxShadow: '0 1px 3px rgba(14, 116, 144, 0.08)'
                                            }}>
                                              <div style={{ display: 'flex', alignItems: 'baseline', gap: '4px' }}>
                                                <span style={{ fontSize: '9.5px', color: '#64748B', fontWeight: '800', textTransform: 'uppercase' }}>KIT VALUE:</span>
                                                <strong style={{ fontSize: '12.5px', color: '#0F172A', fontWeight: '900' }}>
                                                  ₹ {Math.round(taxable).toLocaleString('en-IN')}
                                                </strong>
                                              </div>
                                              <span style={{ color: '#CBD5E1', fontWeight: '300' }}>|</span>
                                              <div style={{ display: 'flex', alignItems: 'baseline', gap: '4px' }}>
                                                <span style={{ fontSize: '9.5px', color: '#64748B', fontWeight: '800', textTransform: 'uppercase' }}>GST ({gstPct}%):</span>
                                                <strong style={{ fontSize: '11.5px', color: '#0F172A', fontWeight: '800' }}>
                                                  ₹ {kitGst.toLocaleString('en-IN')}
                                                </strong>
                                              </div>
                                              <span style={{ color: '#CBD5E1', fontWeight: '300' }}>|</span>
                                              <div style={{ display: 'flex', alignItems: 'baseline', gap: '4px' }}>
                                                <span style={{ fontSize: '9.5px', color: '#0E7490', fontWeight: '800', textTransform: 'uppercase' }}>TOTAL:</span>
                                                <strong style={{ fontSize: '13.5px', color: '#0E7490', fontWeight: '900' }}>
                                                  ₹ {kitTotal.toLocaleString('en-IN')}
                                                </strong>
                                              </div>
                                            </div>
                                          </div>
                                        </td>
                                      </tr>

                                      {/* Individual Component Items */}
                                      {sec.items.map(({ item: it, originalIndex }, cIdx) => {
                                        const q = (parseFloat(it.totalDispatchQty) > 0 ? parseFloat(it.totalDispatchQty) : (parseFloat(it.qty || it.bomQty || it.quantity || 0) || 0));
                                        const r = parseFloat(it.rate || it.price || 0) || 0;
                                        const taxRateStr = String(it.gstRate || it.gst || '18%').replace('%', '').trim();
                                        const taxRate = parseFloat(taxRateStr) || gstPct;
                                        const hasExplicitRate = r > 0;
                                        const taxableItem = q * r;
                                        const itemTotal = taxableItem + (taxableItem * (taxRate / 100));

                                        return (
                                          <tr key={originalIndex} style={{ borderBottom: '1px solid #F1F5F9', backgroundColor: cIdx % 2 === 1 ? '#FAFDFD' : '#FFFFFF' }}>
                                            <td style={{ padding: '7px 10px', color: '#64748B', fontWeight: '700', textAlign: 'center' }}>
                                              {presetIdx + 1}.{cIdx + 1}
                                            </td>
                                            <td style={{ padding: '7px 10px', fontWeight: '700', color: '#0F172A' }}>
                                              <div>{it.name || it.material || it.productName || 'Material Item'}</div>
                                              {it.subPresetName && (
                                                <div style={{ fontSize: '10px', color: '#0D9488', fontWeight: '700', marginTop: '1px' }}>
                                                  ↳ Sub-Kit: {it.subPresetName}
                                                </div>
                                              )}
                                            </td>
                                            <td style={{ padding: '7px 10px', color: '#64748B', textAlign: 'center' }}>{it.hsn || it.hsn_or_sac || '73089090'}</td>
                                            <td style={{ padding: '7px 10px', textAlign: 'center', fontWeight: '800', color: '#0F172A' }}>{q}</td>
                                            <td style={{ padding: '7px 10px', textAlign: 'center', color: '#64748B' }}>{it.uom || it.unit || 'NOS'}</td>
                                            <td style={{ padding: '7px 10px', textAlign: 'center' }}>
                                              {hasExplicitRate ? (
                                                <span style={{ color: '#475569', fontWeight: '700' }}>₹ {r.toLocaleString('en-IN')}</span>
                                              ) : (
                                                <span style={{ fontSize: '10px', color: '#0E7490', fontWeight: '700', backgroundColor: '#ECFEFF', padding: '2px 7px', borderRadius: '4px', border: '1px solid #CFFAFE' }}>
                                                  Incl. in Kit
                                                </span>
                                              )}
                                            </td>
                                            <td style={{ padding: '7px 10px', textAlign: 'center', color: '#64748B' }}>{taxRate}%</td>
                                            <td style={{ padding: '7px 10px', textAlign: 'right' }}>
                                              {hasExplicitRate ? (
                                                <strong style={{ color: '#0F172A' }}>₹ {Math.round(itemTotal).toLocaleString('en-IN')}</strong>
                                              ) : (
                                                <span style={{ fontSize: '10px', color: '#0E7490', fontWeight: '700', backgroundColor: '#ECFEFF', padding: '2px 7px', borderRadius: '4px', border: '1px solid #CFFAFE' }}>
                                                  Incl. in Kit
                                                </span>
                                              )}
                                            </td>
                                          </tr>
                                        );
                                      })}

                                      {/* END OF PRESET DIVIDER */}
                                      <tr style={{ backgroundColor: '#F0FDFA', borderTop: '1px dashed #99F6E4', borderBottom: '2.5px solid #0E7490' }}>
                                        <td colSpan={8} style={{ padding: '8px 14px', textAlign: 'center' }}>
                                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px' }}>
                                            <div style={{ height: '1.5px', flex: 1, backgroundColor: '#5EEAD4' }} />
                                            <span style={{
                                              fontSize: '11px',
                                              fontWeight: '800',
                                              color: '#0F766E',
                                              backgroundColor: '#CCFBF1',
                                              padding: '3px 12px',
                                              borderRadius: '999px',
                                              border: '1px solid #99F6E4',
                                              letterSpacing: '0.4px',
                                              display: 'inline-flex',
                                              alignItems: 'center',
                                              gap: '6px'
                                            }}>
                                              ✓ END OF PRESET {presetIdx + 1}: {sec.presetName} ({sec.items.length} Components • Total Kit Value: ₹ {kitTotal.toLocaleString('en-IN')})
                                            </span>
                                            <div style={{ height: '1.5px', flex: 1, backgroundColor: '#5EEAD4' }} />
                                          </div>
                                        </td>
                                      </tr>
                                    </React.Fragment>
                                  );
                                }

                                // CUSTOM / STANDALONE PRODUCTS SECTION
                                const customSecTaxable = sec.items.reduce((sum, { item }) => {
                                  const q = (parseFloat(item.totalDispatchQty) > 0 ? parseFloat(item.totalDispatchQty) : (parseFloat(item.qty || item.bomQty || item.quantity || 0) || 0));
                                  const r = parseFloat(item.rate || item.price || 0) || 0;
                                  return sum + (q * r);
                                }, 0);

                                return (
                                  <React.Fragment key="custom_section">
                                    <tr style={{ backgroundColor: '#F8FAFC', borderTop: '2.5px solid #475569', borderBottom: '1.5px solid #CBD5E1' }}>
                                      <td colSpan={8} style={{ padding: '9px 12px' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px' }}>
                                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                            <span style={{
                                              backgroundColor: '#475569',
                                              color: '#FFFFFF',
                                              fontSize: '10.5px',
                                              fontWeight: '900',
                                              padding: '2.5px 8px',
                                              borderRadius: '6px',
                                              letterSpacing: '0.5px'
                                            }}>
                                              START OF NEW PRODUCTS (STANDALONE)
                                            </span>
                                            <strong style={{ fontSize: '13px', color: '#1E293B', fontWeight: '800' }}>
                                              Additional Materials / Standalone Products ({sec.items.length} items)
                                            </strong>
                                          </div>
                                          <span style={{ fontSize: '11px', color: '#64748B', fontWeight: '700' }}>
                                            Individually Priced Components • Subtotal: ₹ {Math.round(customSecTaxable).toLocaleString('en-IN')}
                                          </span>
                                        </div>
                                      </td>
                                    </tr>

                                    {sec.items.map(({ item: it, originalIndex }, cIdx) => {
                                      const q = (parseFloat(it.totalDispatchQty) > 0 ? parseFloat(it.totalDispatchQty) : (parseFloat(it.qty || it.bomQty || it.quantity || 0) || 0));
                                      const r = parseFloat(it.rate || it.price || 0) || 0;
                                      const taxRateStr = String(it.gstRate || it.gst || '18%').replace('%', '').trim();
                                      const taxRate = parseFloat(taxRateStr) || 18;
                                      const taxableItem = q * r;
                                      const itemTotal = taxableItem + (taxableItem * (taxRate / 100));

                                      return (
                                        <tr key={originalIndex} style={{ borderBottom: '1px solid #F1F5F9', backgroundColor: cIdx % 2 === 1 ? '#F8FAFC' : '#FFFFFF' }}>
                                          <td style={{ padding: '7px 10px', color: '#64748B', fontWeight: '700', textAlign: 'center' }}>
                                            C.{cIdx + 1}
                                          </td>
                                          <td style={{ padding: '7px 10px', fontWeight: '700', color: '#0F172A' }}>
                                            <div>{it.name || it.material || it.productName || 'Item'}</div>
                                            {it.category && (
                                              <div style={{ fontSize: '10px', color: '#64748B', marginTop: '1px' }}>
                                                {it.category}
                                              </div>
                                            )}
                                          </td>
                                          <td style={{ padding: '7px 10px', color: '#64748B', textAlign: 'center' }}>{it.hsn || it.hsn_or_sac || '73089090'}</td>
                                          <td style={{ padding: '7px 10px', textAlign: 'center', fontWeight: '800', color: '#0F172A' }}>{q}</td>
                                          <td style={{ padding: '7px 10px', textAlign: 'center', color: '#64748B' }}>{it.uom || it.unit || 'NOS'}</td>
                                          <td style={{ padding: '7px 10px', textAlign: 'right', color: '#334155', fontWeight: '700' }}>
                                            ₹ {r.toLocaleString('en-IN')}
                                          </td>
                                          <td style={{ padding: '7px 10px', textAlign: 'center', color: '#64748B' }}>{taxRate}%</td>
                                          <td style={{ padding: '7px 10px', textAlign: 'right', fontWeight: '800', color: '#0F172A' }}>
                                            ₹ {Math.round(itemTotal).toLocaleString('en-IN')}
                                          </td>
                                        </tr>
                                      );
                                    })}

                                    <tr style={{ backgroundColor: '#F8FAFC', borderTop: '1px dashed #CBD5E1', borderBottom: '2.5px solid #475569' }}>
                                      <td colSpan={8} style={{ padding: '7px 14px', textAlign: 'center' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px' }}>
                                          <div style={{ height: '1px', flex: 1, backgroundColor: '#CBD5E1' }} />
                                          <span style={{ fontSize: '11px', fontWeight: '800', color: '#475569', letterSpacing: '0.4px' }}>
                                            ✓ END OF STANDALONE PRODUCTS ({sec.items.length} Items)
                                          </span>
                                          <div style={{ height: '1px', flex: 1, backgroundColor: '#CBD5E1' }} />
                                        </div>
                                      </td>
                                    </tr>
                                  </React.Fragment>
                                );
                              })
                            ) : (
                              <tr>
                                <td colSpan={8} style={{ padding: '16px', textAlign: 'center', color: '#94A3B8' }}>
                                  No items in this BOM order.
                                </td>
                              </tr>
                            )}
                          </tbody>
                        </table>
                      </div>
                    );
                  })()}
                </div>

                {/* Financial Summary */}
                <div style={{
                  display: 'flex',
                  justifyContent: 'flex-end',
                  marginTop: '4px'
                }}>
                  <div style={{ width: '280px', display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '12px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', color: '#64748B' }}>
                      <span>Subtotal (Taxable):</span>
                      <strong style={{ color: '#0F172A' }}>₹ {Math.round(subtotal).toLocaleString('en-IN')}</strong>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', color: '#64748B' }}>
                      <span>Estimated GST (18%):</span>
                      <strong style={{ color: '#0F172A' }}>₹ {Math.round(taxTotal).toLocaleString('en-IN')}</strong>
                    </div>
                    <div style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      borderTop: '2px solid #0E7490',
                      paddingTop: '6px',
                      fontSize: '14px',
                      color: '#0E7490'
                    }}>
                      <span><strong>Total Order Value:</strong></span>
                      <strong style={{ fontSize: '15px' }}>₹ {Math.round(grandTotal).toLocaleString('en-IN')}</strong>
                    </div>
                  </div>
                </div>
              </div>

              {/* Footer */}
              <div style={{
                padding: '12px 22px',
                backgroundColor: '#F8FAFC',
                borderTop: '1px solid #E2E8F0',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: '8px'
              }}>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button
                    type="button"
                    onClick={() => {
                      setViewingBomModal(null);
                      if (onNavigateTab) {
                        onNavigateTab('BOM Orders', null, null, null);
                      }
                    }}
                    style={{
                      padding: '7px 14px',
                      borderRadius: '8px',
                      border: '1px solid #0284C7',
                      backgroundColor: '#F0F9FF',
                      color: '#0284C7',
                      fontSize: '11.5px',
                      fontWeight: '800',
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '4px'
                    }}
                  >
                    <ExternalLink size={13} /> Open in BOM Orders View ↗
                  </button>
                </div>

                <button
                  type="button"
                  onClick={() => setViewingBomModal(null)}
                  style={{
                    padding: '7px 16px',
                    borderRadius: '8px',
                    border: '1px solid #CBD5E1',
                    backgroundColor: '#FFFFFF',
                    color: '#334155',
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
        );
      })()}

      {/* DOCUMENT PREVIEW MODAL */}
      {previewDocModal && (() => {
        const rawDoc = previewDocModal.doc;
        const docTitle = previewDocModal.title || 'Document Preview';
        const docName = typeof rawDoc === 'string' ? rawDoc : (rawDoc?.name || 'Uploaded File');

        let resolvedData = null;
        if (typeof rawDoc === 'string') {
          if (rawDoc.startsWith('data:') || rawDoc.startsWith('http://') || rawDoc.startsWith('https://') || rawDoc.startsWith('/uploads/') || rawDoc.startsWith('/api/uploads/')) {
            resolvedData = rawDoc;
          } else {
            resolvedData = getMediaFromCache(rawDoc) || null;
          }
        } else if (rawDoc && typeof rawDoc === 'object') {
          resolvedData = rawDoc.dataUrl || rawDoc.url || rawDoc.fileData || rawDoc.previewUrl || getMediaFromCache(rawDoc.name) || resolveDocumentUrl(rawDoc) || null;
        }
        if (resolvedData && typeof resolvedData === 'string' && resolvedData.startsWith('/uploads/')) {
          resolvedData = `/api${resolvedData}`;
        }

        const isPdf = /\.pdf($|\?)/i.test(docName) || (typeof resolvedData === 'string' && resolvedData.startsWith('data:application/pdf'));

        return (
          <div
            style={{
              position: 'fixed',
              inset: 0,
              backgroundColor: 'rgba(15,23,42,0.75)',
              backdropFilter: 'blur(3px)',
              zIndex: 999999,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '20px'
            }}
            onClick={() => setPreviewDocModal(null)}
          >
            <div
              onClick={(e) => e.stopPropagation()}
              style={{
                backgroundColor: '#FFFFFF',
                borderRadius: '16px',
                maxWidth: '850px',
                width: '100%',
                maxHeight: '90vh',
                display: 'flex',
                flexDirection: 'column',
                overflow: 'hidden',
                boxShadow: '0 25px 50px -12px rgba(0,0,0,0.35)',
                border: '1px solid #E2E8F0'
              }}
            >
              <div style={{ padding: '16px 20px', borderBottom: '1px solid #E2E8F0', display: 'flex', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#F8FAFC' }}>
                <div>
                  <h3 style={{ margin: 0, fontSize: '15px', fontWeight: '800', color: '#0F172A' }}>{docTitle}</h3>
                  <p style={{ margin: '2px 0 0', fontSize: '12px', color: '#64748B', wordBreak: 'break-all' }}>{docName}</p>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  {resolvedData && (
                    <a
                      href={resolvedData}
                      target="_blank"
                      rel="noopener noreferrer"
                      download={docName || 'document'}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '6px',
                        fontSize: '12px',
                        fontWeight: '700',
                        color: '#0E7490',
                        backgroundColor: '#ECFEFF',
                        border: '1px solid #A5F3FC',
                        padding: '6px 12px',
                        borderRadius: '8px',
                        textDecoration: 'none',
                        cursor: 'pointer'
                      }}
                    >
                      <Download size={13} /> Open / Download
                    </a>
                  )}
                  <button
                    type="button"
                    onClick={() => setPreviewDocModal(null)}
                    style={{
                      border: 'none',
                      background: 'none',
                      width: '32px',
                      height: '32px',
                      borderRadius: '8px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      cursor: 'pointer',
                      color: '#64748B',
                      backgroundColor: '#F1F5F9'
                    }}
                  >
                    <X size={18} />
                  </button>
                </div>
              </div>
              <div style={{ padding: '20px', flex: 1, overflowY: 'auto', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#F1F5F9', minHeight: '350px' }}>
                {resolvedData ? (
                  isPdf ? (
                    <iframe
                      src={resolvedData}
                      title={docName}
                      style={{ width: '100%', height: '70vh', border: 'none', borderRadius: '8px', backgroundColor: '#FFFFFF' }}
                    />
                  ) : (
                    <img
                      src={resolvedData}
                      alt={docName}
                      style={{ maxWidth: '100%', maxHeight: '70vh', objectFit: 'contain', borderRadius: '8px', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)' }}
                    />
                  )
                ) : (
                  <div style={{ textAlign: 'center', color: '#64748B' }}>
                    <FileText size={40} style={{ opacity: 0.5, marginBottom: '8px' }} />
                    <p style={{ margin: 0, fontWeight: '700' }}>Document preview unavailable or loading...</p>
                    <p style={{ margin: '4px 0 0', fontSize: '12px' }}>{docName}</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        );
      })()}

    </div>
  );
}
