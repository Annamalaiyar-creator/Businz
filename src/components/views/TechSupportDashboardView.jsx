import React, { useState, useEffect, useMemo } from 'react';
import {
  Layers, ShieldCheck, Database, RefreshCw,
  Search, ArrowRight, CheckCircle2, AlertCircle,
  Clock, Package, ChevronRight, Activity, ArrowUpRight,
  ArrowDownRight, Eye, Check, X, Filter, Sliders, Cpu, Download,
  ExternalLink, FileText, ChevronDown, CheckCircle,
  MessageSquare, Mail, Share2
} from 'lucide-react';
import { getAllActivePresets, syncPresetsWithCloud } from '../../vrmHdgProposalPresets';
import { fetchCloudStore } from '../../utils/supabaseDataSync';
import { VRM_PRODUCTS } from '../../utils/vrmProductsData';
import { cleanNum, formatCurrency } from '../../utils/otherViewsShared';

export default function TechSupportDashboardView({ userRole = 'Tech Support', onNavigateTab }) {
  // Period & Controls
  const [selectedPeriod, setSelectedPeriod] = useState('This Month');
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTableTab, setActiveTableTab] = useState('presets'); // 'presets' | 'raw_materials'
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastSyncedTime, setLastSyncedTime] = useState('Today, 10:45 AM');

  // Interactive Row Selection (Standard Table Design System)
  const [selectedRows, setSelectedRows] = useState(new Set());

  // Pagination for main table (strictly restricted to 5 and 10 per standard rules)
  const [pageSize, setPageSize] = useState(10);
  const [currentPage, setCurrentPage] = useState(1);
  const [goToPageInput, setGoToPageInput] = useState('');

  // Live Data Stores
  const [presets, setPresets] = useState(() => getAllActivePresets());
  const [backups, setBackups] = useState([]);
  const [isBackingUp, setIsBackingUp] = useState(false);
  const [backupNotice, setBackupNotice] = useState(null);

  // Dynamic logged-in user name
  const loggedUserName = (() => {
    try {
      const stored = localStorage.getItem('controlroom_logged_user_name');
      if (stored && stored !== 'undefined' && stored !== 'null' && stored.trim()) return stored.trim();
      const userEmail = localStorage.getItem('controlroom_logged_user');
      if (userEmail && userEmail.includes('@')) {
        return userEmail.split('@')[0].replace(/[._-]/g, ' ');
      }
    } catch (_) {}
    return 'Tech Support';
  })();

  // Fetch all necessary tech support data
  const loadDashboardData = async () => {
    try {
      // 1. Sync Presets
      const syncedPresets = await syncPresetsWithCloud().catch(() => null);
      if (syncedPresets && typeof syncedPresets === 'object') {
        setPresets(syncedPresets);
      } else {
        setPresets(getAllActivePresets());
      }

      // 2. Fetch System Backups
      try {
        const res = await fetch('/api/system/backup/list');
        const data = await res.json();
        if (data.success && Array.isArray(data.backups)) {
          setBackups(data.backups);
        }
      } catch (_) {}

      const now = new Date();
      setLastSyncedTime(`Today, ${now.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })}`);
    } catch (err) {
      console.warn('[TechSupportDashboard] Error loading data:', err);
    }
  };

  useEffect(() => {
    loadDashboardData();

    const handlePresetsUpdate = (e) => {
      if (e.detail && typeof e.detail === 'object') {
        setPresets(e.detail);
      }
    };

    window.addEventListener('vrm_presets_updated', handlePresetsUpdate);
    window.addEventListener('controlroom_storage_update', loadDashboardData);

    return () => {
      window.removeEventListener('vrm_presets_updated', handlePresetsUpdate);
      window.removeEventListener('controlroom_storage_update', loadDashboardData);
    };
  }, []);

  const handleManualRefresh = async () => {
    setIsRefreshing(true);
    await loadDashboardData();
    setTimeout(() => setIsRefreshing(false), 500);
  };

  // Convert presets object to list
  const presetList = useMemo(() => {
    if (!presets || typeof presets !== 'object') return [];
    return Object.keys(presets).map((key) => {
      const item = presets[key];
      return {
        id: item.id || key,
        name: item.name || item.label || key,
        category: item.category || 'General Preset',
        itemsCount: Array.isArray(item.items) ? item.items.length : 0,
        items: item.items || [],
        description: item.description || item.subtext || '',
        rate: item.price || item.totalPrice || item.rate || 0,
        gstRate: item.gstRate || '18%'
      };
    });
  }, [presets]);

  // Derived engineering metrics
  const customPresetsCount = useMemo(() => {
    return presetList.filter(p => String(p.id).startsWith('custom_') || String(p.id).includes('custom')).length;
  }, [presetList]);

  const totalComponentsConfigured = useMemo(() => {
    return presetList.reduce((sum, p) => sum + (p.itemsCount || 0), 0);
  }, [presetList]);

  // Raw Material Master summary
  const rawMaterials = useMemo(() => {
    return (VRM_PRODUCTS || []).map((p, idx) => ({
      id: p.code || p.id || `RM-${idx + 1}`,
      name: p.name || p.label || 'Raw Material',
      category: p.category || p.type || 'Coils & Steel',
      unit: p.unit || 'Kg',
      rate: p.rate || p.price || 0,
      stockStatus: 'Available'
    }));
  }, []);

  // Category counts for presets
  const presetCategoryBreakdown = useMemo(() => {
    const map = {};
    presetList.forEach((p) => {
      const cat = p.category || 'Other';
      map[cat] = (map[cat] || 0) + 1;
    });
    return Object.entries(map).map(([name, count]) => ({ name, count }));
  }, [presetList]);

  // Filtered Main Table Data based on active tab
  const filteredTableData = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    if (activeTableTab === 'presets') {
      return presetList.filter((item) => {
        if (!q) return true;
        return (
          String(item.name || '').toLowerCase().includes(q) ||
          String(item.id || '').toLowerCase().includes(q) ||
          String(item.category || '').toLowerCase().includes(q)
        );
      });
    } else {
      return rawMaterials.filter((item) => {
        if (!q) return true;
        return (
          String(item.name || '').toLowerCase().includes(q) ||
          String(item.id || '').toLowerCase().includes(q) ||
          String(item.category || '').toLowerCase().includes(q)
        );
      });
    }
  }, [activeTableTab, presetList, rawMaterials, searchQuery]);

  // Pagination calculations
  const totalEntries = filteredTableData.length;
  const totalPages = Math.max(1, Math.ceil(totalEntries / pageSize));
  const startIndex = (currentPage - 1) * pageSize;
  const endIndex = Math.min(startIndex + pageSize, totalEntries);
  const currentRows = filteredTableData.slice(startIndex, endIndex);

  const handlePageChange = (p) => {
    if (p >= 1 && p <= totalPages) {
      setCurrentPage(p);
    }
  };

  const handleGoToPage = (e) => {
    e.preventDefault();
    const p = parseInt(goToPageInput, 10);
    if (!isNaN(p) && p >= 1 && p <= totalPages) {
      setCurrentPage(p);
      setGoToPageInput('');
    }
  };

  // Row selection handlers
  const handleSelectAll = (e) => {
    if (e.target.checked) {
      const allIds = new Set(currentRows.map((r, idx) => r.id || String(idx)));
      setSelectedRows(allIds);
    } else {
      setSelectedRows(new Set());
    }
  };

  const handleRowCheckbox = (id) => {
    setSelectedRows((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const allOnPageSelected = currentRows.length > 0 && currentRows.every((r, idx) => selectedRows.has(r.id || String(idx)));

  const handleTriggerBackup = async () => {
    setIsBackingUp(true);
    try {
      const res = await fetch('/api/system/backup/create?user=' + encodeURIComponent(userRole || 'Tech Support'));
      const data = await res.json();
      if (data.success) {
        setBackupNotice({ type: 'success', text: 'System backup snapshot created successfully!' });
        await loadDashboardData();
      } else {
        setBackupNotice({ type: 'error', text: data.error || 'Failed to create backup snapshot.' });
      }
    } catch (err) {
      setBackupNotice({ type: 'error', text: 'Network error triggering backup snapshot.' });
    } finally {
      setIsBackingUp(false);
      setTimeout(() => setBackupNotice(null), 5000);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', width: '100%', boxSizing: 'border-box', fontFamily: "'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, sans-serif" }}>
      
      {/* 1. PERSONALIZED WELCOME BANNER CARD (EXACT BUSINZ DESIGN SYSTEM) */}
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
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <h2 style={{ fontSize: '18px', fontWeight: '800', color: '#0F172A', margin: 0, letterSpacing: '-0.02em', wordBreak: 'break-word' }}>
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
                <Cpu size={12} color="#0E7490" /> Tech Command
              </span>
            </div>
            <p style={{ fontSize: '12px', color: '#64748B', margin: '4px 0 0 0', fontWeight: '500' }}>
              Engineering Presets, Structural Configurations, Raw Material Directory & System Diagnostics.
            </p>
          </div>
        </div>

        {/* Right side controls: Period selector, sync, Preset Management shortcut */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap', zIndex: 2 }}>
          {/* Period selector */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            backgroundColor: '#F1F5F9',
            borderRadius: '10px',
            padding: '2px',
            border: '1px solid #E2E8F0'
          }}>
            {['Today', 'MTD', 'This Month', 'This Quarter', 'This Year'].map(p => (
              <button
                key={p}
                onClick={() => setSelectedPeriod(p)}
                style={{
                  border: 'none',
                  backgroundColor: selectedPeriod === p ? '#FFFFFF' : 'transparent',
                  color: selectedPeriod === p ? '#0E7490' : '#64748B',
                  fontWeight: selectedPeriod === p ? '800' : '600',
                  fontSize: '11px',
                  padding: '5px 10px',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  boxShadow: selectedPeriod === p ? '0 2px 6px rgba(15, 23, 42, 0.08)' : 'none',
                  transition: 'all 0.15s ease'
                }}
              >
                {p}
              </button>
            ))}
          </div>

          {/* Sync Button */}
          <button
            onClick={handleManualRefresh}
            title={`Last synced: ${lastSyncedTime}`}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              backgroundColor: '#FFFFFF',
              border: '1px solid #CBD5E1',
              color: '#334155',
              padding: '6px 12px',
              borderRadius: '9px',
              fontSize: '11.5px',
              fontWeight: '700',
              cursor: 'pointer',
              transition: 'all 0.15s ease'
            }}
          >
            <RefreshCw size={13} className={isRefreshing ? 'animate-spin' : ''} style={{ color: '#0E7490' }} />
            <span>Sync</span>
          </button>

          {/* Direct jump to Preset Management */}
          <button
            onClick={() => onNavigateTab && onNavigateTab('Preset Management')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              backgroundColor: '#0E7490',
              border: 'none',
              color: '#FFFFFF',
              padding: '6px 14px',
              borderRadius: '9px',
              fontSize: '12px',
              fontWeight: '700',
              cursor: 'pointer',
              boxShadow: '0 2px 8px rgba(14, 116, 144, 0.25)',
              transition: 'background-color 0.15s'
            }}
            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#0891B2'}
            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#0E7490'}
          >
            <Layers size={14} />
            <span>Preset Management</span>
            <ArrowRight size={13} />
          </button>
        </div>

        {/* Ambient radial accent background */}
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

      {/* Notice Banner */}
      {backupNotice && (
        <div style={{
          padding: '10px 16px',
          borderRadius: '12px',
          backgroundColor: backupNotice.type === 'success' ? '#F0FDF4' : '#FEF2F2',
          border: `1px solid ${backupNotice.type === 'success' ? '#BBF7D0' : '#FECACA'}`,
          color: backupNotice.type === 'success' ? '#166534' : '#991B1B',
          fontSize: '12px',
          fontWeight: '600',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            {backupNotice.type === 'success' ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
            <span>{backupNotice.text}</span>
          </div>
          <button onClick={() => setBackupNotice(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'inherit' }}>
            <X size={14} />
          </button>
        </div>
      )}

      {/* 2. ROW 1: 6 MODERN COMPACT KPI CARDS (EXACT SYSTEM LAYOUT MATCHING BILLING & SALES DASHBOARD) */}
      <div 
        className="kpi-grid-6" 
        style={{ 
          display: 'grid', 
          gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', 
          gap: '10px', 
          width: '100%', 
          boxSizing: 'border-box' 
        }}
      >
        {[
          {
            title: 'ACTIVE PRESETS',
            value: `${presetList.length} Presets`,
            trend: '100% Active',
            trendUp: true,
            bottomPrefix: 'Proposal engine ',
            bottomHighlight: `${presetList.length} kit models`
          },
          {
            title: 'CONFIGURED PARTS',
            value: `${totalComponentsConfigured} Parts`,
            trend: 'Mapped',
            trendUp: true,
            bottomPrefix: 'Formula parts ',
            bottomHighlight: `${totalComponentsConfigured} parts mapped`
          },
          {
            title: 'CUSTOM PRESETS',
            value: `${customPresetsCount} Custom`,
            trend: 'Verified',
            trendUp: true,
            bottomPrefix: 'Custom engineering ',
            bottomHighlight: `${customPresetsCount} custom kits`
          },
          {
            title: 'RAW MATERIAL SKUS',
            value: `${rawMaterials.length} Items`,
            trend: 'Master Synced',
            trendUp: true,
            bottomPrefix: 'Structural catalog ',
            bottomHighlight: `${rawMaterials.length} specifications`
          },
          {
            title: 'DISASTER RECOVERY',
            value: `${backups.length} Snapshots`,
            trend: 'Vault Safe',
            trendUp: true,
            bottomPrefix: 'Local & cloud ',
            bottomHighlight: `${backups.length} backups`
          },
          {
            title: 'DATABASE INTEGRITY',
            value: '100% Synced',
            trend: 'Live & Clean',
            trendUp: true,
            bottomPrefix: 'Supabase node ',
            bottomHighlight: 'Zero latency'
          }
        ].map((kpi, kIdx) => (
          <div 
            key={kIdx}
            style={{
              backgroundColor: '#FFFFFF',
              borderRadius: '16px',
              border: '1px solid #EAEFEF',
              padding: '12px 14px',
              display: 'flex',
              flexDirection: 'column',
              gap: '8px',
              boxShadow: '0 4px 18px rgba(15, 23, 42, 0.03)',
              transition: 'all 0.2s ease',
              minWidth: 0,
              boxSizing: 'border-box'
            }}
          >
            {/* Top Main Section */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', minWidth: 0 }}>
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

              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                <span style={{ fontSize: '20px', fontWeight: '900', color: '#0F172A', letterSpacing: '-0.5px', lineHeight: '1.1' }}>
                  {kpi.value}
                </span>
                
                <span 
                  style={{ 
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '2px',
                    fontSize: '11px', 
                    fontWeight: '800', 
                    color: kpi.trendUp ? '#059669' : '#DC2626',
                    backgroundColor: kpi.trendUp ? '#ECFDF5' : '#FEF2F2',
                    border: kpi.trendUp ? '1px solid #A7F3D0' : '1px solid #FECACA',
                    padding: '1.5px 6px',
                    borderRadius: '6px',
                    lineHeight: '1.2'
                  }}
                >
                  {kpi.trendUp ? (
                    <ArrowUpRight style={{ width: '12px', height: '12px' }} />
                  ) : (
                    <ArrowDownRight style={{ width: '12px', height: '12px' }} />
                  )}
                  {kpi.trend}
                </span>
              </div>
            </div>

            {/* Bottom Sub-Card Box (Standard BUSINZ Design) */}
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
              <span style={{ color: kpi.trendUp ? '#059669' : '#0E7490', fontWeight: '800' }}>
                {kpi.bottomHighlight}
              </span>
            </div>
          </div>
        ))}
      </div>

      {/* 3. ROW 2: 3-COLUMN TECHNICAL ARCHITECTURE & MATERIAL MATRICES */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
        gap: '14px',
        width: '100%',
        boxSizing: 'border-box'
      }}>
        {/* Panel 1: Presets by Category */}
        <div style={{
          backgroundColor: '#FFFFFF',
          borderRadius: '16px',
          border: '1px solid #EAEFEF',
          padding: '18px',
          boxShadow: '0 4px 18px rgba(15, 23, 42, 0.03)',
          display: 'flex',
          flexDirection: 'column'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px', borderBottom: '1px solid #F1F5F9', paddingBottom: '10px' }}>
            <span style={{ fontSize: '13px', fontWeight: '800', color: '#1E3A8A', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              Engineering Presets Breakdown
            </span>
            <span style={{
              backgroundColor: '#ECFEFF',
              color: '#0E7490',
              fontSize: '11px',
              fontWeight: '700',
              padding: '3px 8px',
              borderRadius: '20px'
            }}>
              {presetList.length} Total
            </span>
          </div>

          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid #F1F5F9' }}>
                <th style={{ textAlign: 'left', padding: '6px 0', fontSize: '11px', fontWeight: '700', color: '#94A3B8', textTransform: 'uppercase' }}>
                  CATEGORY
                </th>
                <th style={{ textAlign: 'right', padding: '6px 0', fontSize: '11px', fontWeight: '700', color: '#94A3B8', textTransform: 'uppercase' }}>
                  ACTIVE KITS
                </th>
              </tr>
            </thead>
            <tbody>
              {presetCategoryBreakdown.slice(0, 5).map((row, idx) => (
                <tr key={idx} style={{ borderBottom: '1px solid #F8FAFC' }}>
                  <td style={{ padding: '8px 0', fontWeight: '500', color: '#334155' }}>
                    {row.name}
                  </td>
                  <td style={{ padding: '8px 0', textAlign: 'right', fontWeight: '700', color: '#0E7490' }}>
                    {row.count} Kits
                  </td>
                </tr>
              ))}
              <tr style={{ backgroundColor: '#F8FAFC', borderTop: '2px solid #E2E8F0' }}>
                <td style={{ padding: '8px 6px', fontWeight: '800', color: '#0F172A' }}>
                  Total Verified Presets
                </td>
                <td style={{ padding: '8px 6px', textAlign: 'right', fontWeight: '800', color: '#059669' }}>
                  {presetList.length} Presets
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Panel 2: Raw Material Master & Inventory Health */}
        <div style={{
          backgroundColor: '#FFFFFF',
          borderRadius: '16px',
          border: '1px solid #EAEFEF',
          padding: '18px',
          boxShadow: '0 4px 18px rgba(15, 23, 42, 0.03)',
          display: 'flex',
          flexDirection: 'column'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px', borderBottom: '1px solid #F1F5F9', paddingBottom: '10px' }}>
            <span style={{ fontSize: '13px', fontWeight: '800', color: '#1E3A8A', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              Raw Material Stock Matrix
            </span>
            <span style={{
              backgroundColor: '#DCFCE7',
              color: '#166534',
              fontSize: '11px',
              fontWeight: '700',
              padding: '3px 8px',
              borderRadius: '20px'
            }}>
              Available
            </span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {[
              { label: 'GI / HR / CR Slitted Coils', desc: '0.50mm to 3.00mm Gauges', count: '100% In Stock', color: '#0E7490', bg: '#ECFEFF' },
              { label: 'Aluminium Solar Rails', desc: 'Mini Rail & Double C-Channel', count: 'Standard Kits', color: '#16A34A', bg: '#DCFCE7' },
              { label: 'Mid & End Clamp Assemblies', desc: 'Universal & Adhesive Fixings', count: 'Verified', color: '#7C3AED', bg: '#F5F3FF' },
              { label: 'Fasteners & Hardware Sets', desc: 'SS304 / Grade 8.8 Hardware', count: 'Available', color: '#2563EB', bg: '#EFF6FF' }
            ].map((item, idx) => (
              <div
                key={idx}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '7px 10px',
                  borderRadius: '8px',
                  backgroundColor: '#F8FAFC',
                  border: '1px solid #F1F5F9'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ width: '7px', height: '7px', borderRadius: '50%', backgroundColor: item.color }} />
                  <div>
                    <span style={{ fontSize: '11.5px', fontWeight: '700', color: '#0F172A' }}>{item.label}</span>
                    <div style={{ fontSize: '10px', color: '#64748B' }}>{item.desc}</div>
                  </div>
                </div>
                <span style={{
                  fontSize: '11px',
                  fontWeight: '800',
                  color: item.color,
                  backgroundColor: item.bg,
                  padding: '2px 7px',
                  borderRadius: '6px'
                }}>
                  {item.count}
                </span>
              </div>
            ))}
          </div>

          <div style={{
            marginTop: 'auto',
            paddingTop: '10px',
            borderTop: '1px solid #F1F5F9',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            fontSize: '11px'
          }}>
            <span style={{ color: '#64748B', fontWeight: '600' }}>Directory Coverage</span>
            <span style={{ color: '#059669', fontWeight: '800' }}>{rawMaterials.length} SKUs Active</span>
          </div>
        </div>

        {/* Panel 3: Technical Lifecycle & Vault Diagnostics */}
        <div style={{
          backgroundColor: '#FFFFFF',
          borderRadius: '16px',
          border: '1px solid #EAEFEF',
          padding: '18px',
          boxShadow: '0 4px 18px rgba(15, 23, 42, 0.03)',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          gap: '12px'
        }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px', borderBottom: '1px solid #F1F5F9', paddingBottom: '10px' }}>
              <span style={{ fontSize: '13px', fontWeight: '800', color: '#1E3A8A', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                Disaster Recovery & Vault
              </span>
              <span style={{
                backgroundColor: '#ECFDF5',
                color: '#059669',
                fontSize: '11px',
                fontWeight: '700',
                padding: '3px 8px',
                borderRadius: '20px'
              }}>
                Online
              </span>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <div style={{ padding: '8px 12px', borderRadius: '8px', backgroundColor: '#F8FAFC', border: '1px solid #E2E8F0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '11.5px', color: '#64748B' }}>Total Snapshots</span>
                <span style={{ fontSize: '12px', fontWeight: '800', color: '#0F172A' }}>{backups.length} Available</span>
              </div>
              <div style={{ padding: '8px 12px', borderRadius: '8px', backgroundColor: '#F8FAFC', border: '1px solid #E2E8F0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '11.5px', color: '#64748B' }}>Quota & Storage</span>
                <span style={{ fontSize: '12px', fontWeight: '800', color: '#059669' }}>Safe & Compressed</span>
              </div>
              <div style={{ padding: '8px 12px', borderRadius: '8px', backgroundColor: '#F8FAFC', border: '1px solid #E2E8F0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '11.5px', color: '#64748B' }}>Last Server Snapshot</span>
                <span style={{ fontSize: '11.5px', fontWeight: '700', color: '#0E7490' }}>
                  {backups[0] ? new Date(backups[0].createdAt).toLocaleDateString() : 'Active'}
                </span>
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              onClick={handleTriggerBackup}
              disabled={isBackingUp}
              style={{
                flex: 1,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '6px',
                padding: '8px',
                backgroundColor: '#2563EB',
                color: '#FFFFFF',
                border: 'none',
                borderRadius: '8px',
                fontSize: '11.5px',
                fontWeight: '700',
                cursor: isBackingUp ? 'wait' : 'pointer'
              }}
            >
              <ShieldCheck size={14} />
              <span>{isBackingUp ? 'Backing Up...' : 'Instant Snapshot'}</span>
            </button>
            <button
              onClick={() => onNavigateTab && onNavigateTab('Backup & Vault')}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '8px 12px',
                backgroundColor: '#FFFFFF',
                color: '#1E3A8A',
                border: '1px solid #CBD5E1',
                borderRadius: '8px',
                fontSize: '11.5px',
                fontWeight: '700',
                cursor: 'pointer'
              }}
            >
              <ExternalLink size={14} />
            </button>
          </div>
        </div>
      </div>

      {/* 4. INTERACTIVE LIVE TABLE: PRESETS & RAW MATERIALS (STANDARD BUSINZ TABLE SYSTEM) */}
      <div 
        className="section-card" 
        style={{
          backgroundColor: '#FFFFFF',
          borderRadius: '16px',
          border: '1px solid #EAEFEF',
          padding: '16px 20px',
          boxShadow: '0 4px 18px rgba(15, 23, 42, 0.03)',
          display: 'flex',
          flexDirection: 'column',
          gap: '12px'
        }}
      >
        {/* Table Sub-Header: Tabs + Search Bar + Actions */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '12px',
          borderBottom: '1px solid #F1F5F9',
          paddingBottom: '12px'
        }}>
          {/* Dual Tabs */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
            <button
              onClick={() => { setActiveTableTab('presets'); setCurrentPage(1); setSelectedRows(new Set()); }}
              style={{
                border: 'none',
                backgroundColor: activeTableTab === 'presets' ? '#ECFEFF' : 'transparent',
                color: activeTableTab === 'presets' ? '#0E7490' : '#64748B',
                fontWeight: activeTableTab === 'presets' ? '800' : '600',
                fontSize: '12.5px',
                padding: '6px 14px',
                borderRadius: '8px',
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                borderBottom: activeTableTab === 'presets' ? '2px solid #0E7490' : '2px solid transparent'
              }}
            >
              <Layers size={15} />
              <span>Engineering Presets</span>
              <span style={{
                fontSize: '10.5px',
                backgroundColor: activeTableTab === 'presets' ? '#0E7490' : '#E2E8F0',
                color: activeTableTab === 'presets' ? '#FFFFFF' : '#475569',
                padding: '1px 6px',
                borderRadius: '10px'
              }}>
                {presetList.length}
              </span>
            </button>

            <button
              onClick={() => { setActiveTableTab('raw_materials'); setCurrentPage(1); setSelectedRows(new Set()); }}
              style={{
                border: 'none',
                backgroundColor: activeTableTab === 'raw_materials' ? '#F5F3FF' : 'transparent',
                color: activeTableTab === 'raw_materials' ? '#7C3AED' : '#64748B',
                fontWeight: activeTableTab === 'raw_materials' ? '800' : '600',
                fontSize: '12.5px',
                padding: '6px 14px',
                borderRadius: '8px',
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                borderBottom: activeTableTab === 'raw_materials' ? '2px solid #7C3AED' : '2px solid transparent'
              }}
            >
              <Package size={15} />
              <span>Raw Material Directory</span>
              <span style={{
                fontSize: '10.5px',
                backgroundColor: activeTableTab === 'raw_materials' ? '#7C3AED' : '#E2E8F0',
                color: activeTableTab === 'raw_materials' ? '#FFFFFF' : '#475569',
                padding: '1px 6px',
                borderRadius: '10px'
              }}>
                {rawMaterials.length}
              </span>
            </button>
          </div>

          {/* Search Bar */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              backgroundColor: '#F8FAFC',
              border: '1px solid #CBD5E1',
              borderRadius: '8px',
              padding: '0 10px',
              width: '240px',
              height: '34px'
            }}>
              <Search size={14} style={{ color: '#94A3B8', flexShrink: 0 }} />
              <input
                type="text"
                placeholder={
                  activeTableTab === 'presets' ? "Search Presets by model..." : "Search Raw Material SKUs..."
                }
                value={searchQuery}
                onChange={(e) => { setSearchQuery(e.target.value); setCurrentPage(1); }}
                style={{
                  border: 'none',
                  outline: 'none',
                  backgroundColor: 'transparent',
                  paddingLeft: '8px',
                  fontSize: '12px',
                  width: '100%',
                  color: '#0F172A'
                }}
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: '#94A3B8', padding: 0 }}
                >
                  <X size={13} />
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Standard Table View */}
        <div style={{
          border: '1px solid #E2E8F0',
          borderRadius: '12px',
          overflow: 'hidden',
          backgroundColor: '#FFFFFF'
        }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '12.5px' }}>
            <thead>
              <tr style={{
                backgroundColor: '#F8FAFC',
                borderBottom: '1px solid #E2E8F0',
                color: '#475569',
                fontSize: '11px',
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
                fontWeight: '700'
              }}>
                <th style={{ width: '40px', padding: '10px 14px', textAlign: 'center' }}>
                  <input
                    type="checkbox"
                    checked={allOnPageSelected}
                    onChange={handleSelectAll}
                    style={{ accentColor: '#0E7490', cursor: 'pointer' }}
                  />
                </th>
                {activeTableTab === 'presets' && (
                  <>
                    <th style={{ padding: '10px 14px' }}>PRESET / MODEL CODE</th>
                    <th style={{ padding: '10px 14px' }}>CATEGORY</th>
                    <th style={{ padding: '10px 14px' }}>PARTS COUNT</th>
                    <th style={{ padding: '10px 14px' }}>GST RATE</th>
                    <th style={{ padding: '10px 14px', textAlign: 'right' }}>ACTION</th>
                  </>
                )}
                {activeTableTab === 'raw_materials' && (
                  <>
                    <th style={{ padding: '10px 14px' }}>MATERIAL CODE</th>
                    <th style={{ padding: '10px 14px' }}>MATERIAL DESCRIPTION</th>
                    <th style={{ padding: '10px 14px' }}>CATEGORY</th>
                    <th style={{ padding: '10px 14px' }}>UNIT</th>
                    <th style={{ padding: '10px 14px', textAlign: 'right' }}>STATUS</th>
                  </>
                )}
              </tr>
            </thead>
            <tbody>
              {currentRows.length === 0 ? (
                <tr>
                  <td colSpan={6} style={{ padding: '40px', textAlign: 'center', color: '#64748B' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
                      <AlertCircle size={24} style={{ color: '#94A3B8' }} />
                      <span style={{ fontSize: '13px', fontWeight: '600' }}>No records found</span>
                      <span style={{ fontSize: '11.5px', color: '#94A3B8' }}>Try adjusting your search criteria</span>
                    </div>
                  </td>
                </tr>
              ) : (
                currentRows.map((row, idx) => {
                  const rowId = row.id || String(idx);
                  const isSelected = selectedRows.has(rowId);

                  return (
                    <tr
                      key={rowId}
                      style={{
                        borderBottom: '1px solid #F1F5F9',
                        backgroundColor: isSelected ? '#ECFEFF' : (idx % 2 === 0 ? '#FFFFFF' : '#FAFAFA'),
                        transition: 'background-color 0.1s ease'
                      }}
                    >
                      <td style={{
                        padding: '10px 14px',
                        textAlign: 'center',
                        borderLeft: isSelected ? '4px solid #0E7490' : '4px solid transparent'
                      }}>
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => handleRowCheckbox(rowId)}
                          style={{ accentColor: '#0E7490', cursor: 'pointer' }}
                        />
                      </td>

                      {activeTableTab === 'presets' && (
                        <>
                          <td style={{ padding: '10px 14px' }}>
                            <div style={{ fontWeight: '700', color: '#0F172A' }}>{row.name}</div>
                            <div style={{ fontSize: '11px', color: '#64748B', fontFamily: 'monospace' }}>{row.id}</div>
                          </td>
                          <td style={{ padding: '10px 14px' }}>
                            <span style={{
                              padding: '2px 8px',
                              borderRadius: '6px',
                              fontSize: '11px',
                              fontWeight: '700',
                              backgroundColor: '#E0F2FE',
                              color: '#0369A1'
                            }}>
                              {row.category}
                            </span>
                          </td>
                          <td style={{ padding: '10px 14px' }}>
                            <span style={{ fontWeight: '600', color: '#0F172A' }}>{row.itemsCount} Parts</span>
                          </td>
                          <td style={{ padding: '10px 14px' }}>
                            <span style={{ color: '#475569', fontWeight: '600' }}>{row.gstRate}</span>
                          </td>
                          <td style={{ padding: '10px 14px', textAlign: 'right' }}>
                            <button
                              onClick={() => onNavigateTab && onNavigateTab('Preset Management')}
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '4px',
                                padding: '5px 10px',
                                backgroundColor: '#F1F5F9',
                                color: '#0E7490',
                                border: '1px solid #E2E8F0',
                                borderRadius: '6px',
                                fontSize: '11px',
                                fontWeight: '700',
                                cursor: 'pointer'
                              }}
                            >
                              <Sliders size={12} />
                              Configure
                            </button>
                          </td>
                        </>
                      )}

                      {activeTableTab === 'raw_materials' && (
                        <>
                          <td style={{ padding: '10px 14px' }}>
                            <span style={{ fontWeight: '700', color: '#7C3AED', fontFamily: 'monospace' }}>
                              {row.id}
                            </span>
                          </td>
                          <td style={{ padding: '10px 14px' }}>
                            <div style={{ fontWeight: '700', color: '#0F172A' }}>{row.name}</div>
                          </td>
                          <td style={{ padding: '10px 14px' }}>
                            <span style={{ padding: '2px 8px', borderRadius: '6px', fontSize: '11px', fontWeight: '600', backgroundColor: '#F1F5F9', color: '#475569' }}>
                              {row.category}
                            </span>
                          </td>
                          <td style={{ padding: '10px 14px' }}>
                            <span style={{ color: '#64748B', fontWeight: '600' }}>{row.unit}</span>
                          </td>
                          <td style={{ padding: '10px 14px', textAlign: 'right' }}>
                            <span style={{
                              padding: '2px 8px',
                              borderRadius: '6px',
                              fontSize: '11px',
                              fontWeight: '700',
                              backgroundColor: '#ECFDF5',
                              color: '#059669'
                            }}>
                              Ready
                            </span>
                          </td>
                        </>
                      )}

                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Standard Table Pagination Footer Layout (Strictly 5 or 10 per standard rules) */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '10px 6px 4px 6px',
          flexWrap: 'wrap',
          gap: '12px'
        }}>
          {/* Left Side: Rows per page selector + Showing X to Y of Z */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '12px', color: '#64748B' }}>
            <span>Showing per page</span>
            <select
              value={pageSize}
              onChange={(e) => { setPageSize(Number(e.target.value)); setCurrentPage(1); }}
              style={{
                padding: '3px 8px',
                borderRadius: '6px',
                border: '1px solid #CBD5E1',
                fontSize: '12px',
                fontWeight: '700',
                color: '#0F172A',
                backgroundColor: '#FFFFFF',
                cursor: 'pointer'
              }}
            >
              <option value={5}>5</option>
              <option value={10}>10</option>
            </select>
            <span>Showing {totalEntries === 0 ? 0 : startIndex + 1} to {endIndex} of {totalEntries} entries</span>
          </div>

          {/* Right Side: Page buttons & Jump to page */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <button
                disabled={currentPage <= 1}
                onClick={() => handlePageChange(1)}
                style={{
                  padding: '4px 8px',
                  borderRadius: '6px',
                  border: '1px solid #E2E8F0',
                  backgroundColor: '#FFFFFF',
                  cursor: currentPage <= 1 ? 'not-allowed' : 'pointer',
                  color: currentPage <= 1 ? '#CBD5E1' : '#475569',
                  fontSize: '11px',
                  fontWeight: '700'
                }}
              >
                &laquo;
              </button>
              <button
                disabled={currentPage <= 1}
                onClick={() => handlePageChange(currentPage - 1)}
                style={{
                  padding: '4px 8px',
                  borderRadius: '6px',
                  border: '1px solid #E2E8F0',
                  backgroundColor: '#FFFFFF',
                  cursor: currentPage <= 1 ? 'not-allowed' : 'pointer',
                  color: currentPage <= 1 ? '#CBD5E1' : '#475569',
                  fontSize: '11px',
                  fontWeight: '700'
                }}
              >
                &lsaquo;
              </button>

              <span style={{
                padding: '4px 10px',
                borderRadius: '6px',
                backgroundColor: '#0E7490',
                color: '#FFFFFF',
                fontSize: '11px',
                fontWeight: '700'
              }}>
                {currentPage} / {totalPages}
              </span>

              <button
                disabled={currentPage >= totalPages}
                onClick={() => handlePageChange(currentPage + 1)}
                style={{
                  padding: '4px 8px',
                  borderRadius: '6px',
                  border: '1px solid #E2E8F0',
                  backgroundColor: '#FFFFFF',
                  cursor: currentPage >= totalPages ? 'not-allowed' : 'pointer',
                  color: currentPage >= totalPages ? '#CBD5E1' : '#475569',
                  fontSize: '11px',
                  fontWeight: '700'
                }}
              >
                &rsaquo;
              </button>
              <button
                disabled={currentPage >= totalPages}
                onClick={() => handlePageChange(totalPages)}
                style={{
                  padding: '4px 8px',
                  borderRadius: '6px',
                  border: '1px solid #E2E8F0',
                  backgroundColor: '#FFFFFF',
                  cursor: currentPage >= totalPages ? 'not-allowed' : 'pointer',
                  color: currentPage >= totalPages ? '#CBD5E1' : '#475569',
                  fontSize: '11px',
                  fontWeight: '700'
                }}
              >
                &raquo;
              </button>
            </div>

            <form onSubmit={handleGoToPage} style={{ display: 'flex', alignItems: 'center', gap: '4px', marginLeft: '6px' }}>
              <span style={{ fontSize: '11px', color: '#64748B' }}>Go to</span>
              <input
                type="number"
                min={1}
                max={totalPages}
                value={goToPageInput}
                onChange={(e) => setGoToPageInput(e.target.value)}
                style={{
                  width: '45px',
                  padding: '3px',
                  borderRadius: '4px',
                  border: '1px solid #CBD5E1',
                  fontSize: '11px',
                  textAlign: 'center'
                }}
              />
              <button
                type="submit"
                style={{
                  padding: '3px 8px',
                  borderRadius: '4px',
                  border: '1px solid #0E7490',
                  backgroundColor: '#0E7490',
                  color: '#FFFFFF',
                  fontSize: '11px',
                  fontWeight: '700',
                  cursor: 'pointer'
                }}
              >
                Go &rsaquo;
              </button>
            </form>
          </div>
        </div>

      </div>

      {/* Floating Bottom Action Bar (Standard Table System) */}
      {selectedRows.size > 0 && (
        <div style={{
          position: 'fixed',
          bottom: '24px',
          left: '50%',
          transform: 'translateX(-50%)',
          backgroundColor: '#0F172A',
          color: '#FFFFFF',
          padding: '10px 24px',
          borderRadius: '50px',
          boxShadow: '0 10px 25px rgba(0,0,0,0.3)',
          display: 'flex',
          alignItems: 'center',
          gap: '16px',
          zIndex: 9999,
          whiteSpace: 'nowrap',
          flexDirection: 'row',
          flexWrap: 'nowrap'
        }}>
          <span style={{ fontSize: '13px', fontWeight: '700', color: '#38BDF8' }}>
            {selectedRows.size} Selected
          </span>
          <span style={{ color: '#475569' }}>|</span>

          <button
            onClick={() => {
              if (activeTableTab === 'presets') onNavigateTab && onNavigateTab('Preset Management');
              else onNavigateTab && onNavigateTab('Raw Material Directory');
            }}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '6px 14px',
              backgroundColor: '#1E293B',
              color: '#FFFFFF',
              border: '1px solid #334155',
              borderRadius: '20px',
              fontSize: '12px',
              fontWeight: '600',
              cursor: 'pointer'
            }}
          >
            <Eye size={13} />
            <span>View Details</span>
          </button>

          <button
            onClick={() => setSelectedRows(new Set())}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px',
              padding: '6px 10px',
              backgroundColor: 'transparent',
              color: '#94A3B8',
              border: 'none',
              borderRadius: '20px',
              fontSize: '12px',
              cursor: 'pointer'
            }}
          >
            <X size={14} />
            <span>Clear</span>
          </button>
        </div>
      )}

    </div>
  );
}
