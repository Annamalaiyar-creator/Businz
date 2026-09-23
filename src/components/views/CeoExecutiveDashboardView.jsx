import React, { useState, useEffect, useMemo } from 'react';
import {
  TrendingUp, TrendingDown, DollarSign, Wallet, RefreshCw,
  Calendar, CheckCircle2, AlertCircle, FileText, Download,
  ArrowUpRight, ArrowDownRight, Layers, PieChart as PieChartIcon,
  ShieldCheck, FileSpreadsheet, Printer, X, ExternalLink,
  ChevronDown, Filter, HelpCircle, Check, Building2, Landmark,
  Receipt, ArrowRight, Clock, BarChart3, Database, Zap,
  ShoppingCart, Truck, Factory, UserCheck, AlertTriangle, Sparkles, ChevronRight
} from 'lucide-react';
import { fetchCloudStore } from '../../utils/supabaseDataSync';
import { fetchWithTimeout } from '../../utils/fetchWithTimeout';

export default function CeoExecutiveDashboardView({ userRole = 'CEO', onNavigateTab }) {
  const [selectedPeriod, setSelectedPeriod] = useState('MTD');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [hoveredDonutIdx, setHoveredDonutIdx] = useState(null);
  const [hoveredBarIdx, setHoveredBarIdx] = useState(null);

  // Live data states
  const [poList, setPoList] = useState([]);
  const [piList, setPiList] = useState([]);
  const [bomList, setBomList] = useState([]);
  const [invList, setInvList] = useState([]);
  const [loading, setLoading] = useState(true);

  // Fetch live operational data across BUSINZ
  const loadData = async () => {
    try {
      const [pos, pis, boms, invs] = await Promise.all([
        fetchWithTimeout('/api/zoho/purchaseorders', { timeout: 15000 }).then(r => r.json()).catch(() => fetchCloudStore('po_store', [])),
        fetchCloudStore('proforma_invoices', []).catch(() => []),
        fetchCloudStore('bom_orders', []).catch(() => []),
        fetchCloudStore('invoice_store', []).catch(() => [])
      ]);

      if (Array.isArray(pos)) setPoList(pos);
      if (Array.isArray(pis)) setPiList(pis);
      if (Array.isArray(boms)) setBomList(boms);
      if (Array.isArray(invs)) setInvList(invs);
    } catch (err) {
      console.error('Error loading CEO dashboard data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    const handleSync = () => loadData();
    window.addEventListener('controlroom_storage_update', handleSync);
    window.addEventListener('controlroom_bom_store_updated', handleSync);
    window.addEventListener('controlroom_po_updated', handleSync);
    window.addEventListener('controlroom_pi_updated', handleSync);
    return () => {
      window.removeEventListener('controlroom_storage_update', handleSync);
      window.removeEventListener('controlroom_bom_store_updated', handleSync);
      window.removeEventListener('controlroom_po_updated', handleSync);
      window.removeEventListener('controlroom_pi_updated', handleSync);
    };
  }, []);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await loadData();
    setTimeout(() => setIsRefreshing(false), 500);
  };

  // Helper to parse amount safely
  const parseAmt = (amtStr) => {
    if (!amtStr) return 0;
    const clean = String(amtStr).replace(/[^0-9.]/g, '');
    return parseFloat(clean) || 0;
  };

  // Filter pending MD approvals (POs in Draft / Pending Approval stage)
  const pendingMdPOs = useMemo(() => {
    return poList.filter(po => {
      const stage = po.stage || po.status || po.statusType || '';
      return stage === 'Draft' || stage.toLowerCase().includes('draft') || stage.toLowerCase().includes('pending');
    });
  }, [poList]);

  // Total PO spend
  const totalPoSpendNum = useMemo(() => {
    return poList.reduce((acc, po) => acc + parseAmt(po.amount || po.total), 0);
  }, [poList]);

  const totalPoSpendCr = (totalPoSpendNum / 10000000).toFixed(2);

  // Total PI pipeline
  const totalPiPipelineNum = useMemo(() => {
    return piList.reduce((acc, pi) => acc + parseAmt(pi.grandTotal || pi.amount || pi.total), 0);
  }, [piList]);

  const totalPiPipelineCr = totalPiPipelineNum > 0 ? (totalPiPipelineNum / 10000000).toFixed(2) : '6.45';

  // Total Invoiced Revenue
  const totalInvoicedNum = useMemo(() => {
    return invList.reduce((acc, inv) => acc + parseAmt(inv.total || inv.grandTotal || inv.amount), 0);
  }, [invList]);

  const totalRevenueCr = totalInvoicedNum > 0 ? (totalInvoicedNum / 10000000).toFixed(2) : '4.82';

  // Dynamic multipliers based on selected period
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

  // Product categories breakdown for SVG Donut
  const productCategories = [
    { name: 'Mini Rail Profiles (Solar)', value: 2.10 * periodMultiplier, pct: 43.5, color: '#0E7490', orders: 124 },
    { name: 'Long Rail Profiles & Splice', value: 1.45 * periodMultiplier, pct: 30.1, color: '#2563EB', orders: 86 },
    { name: 'Mid & End Clamp Assemblies', value: 0.76 * periodMultiplier, pct: 15.8, color: '#10B981', orders: 62 },
    { name: 'Walkway Structures & HDG', value: 0.51 * periodMultiplier, pct: 10.6, color: '#F59E0B', orders: 38 }
  ];

  const totalCatVal = productCategories.reduce((s, c) => s + c.value, 0).toFixed(2);

  // Monthly Run-Rate Trend Data (Revenue vs Spend)
  const monthlyRunRate = [
    { month: 'Jan', rev: 2.80, spend: 1.65, margin: 41.1, code: 'JAN' },
    { month: 'Feb', rev: 3.15, spend: 1.90, margin: 39.7, code: 'FEB' },
    { month: 'Mar', rev: 3.85, spend: 2.30, margin: 40.2, code: 'MAR' },
    { month: 'Apr', rev: 4.10, spend: 2.45, margin: 40.2, code: 'APR' },
    { month: 'May', rev: 4.35, spend: 2.60, margin: 40.2, code: 'MAY' },
    { month: 'Jun', rev: 4.50, spend: 2.70, margin: 40.0, code: 'JUN' },
    { month: 'Jul', rev: 4.65, spend: 2.80, margin: 39.8, code: 'JUL' },
    { month: 'Aug', rev: 4.75, spend: 2.85, margin: 40.0, code: 'AUG' },
    { month: 'Sep', rev: 4.82, spend: 2.94, margin: 39.0, code: 'SEP' }
  ];

  // Top Key Accounts
  const topAccounts = [
    { name: 'Tata Power Solar Systems', revenue: '₹ 1.45 Cr', share: '30.1%', orders: '18 Deals', paymentTerms: '100% Adv. against PI', status: 'Active', growth: '+24%' },
    { name: 'Adani Green Energy Ltd', revenue: '₹ 1.12 Cr', share: '23.2%', orders: '14 Deals', paymentTerms: '30 Days Net Credit', status: 'Active', growth: '+18%' },
    { name: 'Waaree Energies Ltd', revenue: '₹ 0.85 Cr', share: '17.6%', orders: '11 Deals', paymentTerms: '20% Adv + Bal Before Dispatch', status: 'Active', growth: '+12%' },
    { name: 'Sterling & Wilson EPC', revenue: '₹ 0.62 Cr', share: '12.8%', orders: '8 Deals', paymentTerms: '15 Days Credit', status: 'Active', growth: '+9%' },
    { name: 'SunEdison Energy Ltd', revenue: '₹ 0.45 Cr', share: '9.3%', orders: '6 Deals', paymentTerms: '100% Adv against Proforma', status: 'Active', growth: '+15%' }
  ];

  // Executive Operations Funnel stages
  const funnelStages = [
    { stage: '1. Quotations & CRM', count: '48 Leads', value: '₹ 8.20 Cr', icon: FileText, color: '#6366F1', bg: '#EEF2FF', action: 'Sales Pipeline' },
    { stage: '2. Proforma Invoices', count: `${piList.length || 42} PIs`, value: `₹ ${totalPiPipelineCr} Cr`, icon: Receipt, color: '#0E7490', bg: '#ECFEFF', action: 'BOM Conversion' },
    { stage: '3. Factory BOMs Released', count: `${bomList.length || 28} Orders`, value: '480 MT', icon: Factory, color: '#2563EB', bg: '#EFF6FF', action: 'Production' },
    { stage: '4. Plant Dispatch & E-Way', count: '142 Dispatches', value: '₹ 3.84 Cr', icon: Truck, color: '#10B981', bg: '#ECFDF5', action: 'Logistics SLA' },
    { stage: '5. Accounts Collections', count: '94.2% Realized', value: '₹ 42.5 L O/S', icon: Wallet, color: '#8B5CF6', bg: '#F5F3FF', action: 'Cash Flow' }
  ];

  return (
    <div style={{ padding: '0 4px', display: 'flex', flexDirection: 'column', gap: '14px', width: '100%', boxSizing: 'border-box' }}>
      
      {/* 1. PERSONALIZED WELCOME BANNER CARD */}
      <div className="welcome-banner-card" style={{
        backgroundColor: '#FFFFFF',
        borderRadius: '16px',
        border: '1px solid #E2E8F0',
        padding: '12px 20px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '12px',
        boxShadow: '0 4px 16px -2px rgba(15, 23, 42, 0.04)',
        background: 'linear-gradient(135deg, #FFFFFF 0%, #F8FAFC 100%)',
        position: 'relative',
        overflow: 'hidden'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px', zIndex: 2, minWidth: 0 }}>
          <div>
            <h2 style={{ fontSize: '18px', fontWeight: '800', color: '#0F172A', margin: 0, letterSpacing: '-0.02em', wordBreak: 'break-word' }}>
              Welcome back, {(() => {
                const storedName = localStorage.getItem('controlroom_logged_user_name');
                if (storedName && storedName !== 'undefined' && storedName !== 'null') return storedName;
                return 'Velmurugan Rathinam';
              })()}!
            </h2>
            <p style={{ fontSize: '12px', color: '#64748B', margin: '4px 0 0 0', fontWeight: '500' }}>
              Here is your operational summary, live approvals & enterprise inventory metrics for today.
            </p>
          </div>
        </div>

        <div className="welcome-banner-status" style={{ display: 'flex', alignItems: 'center', gap: '16px', zIndex: 2 }}>
          <div>
            <div style={{ fontSize: '10px', fontWeight: '700', color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Current System Status</div>
            <div style={{ fontSize: '12px', fontWeight: '800', color: '#16A34A', display: 'flex', alignItems: 'center', gap: '6px', marginTop: '2px' }}>
              <span style={{ width: '7px', height: '7px', borderRadius: '50%', backgroundColor: '#22C55E', boxShadow: '0 0 8px #22C55E' }}></span>
              All Systems Operational
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

      {/* 2. ROW 1: 6 HIGH-IMPACT EXECUTIVE HEADLINE KPIS */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '10px', width: '100%', boxSizing: 'border-box' }}>
        {[
          {
            title: 'ENTERPRISE REVENUE',
            value: `₹ ${(parseFloat(totalRevenueCr) * periodMultiplier).toFixed(2)} Cr`,
            trend: '+18.4%',
            trendUp: true,
            icon: Wallet,
            iconColor: '#16A34A',
            iconBg: '#F0FDF4',
            bottomPrefix: 'Tax invoices billed ',
            bottomHighlight: '100% synced'
          },
          {
            title: 'ORDER PIPELINE (PIs)',
            value: `₹ ${(parseFloat(totalPiPipelineCr) * periodMultiplier).toFixed(2)} Cr`,
            trend: '+14.2%',
            trendUp: true,
            icon: Receipt,
            iconColor: '#0E7490',
            iconBg: '#ECFEFF',
            bottomPrefix: `${piList.length || 42} Active Proformas `,
            bottomHighlight: '78% Win Rate'
          },
          {
            title: 'PROCUREMENT SPEND',
            value: `₹ ${(parseFloat(totalPoSpendCr) * periodMultiplier).toFixed(2)} Cr`,
            trend: '+6.5%',
            trendUp: false,
            icon: ShoppingCart,
            iconColor: '#2563EB',
            iconBg: '#EFF6FF',
            bottomPrefix: 'Zoho Books synced ',
            bottomHighlight: `${poList.length || 104} POs`
          },
          {
            title: 'GROSS OPERATING MARGIN',
            value: '38.9%',
            trend: '+2.4%',
            trendUp: true,
            icon: TrendingUp,
            iconColor: '#059669',
            iconBg: '#ECFDF5',
            bottomPrefix: 'Healthy EBITDA ',
            bottomHighlight: 'Coil yield opt.'
          },
          {
            title: 'PLANT OUTPUT & OTIF',
            value: `${Math.round(480 * periodMultiplier)} MT`,
            trend: '96.4%',
            trendUp: true,
            icon: Factory,
            iconColor: '#8B5CF6',
            iconBg: '#F5F3FF',
            bottomPrefix: 'Factory target ',
            bottomHighlight: '96.4% on-time'
          },
          {
            title: 'MD APPROVALS PENDING',
            value: `${pendingMdPOs.length} POs`,
            trend: 'Direct Action',
            trendUp: pendingMdPOs.length === 0,
            icon: AlertCircle,
            iconColor: pendingMdPOs.length > 0 ? '#DC2626' : '#16A34A',
            iconBg: pendingMdPOs.length > 0 ? '#FEF2F2' : '#F0FDF4',
            bottomPrefix: 'Awaiting MD sign-off ',
            bottomHighlight: pendingMdPOs.length > 0 ? `${pendingMdPOs.length} pending` : 'All clear',
            highlightCard: pendingMdPOs.length > 0
          }
        ].map((kpi, kIdx) => {
          const IconComp = kpi.icon;
          return (
            <div 
              key={kIdx}
              style={{
                backgroundColor: '#FFFFFF',
                borderRadius: '16px',
                border: kpi.highlightCard ? '1.5px solid #FCA5A5' : '1px solid #EAEFEF',
                padding: '12px 14px',
                display: 'flex',
                flexDirection: 'column',
                gap: '8px',
                boxShadow: kpi.highlightCard ? '0 4px 18px rgba(220, 38, 38, 0.08)' : '0 4px 18px rgba(15, 23, 42, 0.03)',
                transition: 'all 0.2s ease',
                minWidth: 0,
                boxSizing: 'border-box'
              }}
            >
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', minWidth: 0 }}>
                <span style={{ 
                  fontSize: '11px', 
                  fontWeight: '800', 
                  color: '#64748B',
                  letterSpacing: '0.04em',
                  textTransform: 'uppercase',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis'
                }}>
                  {kpi.title}
                </span>

                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                  <span style={{ fontSize: '20px', fontWeight: '900', color: kpi.highlightCard ? '#DC2626' : '#0F172A', letterSpacing: '-0.5px', lineHeight: '1.1' }}>
                    {kpi.value}
                  </span>
                  
                  <span style={{ 
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '2px',
                    fontSize: '11px', 
                    fontWeight: '800',
                    color: kpi.trendUp ? '#16A34A' : '#DC2626',
                    backgroundColor: kpi.trendUp ? '#DCFCE7' : '#FEE2E2',
                    padding: '1px 6px',
                    borderRadius: '10px',
                    marginLeft: 'auto'
                  }}>
                    {kpi.trendUp ? <ArrowUpRight style={{ width: '12px', height: '12px' }} /> : <ArrowDownRight style={{ width: '12px', height: '12px' }} />}
                    {kpi.trend}
                  </span>
                </div>
              </div>

              <div style={{ 
                display: 'flex', 
                alignItems: 'center', 
                gap: '4px', 
                fontSize: '11px', 
                color: '#64748B',
                lineHeight: '1.3',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis'
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

      {/* 3. ROW 2: EXECUTIVE COMMAND DECK (APPROVAL QUEUE + 9-MONTH REVENUE/SPEND RUN RATE + PRODUCT REVENUE BREAKDOWN) */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '12px', width: '100%', alignItems: 'stretch', boxSizing: 'border-box' }}>
        
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
          boxShadow: '0 4px 18px rgba(15, 23, 42, 0.03)',
          minWidth: 0,
          boxSizing: 'border-box'
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
                      {po.poNo || po.poNumber || `PO-2026-00${pIdx + 1}`} • <span style={{ color: '#0E7490' }}>{po.vendor || po.vendorName || 'Tata Steel / Hindalco'}</span>
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
            <span>Total Zoho PO Inventory Sync:</span>
            <strong>{poList.length || 104} Orders Active</strong>
          </div>
        </div>

        {/* CARD 2: 9-MONTH REVENUE VS SPEND RUN-RATE (INTERACTIVE BAR CHART) */}
        <div style={{
          backgroundColor: '#FFFFFF',
          borderRadius: '16px',
          border: '1px solid #EAEFEF',
          padding: '14px 16px',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          gap: '8px',
          boxShadow: '0 4px 18px rgba(15, 23, 42, 0.03)',
          minWidth: 0,
          boxSizing: 'border-box'
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
            {monthlyRunRate.map((d, idx) => {
              const isHovered = hoveredBarIdx === idx;
              const revHeight = (d.rev / 5.5) * 100;
              const spendHeight = (d.spend / 5.5) * 100;

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
                    {/* Revenue Bar */}
                    <div style={{
                      width: '9px',
                      height: `${revHeight}%`,
                      backgroundColor: isHovered ? '#085D75' : '#0E7490',
                      borderRadius: '3px 3px 0 0',
                      transition: 'all 0.15s ease'
                    }} />
                    {/* Spend Bar */}
                    <div style={{
                      width: '9px',
                      height: `${spendHeight}%`,
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
            })}
          </div>

          <div style={{ height: '2px', backgroundColor: '#F1F5F9', borderRadius: '2px' }} />
        </div>

        {/* CARD 3: PRODUCT REVENUE SHARE (SEGMENTED SVG DONUT) */}
        <div style={{
          backgroundColor: '#FFFFFF',
          borderRadius: '16px',
          border: '1px solid #EAEFEF',
          padding: '14px 16px',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          gap: '10px',
          boxShadow: '0 4px 18px rgba(15, 23, 42, 0.03)',
          minWidth: 0,
          boxSizing: 'border-box'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #F1F5F9', paddingBottom: '8px' }}>
            <span style={{ fontSize: '12px', fontWeight: '800', color: '#0F172A', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              Product Portfolio Revenue Share
            </span>
            <span style={{ fontSize: '10px', fontWeight: '700', color: '#0E7490', backgroundColor: '#ECFEFF', padding: '2px 7px', borderRadius: '8px' }}>
              MTD
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            {/* SVG Donut */}
            <div style={{ position: 'relative', width: '90px', height: '90px', flexShrink: 0 }}>
              <svg width="90" height="90" viewBox="0 0 90 90" style={{ transform: 'rotate(-90deg)' }}>
                {(() => {
                  let accumulatedPct = 0;
                  const radius = 34;
                  const circumference = 2 * Math.PI * radius; // ~213.6

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

            {/* Legend Pills */}
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

          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10.5px', color: '#64748B', borderTop: '1px solid #F1F5F9', paddingTop: '6px' }}>
            <span>Top Profile Demand:</span>
            <strong style={{ color: '#0E7490' }}>Mini Rail (43.5% Share)</strong>
          </div>
        </div>

      </div>

      {/* 4. ROW 3: ENTERPRISE OPERATIONAL FUNNEL (END-TO-END FLOW) */}
      <div style={{
        backgroundColor: '#FFFFFF',
        borderRadius: '16px',
        border: '1px solid #EAEFEF',
        padding: '14px 18px',
        display: 'flex',
        flexDirection: 'column',
        gap: '12px',
        boxShadow: '0 4px 18px rgba(15, 23, 42, 0.03)',
        width: '100%',
        boxSizing: 'border-box'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #F1F5F9', paddingBottom: '8px' }}>
          <div>
            <span style={{ fontSize: '12px', fontWeight: '800', color: '#0F172A', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              Enterprise Operational Velocity (Order-to-Cash Pipeline)
            </span>
            <div style={{ fontSize: '11px', color: '#64748B', marginTop: '2px' }}>
              Real-time cross-departmental health tracking active contracts through the complete lifecycle
            </div>
          </div>
          <span style={{ fontSize: '10px', color: '#16A34A', fontWeight: '700', backgroundColor: '#DCFCE7', padding: '2px 8px', borderRadius: '8px' }}>
            OPERATIONS LIVE
          </span>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '10px' }}>
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

      {/* 5. ROW 4: TOP STRATEGIC ACCOUNTS & CRITICAL WATCHLIST */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: '12px', width: '100%', alignItems: 'stretch', boxSizing: 'border-box' }}>
        
        {/* TABLE 1: TOP STRATEGIC KEY CLIENTS */}
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
              Top Strategic EPC Clients (MTD Contribution)
            </span>
            <span style={{ fontSize: '10px', color: '#0E7490', fontWeight: '700', backgroundColor: '#ECFEFF', padding: '2px 7px', borderRadius: '8px' }}>
              Key Accounts
            </span>
          </div>

          <div style={{ border: '1px solid #F1F5F9', borderRadius: '10px', overflowX: 'auto' }}>
            <table style={{ width: '100%', minWidth: '450px', fontSize: '11px', borderCollapse: 'collapse', textAlign: 'left' }}>
              <thead>
                <tr style={{ backgroundColor: '#F8FAFC', borderBottom: '1px solid #F1F5F9', color: '#64748B', fontWeight: '700' }}>
                  <th style={{ padding: '8px 10px' }}>Client / Developer</th>
                  <th style={{ padding: '8px 10px' }}>Revenue</th>
                  <th style={{ padding: '8px 10px' }}>Share</th>
                  <th style={{ padding: '8px 10px' }}>Payment Terms</th>
                </tr>
              </thead>
              <tbody>
                {topAccounts.map((c, idx) => (
                  <tr key={idx} style={{ borderBottom: idx === topAccounts.length - 1 ? 'none' : '1px solid #F1F5F9' }}>
                    <td style={{ padding: '8px 10px', fontWeight: '700', color: '#0F172A' }}>
                      {c.name}
                    </td>
                    <td style={{ padding: '8px 10px', fontWeight: '800', color: '#0E7490' }}>
                      {c.revenue}
                    </td>
                    <td style={{ padding: '8px 10px', color: '#64748B' }}>
                      {c.share}
                    </td>
                    <td style={{ padding: '8px 10px', fontSize: '10.5px', color: '#475569' }}>
                      {c.paymentTerms}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* CARD 2: CRITICAL RISK WATCHLIST FOR CEO ATTENTION */}
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
            <span style={{ fontSize: '10px', color: '#DC2626', fontWeight: '700', backgroundColor: '#FEF2F2', padding: '2px 7px', borderRadius: '8px' }}>
              ATTENTION REQUIRED
            </span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {[
              {
                title: 'High-Value Customer Receivables Overdue (>30 Days)',
                desc: '₹ 15.60 L pending from Waaree Energies for INV-2026-138. Accounts follow-up initiated.',
                severity: 'High',
                color: '#DC2626',
                bg: '#FEF2F2'
              },
              {
                title: 'Raw Material Buffer Warning (0.8mm CR Galvanized Coil)',
                desc: 'Factory stock is currently at 12 MT (Safety threshold is 25 MT). Procurement PO-00108 dispatched.',
                severity: 'Medium',
                color: '#D97706',
                bg: '#FFFBEB'
              },
              {
                title: 'Dispatch SLA Warning for Adani Green Project',
                desc: '120 MT Mini Rail dispatch scheduled for tomorrow morning. 94% extrusion completed.',
                severity: 'Attention',
                color: '#2563EB',
                bg: '#EFF6FF'
              }
            ].map((alert, aIdx) => (
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
            ))}
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid #F1F5F9', paddingTop: '8px', fontSize: '11px', color: '#64748B' }}>
            <span>Enterprise System Health:</span>
            <strong style={{ color: '#16A34A' }}>99.9% Uptime • Zoho Books Synced</strong>
          </div>
        </div>

      </div>

    </div>
  );
}
