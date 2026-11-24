import React, { useState, useEffect } from 'react';
import {
  Search,
  Copy,
  Check,
  ExternalLink,
  RefreshCw,
  RotateCcw,
  AlertTriangle,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Eye,
  ShieldAlert,
  Send,
  X
} from 'lucide-react';
import ModernDateRangePicker from '../ModernDateRangePicker';
import StatusBadge from '../StatusBadge';

const STAGE_OPTIONS = [
  { value: 'ALL', label: 'All Stages' },
  { value: 'ORDER_CONFIRMED', label: '1. Order Confirmed' },
  { value: 'RECEIVED_BY_DISPATCH', label: '2. Received by Dispatch' },
  { value: 'PACKING_IN_PROGRESS', label: '3. Packing in Progress' },
  { value: 'PACKING_COMPLETED', label: '4. Packing Completed' },
  { value: 'ORDER_VERIFICATION', label: '5. Accounts Verification' },
  { value: 'INVOICE_GENERATED', label: '6. Invoice Generated' },
  { value: 'READY_FOR_LOADING', label: '7. Ready for Loading' },
  { value: 'LOADING_IN_PROGRESS', label: '8. Loading in Progress' },
  { value: 'DISPATCHED', label: '9. Dispatched & In Transit' },
  { value: 'DELIVERED', label: '10. Order Delivered' }
];

export default function CustomerOrderTrackingView() {
  const [orders, setOrders] = useState([]);
  const [analytics, setAnalytics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedStage, setSelectedStage] = useState('ALL');
  const [selectedTab, setSelectedTab] = useState('ALL');
  const [filterDate, setFilterDate] = useState('');
  const [filterEndDate, setFilterEndDate] = useState('');
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [totalCount, setTotalCount] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [goToPageInput, setGoToPageInput] = useState('');

  // Selected Rows for Floating Action Bar
  const [selectedRowIds, setSelectedRowIds] = useState([]);
  const [copiedId, setCopiedId] = useState(null);

  // Issues Modal & Live Preview Modal
  const [showIssuesModal, setShowIssuesModal] = useState(false);
  const [openIssuesList, setOpenIssuesList] = useState([]);
  const [selectedIssue, setSelectedIssue] = useState(null);
  const [resolutionText, setResolutionText] = useState('');
  const [resolving, setResolving] = useState(false);
  const [livePreviewUrl, setLivePreviewUrl] = useState(null);

  // Load analytics & orders
  const fetchAnalytics = async () => {
    try {
      const res = await fetch('/api/internal/tracking/analytics');
      const data = await res.json();
      if (res.ok && data.analytics) {
        setAnalytics(data.analytics);
      }
    } catch (_) {}
  };

  const fetchOrders = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        search: search.trim(),
        stage: selectedStage,
        page: String(page),
        limit: String(limit)
      });
      if (filterDate) params.append('startDate', filterDate);
      if (filterEndDate) params.append('endDate', filterEndDate);

      const res = await fetch(`/api/internal/tracking/orders?${params.toString()}`);
      const data = await res.json();
      if (res.ok) {
        setOrders(data.orders || []);
        setTotalCount(data.totalCount || 0);
        setTotalPages(data.totalPages || 1);
      }
    } catch (err) {
      console.error('Failed to load tracking orders:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchIssues = async () => {
    try {
      const res = await fetch('/api/internal/tracking/issues?status=OPEN');
      const data = await res.json();
      if (res.ok && data.issues) {
        setOpenIssuesList(data.issues);
      }
    } catch (_) {}
  };

  useEffect(() => {
    fetchAnalytics();
    fetchIssues();
  }, []);

  useEffect(() => {
    fetchOrders();
    setSelectedRowIds([]);
  }, [search, selectedStage, filterDate, filterEndDate, page, limit]);

  // Copy Tracking Link
  const handleCopyLink = (trackingUrl, id) => {
    navigator.clipboard?.writeText(trackingUrl);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  // Row selection
  const handleSelectAll = (e) => {
    if (e.target.checked) {
      setSelectedRowIds(orders.map(o => o.id));
    } else {
      setSelectedRowIds([]);
    }
  };

  const handleSelectRow = (id) => {
    setSelectedRowIds(prev =>
      prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]
    );
  };

  // Actions
  const handleResendWhatsApp = async (bomCode) => {
    try {
      const res = await fetch(`/api/internal/tracking/resend-whatsapp/${bomCode}`, { method: 'POST' });
      const data = await res.json();
      if (res.ok) {
        alert(`WhatsApp notification queued for BOM ${bomCode}`);
        fetchAnalytics();
      } else {
        alert(data.error || 'Failed to resend WhatsApp notification');
      }
    } catch (_) {
      alert('Network error while queueing WhatsApp notification');
    }
  };

  const handleRegenerateToken = async (bomCode) => {
    if (!window.confirm(`Are you sure you want to regenerate the tracking link for ${bomCode}? The previous link will become invalid immediately.`)) {
      return;
    }
    try {
      const res = await fetch(`/api/internal/tracking/regenerate/${bomCode}`, { method: 'POST' });
      const data = await res.json();
      if (res.ok) {
        alert(`New tracking link generated successfully for ${bomCode}`);
        fetchOrders();
      } else {
        alert(data.error || 'Failed to regenerate tracking link');
      }
    } catch (_) {
      alert('Network error while regenerating tracking link');
    }
  };

  const handleRevokeToken = async (bomCode) => {
    if (!window.confirm(`Revoke customer tracking access for ${bomCode}? The customer will no longer be able to track this order.`)) {
      return;
    }
    try {
      const res = await fetch(`/api/internal/tracking/revoke/${bomCode}`, { method: 'POST' });
      const data = await res.json();
      if (res.ok) {
        alert(`Tracking link revoked for ${bomCode}`);
        fetchOrders();
      } else {
        alert(data.error || 'Failed to revoke tracking link');
      }
    } catch (_) {
      alert('Network error while revoking tracking link');
    }
  };

  const handleResolveIssue = async (issueId) => {
    if (!resolutionText.trim()) {
      alert('Please enter resolution notes before marking resolved.');
      return;
    }
    setResolving(true);
    try {
      const res = await fetch(`/api/internal/tracking/issues/${issueId}/resolve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ resolutionNotes: resolutionText, resolvedBy: 'Operations Dispatch' })
      });
      if (res.ok) {
        alert('Customer issue resolved successfully.');
        setSelectedIssue(null);
        setResolutionText('');
        fetchIssues();
        fetchAnalytics();
        fetchOrders();
      }
    } catch (_) {
      alert('Failed to resolve issue');
    } finally {
      setResolving(false);
    }
  };

  const clearFilters = () => {
    setSearch('');
    setSelectedStage('ALL');
    setSelectedTab('ALL');
    setFilterDate('');
    setFilterEndDate('');
    setPage(1);
  };

  // Helper Stage Label & Color
  const getStageBadge = (stage) => {
    switch (stage) {
      case 'DELIVERED':
        return { label: 'Delivered', bg: '#ECFDF5', text: '#059669' };
      case 'DISPATCHED':
        return { label: 'In Transit', bg: '#EFF6FF', text: '#2563EB' };
      case 'LOADING_IN_PROGRESS':
        return { label: 'Vehicle Loading', bg: '#F5F3FF', text: '#7C3AED' };
      case 'READY_FOR_LOADING':
        return { label: 'Ready for Loading', bg: '#F0FDF4', text: '#15803D' };
      case 'INVOICE_GENERATED':
        return { label: 'Invoice Generated', bg: '#FEF9C3', text: '#A16207' };
      case 'ORDER_VERIFICATION':
        return { label: 'Accounts Verification', bg: '#FFF7ED', text: '#C2410C' };
      case 'PACKING_COMPLETED':
        return { label: 'Packing Completed', bg: '#ECFDF5', text: '#059669' };
      case 'PACKING_IN_PROGRESS':
        return { label: 'In Packing', bg: '#F0FDFA', text: '#0E7490' };
      case 'RECEIVED_BY_DISPATCH':
        return { label: 'Received by Dispatch', bg: '#F8FAFC', text: '#475569' };
      default:
        return { label: stage || 'Order Confirmed', bg: '#F1F5F9', text: '#64748B' };
    }
  };

  // Pagination bounds
  const startIdx = totalCount === 0 ? 0 : (page - 1) * limit + 1;
  const endIdx = Math.min(page * limit, totalCount);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', width: '100%', boxSizing: 'border-box' }}>
      
      {/* 1. TOP HEADER ROW */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: '12px'
      }}>
        <div>
          <h2 style={{ fontSize: '20px', fontWeight: '800', color: '#0F172A', margin: 0, letterSpacing: '-0.02em' }}>
            Customer Order &amp; Dispatch Tracking
          </h2>
          <span style={{ fontSize: '12.5px', color: '#64748B', marginTop: '2px', display: 'block' }}>
            Live customer tracking links, WhatsApp notifications, packing progress, and delivery status.
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          {openIssuesList.length > 0 && (
            <button
              onClick={() => setShowIssuesModal(true)}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '8px 14px',
                borderRadius: '8px',
                backgroundColor: '#FEF2F2',
                border: '1px solid #FECACA',
                color: '#DC2626',
                fontSize: '12.5px',
                fontWeight: '700',
                cursor: 'pointer'
              }}
            >
              <AlertTriangle size={15} />
              <span>{openIssuesList.length} Customer Issues</span>
            </button>
          )}

          <button
            onClick={() => { fetchOrders(); fetchAnalytics(); fetchIssues(); }}
            title="Refresh Table"
            style={{
              height: '38px',
              padding: '0 14px',
              backgroundColor: '#FFFFFF',
              border: '1px solid #CBD5E1',
              borderRadius: '8px',
              fontSize: '12.5px',
              fontWeight: '700',
              color: '#475569',
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              boxShadow: '0 1px 2px rgba(0,0,0,0.04)'
            }}
          >
            <RefreshCw size={14} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* 2. FILTERS & SEARCH ROW CARD (Exact Standard BUSINZ Layout & Colors) */}
      <div style={{
        display: 'flex',
        flexWrap: 'wrap',
        gap: '12px',
        padding: '12px 16px',
        backgroundColor: '#fafbfc',
        borderRadius: '12px',
        border: '1px solid #e2e8f0',
        alignItems: 'center',
        width: '100%',
        boxSizing: 'border-box',
        justifyContent: 'space-between',
        marginBottom: '4px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', border: '1px solid #cbd5e1', borderRadius: '8px', padding: '0 12px', height: '38px', backgroundColor: '#f8fafc', width: '320px', maxWidth: '100%', boxSizing: 'border-box' }}>
          <Search style={{ width: '15px', height: '15px', color: '#64748b', flexShrink: 0 }} />
          <input
            type="text"
            placeholder="Search Orders (BOM Code, PI No, Customer)..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            style={{ border: 'none', background: 'none', outline: 'none', fontSize: '13px', width: '100%', color: '#334155' }}
          />
        </div>

        <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap', flexShrink: 0 }}>
          <ModernDateRangePicker
            startDate={filterDate}
            endDate={filterEndDate}
            onChange={({ startDate, endDate }) => {
              setFilterDate(startDate);
              setFilterEndDate(endDate);
              setPage(1);
            }}
          />

          <select
            value={selectedStage}
            onChange={(e) => { setSelectedStage(e.target.value); setPage(1); }}
            style={{ height: '38px', borderRadius: '8px', border: '1px solid #cbd5e1', padding: '0 12px', fontSize: '12px', backgroundColor: 'white', color: '#334155', outline: 'none' }}
          >
            {STAGE_OPTIONS.map(opt => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>

          <button
            onClick={clearFilters}
            title="Clear Filters"
            style={{
              background: '#f1f5f9',
              border: '1px solid #cbd5e1',
              color: '#475569',
              cursor: 'pointer',
              padding: '0',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: '8px',
              height: '38px',
              width: '38px',
              flexShrink: 0,
              transition: 'all 0.15s ease'
            }}
          >
            <RotateCcw style={{ width: '15px', height: '15px' }} />
          </button>
        </div>
      </div>

      {/* 3. STATUS TABS ROW (Exact Standard BUSINZ Tabs Style & Color Palettes) */}
      <div style={{ display: 'flex', borderBottom: '1px solid #e2e8f0', gap: '20px', padding: '4px 0', alignItems: 'center', flexWrap: 'wrap', marginBottom: '8px' }}>
        {[
          { id: 'ALL', label: 'All orders', count: totalCount, bg: '#e2e8f0', fg: '#475569' },
          { id: 'RECEIVED_BY_DISPATCH', label: 'Received by Dispatch', count: analytics?.stages?.received_by_dispatch || 0, bg: '#f1f5f9', fg: '#475569' },
          { id: 'PACKING_IN_PROGRESS', label: 'In Packing', count: analytics?.stages?.packing_in_progress || 0, bg: '#fff7ed', fg: '#c2410c' },
          { id: 'PACKING_COMPLETED', label: 'Packing Completed', count: analytics?.stages?.packing_completed || 0, bg: '#ecfeff', fg: '#0e7490' },
          { id: 'READY_FOR_LOADING', label: 'Ready for Loading', count: analytics?.stages?.ready_for_loading || 0, bg: '#fef3c7', fg: '#92400e' },
          { id: 'DISPATCHED', label: 'In Transit', count: analytics?.stages?.dispatched || 0, bg: '#EFF6FF', fg: '#1D4ED8' },
          { id: 'DELIVERED', label: 'Delivered', count: analytics?.stages?.delivered || 0, bg: '#dcfce7', fg: '#15803d' },
          { id: 'ISSUES', label: 'Customer Issues', count: openIssuesList.length, bg: '#fee2e2', fg: '#b91c1c' }
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => {
              setSelectedTab(tab.id);
              if (tab.id === 'ALL' || tab.id === 'ISSUES') {
                setSelectedStage('ALL');
              } else {
                setSelectedStage(tab.id);
              }
              setPage(1);
            }}
            style={{
              border: 'none',
              background: 'transparent',
              padding: '10px 4px',
              fontSize: '13px',
              fontWeight: 'bold',
              color: selectedTab === tab.id ? '#0E7490' : '#64748b',
              borderBottom: selectedTab === tab.id ? '2px solid #0E7490' : '2px solid transparent',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}
          >
            <span>{tab.label}</span>
            <span style={{ fontSize: '10px', fontWeight: 'bold', backgroundColor: tab.bg, color: tab.fg, padding: '1px 6px', borderRadius: '10px' }}>
              {tab.count}
            </span>
          </button>
        ))}
      </div>

      {/* 4. TABLE CARD (Exact custom-table & section-card classes from PO/DC) */}
      <div className="section-card" style={{ padding: 0, overflowX: 'auto', display: 'flex', flexDirection: 'column', width: '100%', boxSizing: 'border-box', backgroundColor: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: '16px' }}>
        <div className="table-responsive" style={{ border: 'none', borderRadius: '16px', margin: 0, overflowX: 'auto', width: '100%', boxSizing: 'border-box' }}>
          <table className="custom-table" style={{ fontSize: '13px', width: '100%', minWidth: '1000px', borderCollapse: 'collapse', textAlign: 'left' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid #E2E8F0', backgroundColor: '#F8FAFC', color: '#475569', height: '48px' }}>
                <th style={{ width: '48px', minWidth: '48px', maxWidth: '48px', textAlign: 'center', padding: '12px 0', boxSizing: 'border-box' }}>
                  <input
                    type="checkbox"
                    onChange={handleSelectAll}
                    checked={orders.length > 0 && orders.every(o => selectedRowIds.includes(o.id))}
                    style={{ cursor: 'pointer', borderRadius: '4px', accentColor: '#0E7490' }}
                  />
                </th>
                <th style={{ width: '18%', minWidth: '150px', fontWeight: '700', padding: '12px 14px', color: '#334155', textAlign: 'left', boxSizing: 'border-box' }}>BOM Order</th>
                <th style={{ width: '22%', minWidth: '180px', fontWeight: '700', padding: '12px 14px', color: '#334155', textAlign: 'left', boxSizing: 'border-box' }}>Customer Details</th>
                <th style={{ width: '14%', minWidth: '130px', fontWeight: '700', padding: '12px 14px', color: '#334155', textAlign: 'left', boxSizing: 'border-box' }}>Current Stage</th>
                <th style={{ width: '14%', minWidth: '130px', fontWeight: '700', padding: '12px 14px', color: '#334155', textAlign: 'left', boxSizing: 'border-box' }}>Packing Progress</th>
                <th style={{ width: '14%', minWidth: '120px', fontWeight: '700', padding: '12px 14px', color: '#334155', textAlign: 'left', boxSizing: 'border-box' }}>Transport / LR</th>
                <th style={{ width: '12%', minWidth: '120px', fontWeight: '700', padding: '12px 14px', color: '#334155', textAlign: 'left', boxSizing: 'border-box' }}>Tracking Link</th>
                <th style={{ width: '6%', minWidth: '80px', fontWeight: '700', padding: '12px 14px', color: '#334155', textAlign: 'center', boxSizing: 'border-box' }}>WhatsApp</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={8} style={{ padding: '40px', textAlign: 'center', color: '#64748B' }}>
                    <div style={{ display: 'inline-block', width: '24px', height: '24px', borderRadius: '50%', border: '2px solid #E2E8F0', borderTopColor: '#0E7490', animation: 'spin 0.8s linear infinite' }} />
                    <div style={{ marginTop: '8px' }}>Loading tracking records...</div>
                  </td>
                </tr>
              ) : orders.length === 0 ? (
                <tr>
                  <td colSpan={8} style={{ padding: '40px', textAlign: 'center', color: '#64748B' }}>
                    No tracking orders found matching your criteria.
                  </td>
                </tr>
              ) : (
                orders.map((ord, idx) => {
                  const isChecked = selectedRowIds.includes(ord.id);
                  const isCopied = copiedId === ord.id;
                  const hasOpenIssue = Number(ord.open_issues_count) > 0;
                  const stageObj = getStageBadge(ord.current_stage);

                  return (
                    <tr
                      key={ord.id || idx}
                      style={{
                        borderBottom: idx === orders.length - 1 ? 'none' : '1px solid #f1f5f9',
                        transition: 'all 0.15s ease',
                        backgroundColor: isChecked ? '#ECFEFF' : 'transparent',
                        borderLeft: isChecked ? '4px solid #0E7490' : '4px solid transparent'
                      }}
                      className={`table-row-hover ${isChecked ? 'selected-row' : ''}`}
                    >
                      <td style={{ textAlign: 'center' }}>
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => handleSelectRow(ord.id)}
                          style={{ accentColor: '#0E7490', cursor: 'pointer' }}
                        />
                      </td>

                      {/* BOM Code with Link */}
                      <td style={{ textAlign: 'left', padding: '12px 14px' }}>
                        <a
                          href="#"
                          onClick={(e) => {
                            e.preventDefault();
                            setLivePreviewUrl(ord.tracking_url);
                          }}
                          style={{ fontWeight: '700', color: '#0E7490', textDecoration: 'none' }}
                        >
                          {ord.bom_code}
                        </a>
                        {ord.source_pi_no && (
                          <div style={{ fontSize: '11px', color: '#64748B', fontWeight: '500' }}>
                            PI: {ord.source_pi_no}
                          </div>
                        )}
                        {hasOpenIssue && (
                          <span style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '3px',
                            fontSize: '10px',
                            fontWeight: '800',
                            backgroundColor: '#FEF2F2',
                            color: '#DC2626',
                            padding: '1px 6px',
                            borderRadius: '6px',
                            marginTop: '2px'
                          }}>
                            ⚠️ Issue Reported
                          </span>
                        )}
                      </td>

                      {/* Customer Details */}
                      <td style={{ color: '#1e293b', textAlign: 'left', padding: '12px 14px' }}>
                        <div style={{ fontWeight: '600', color: '#1e293b' }}>{ord.customer_name}</div>
                        <div style={{ fontSize: '11.5px', color: '#64748B' }}>{ord.customer_mobile || '—'}</div>
                      </td>

                      {/* Current Stage */}
                      <td style={{ textAlign: 'left', padding: '12px 14px' }}>
                        <StatusBadge status={stageObj.label} size="sm" />
                      </td>

                      {/* Packing Progress */}
                      <td style={{ textAlign: 'left', padding: '12px 14px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '3px' }}>
                          <span style={{ fontSize: '11.5px', fontWeight: '800', color: '#0F172A' }}>{ord.packing_percentage || 0}%</span>
                          <span style={{ fontSize: '10.5px', color: '#64748B' }}>{ord.packed_lines_count || 0}/{ord.total_lines_count || 0} items</span>
                        </div>
                        <div style={{ width: '100%', height: '6px', backgroundColor: '#F1F5F9', borderRadius: '4px', overflow: 'hidden' }}>
                          <div style={{
                            width: `${ord.packing_percentage || 0}%`,
                            height: '100%',
                            backgroundColor: ord.packing_percentage === 100 ? '#10B981' : '#0E7490',
                            borderRadius: '4px'
                          }} />
                        </div>
                      </td>

                      {/* Transport / LR */}
                      <td style={{ color: '#475569', textAlign: 'left', padding: '12px 14px' }}>
                        <div style={{ fontWeight: '600', color: '#1e293b' }}>{ord.transporter_name || 'Pending'}</div>
                        <div style={{ fontSize: '11px', color: '#64748B' }}>LR: {ord.lr_no || ord.vehicle_no || 'N/A'}</div>
                      </td>

                      {/* Tracking Link */}
                      <td style={{ textAlign: 'left', padding: '12px 14px' }}>
                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                          <button
                            type="button"
                            onClick={() => handleCopyLink(ord.tracking_url, ord.id)}
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px',
                              padding: '4px 8px',
                              borderRadius: '6px',
                              backgroundColor: isCopied ? '#ECFDF5' : '#F1F5F9',
                              color: isCopied ? '#059669' : '#334155',
                              border: '1px solid #CBD5E1',
                              fontSize: '11px',
                              fontWeight: '700',
                              cursor: 'pointer'
                            }}
                          >
                            {isCopied ? <Check size={12} /> : <Copy size={12} />}
                            <span>{isCopied ? 'Copied' : 'Copy'}</span>
                          </button>
                          <a
                            href={ord.tracking_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            title="Open Live Customer Tracking"
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              padding: '4px',
                              borderRadius: '6px',
                              color: '#0E7490',
                              backgroundColor: '#ECFEFF',
                              border: '1px solid #CFFAFE'
                            }}
                          >
                            <ExternalLink size={13} />
                          </a>
                        </div>
                        <div style={{ fontSize: '10px', color: '#94A3B8', marginTop: '2px' }}>
                          {ord.access_count || 0} customer views
                        </div>
                      </td>

                      {/* WhatsApp Action */}
                      <td style={{ textAlign: 'center', padding: '12px 14px' }}>
                        <button
                          type="button"
                          onClick={() => handleResendWhatsApp(ord.bom_code)}
                          title="Send WhatsApp Tracking Link"
                          style={{
                            padding: '5px 10px',
                            borderRadius: '6px',
                            backgroundColor: '#ECFDF5',
                            color: '#059669',
                            border: '1px solid #A7F3D0',
                            fontSize: '11px',
                            fontWeight: '700',
                            cursor: 'pointer',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px'
                          }}
                        >
                          <Send size={11} />
                          <span>Send</span>
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* 5. PAGINATION FOOTER (Exact Standard BUSINZ Footer Layout & Controls) */}
        <div style={{
          display: 'flex',
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '12px 24px',
          fontSize: '13px',
          color: '#64748b',
          borderTop: '1px solid #f1f5f9',
          flexWrap: 'wrap',
          gap: '12px',
          backgroundColor: '#FAFAFA'
        }}>
          {/* Left Side: Showing per page [5, 10] + Showing X to Y of Z */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span>Showing per page:</span>
            <select
              value={limit}
              onChange={(e) => { setLimit(Number(e.target.value)); setPage(1); }}
              style={{ height: '30px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '12px', padding: '0 4px', backgroundColor: 'white' }}
            >
              <option value={5}>5</option>
              <option value={10}>10</option>
            </select>
            <span style={{ color: '#cbd5e1' }}>|</span>
            <span>Showing {startIdx} to {endIdx} of {totalCount} entries</span>
          </div>

          {/* Right Side: Page buttons (<< < 1 2 3 > >>) + Go to page input */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', gap: '4px' }}>
              <button
                disabled={page <= 1}
                onClick={() => setPage(prev => Math.max(prev - 1, 1))}
                style={{ border: '1px solid #cbd5e1', background: page <= 1 ? '#f1f5f9' : 'white', cursor: page <= 1 ? 'not-allowed' : 'pointer', padding: '6px 8px', borderRadius: '6px', display: 'flex', alignItems: 'center' }}
              >
                <ChevronLeft style={{ width: '14px', height: '14px' }} />
              </button>

              {Array.from({ length: totalPages }, (_, i) => i + 1).slice(
                Math.max(0, page - 2),
                Math.min(totalPages, page + 1)
              ).map(pNum => (
                <button
                  key={pNum}
                  onClick={() => setPage(pNum)}
                  style={{
                    border: pNum === page ? '1px solid #0E7490' : '1px solid #cbd5e1',
                    background: pNum === page ? '#0E7490' : 'white',
                    color: pNum === page ? 'white' : '#475569',
                    padding: '4px 10px',
                    borderRadius: '6px',
                    fontWeight: pNum === page ? 'bold' : 'normal',
                    cursor: 'pointer',
                    fontSize: '12px'
                  }}
                >
                  {pNum}
                </button>
              ))}

              <button
                disabled={page >= totalPages}
                onClick={() => setPage(prev => Math.min(prev + 1, totalPages))}
                style={{ border: '1px solid #cbd5e1', background: page >= totalPages ? '#f1f5f9' : 'white', cursor: page >= totalPages ? 'not-allowed' : 'pointer', padding: '6px 8px', borderRadius: '6px', display: 'flex', alignItems: 'center' }}
              >
                <ChevronRight style={{ width: '14px', height: '14px' }} />
              </button>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span>Go to page</span>
              <input
                type="number"
                min={1}
                max={totalPages}
                value={goToPageInput}
                onChange={(e) => setGoToPageInput(e.target.value)}
                placeholder={String(page)}
                style={{ width: '45px', height: '28px', borderRadius: '6px', border: '1px solid #cbd5e1', textAlign: 'center', fontSize: '12px' }}
              />
              <button
                onClick={() => {
                  const targetP = parseInt(goToPageInput, 10);
                  if (targetP >= 1 && targetP <= totalPages) {
                    setPage(targetP);
                    setGoToPageInput('');
                  }
                }}
                style={{ height: '28px', padding: '0 8px', borderRadius: '6px', border: '1px solid #0E7490', backgroundColor: '#ECFEFF', color: '#0E7490', fontSize: '12px', fontWeight: '700', cursor: 'pointer' }}
              >
                Go ›
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* 6. FLOATING BOTTOM ACTION BAR FOR SELECTED ROWS (User Rules Mandate) */}
      {selectedRowIds.length > 0 && (
        <div style={{
          position: 'fixed',
          bottom: '24px',
          left: '50%',
          transform: 'translateX(-50%)',
          borderRadius: '50px',
          backgroundColor: '#0F172A',
          color: '#FFFFFF',
          padding: '10px 24px',
          display: 'flex',
          alignItems: 'center',
          gap: '16px',
          boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.3)',
          zIndex: 90,
          whiteSpace: 'nowrap',
          flexWrap: 'nowrap'
        }}>
          <span style={{ fontSize: '13px', fontWeight: 700, color: '#38BDF8' }}>
            {selectedRowIds.length} Selected
          </span>

          <span style={{ color: '#475569' }}>|</span>

          {/* Direct visible actions in single line (NO 3-dot menu) */}
          <button
            onClick={() => {
              const ord = orders.find(o => o.id === selectedRowIds[0]);
              if (ord) setLivePreviewUrl(ord.tracking_url);
            }}
            style={{
              background: 'none',
              border: 'none',
              color: '#F8FAFC',
              fontSize: '13px',
              fontWeight: 600,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}
          >
            <Eye size={15} />
            <span>View Live Tracking</span>
          </button>

          <button
            onClick={() => {
              const ord = orders.find(o => o.id === selectedRowIds[0]);
              if (ord) handleCopyLink(ord.tracking_url, ord.id);
            }}
            style={{
              background: 'none',
              border: 'none',
              color: '#F8FAFC',
              fontSize: '13px',
              fontWeight: 600,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}
          >
            <Copy size={15} />
            <span>Copy Link</span>
          </button>

          <button
            onClick={() => {
              const ord = orders.find(o => o.id === selectedRowIds[0]);
              if (ord) handleResendWhatsApp(ord.bom_code);
            }}
            style={{
              background: 'none',
              border: 'none',
              color: '#34D399',
              fontSize: '13px',
              fontWeight: 600,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}
          >
            <Send size={15} />
            <span>Resend WhatsApp</span>
          </button>

          <button
            onClick={() => {
              const ord = orders.find(o => o.id === selectedRowIds[0]);
              if (ord) handleRegenerateToken(ord.bom_code);
            }}
            style={{
              background: 'none',
              border: 'none',
              color: '#FBBF24',
              fontSize: '13px',
              fontWeight: 600,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}
          >
            <RefreshCw size={15} />
            <span>Regenerate Link</span>
          </button>

          <button
            onClick={() => {
              const ord = orders.find(o => o.id === selectedRowIds[0]);
              if (ord) handleRevokeToken(ord.bom_code);
            }}
            style={{
              background: 'none',
              border: 'none',
              color: '#F87171',
              fontSize: '13px',
              fontWeight: 600,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}
          >
            <ShieldAlert size={15} />
            <span>Revoke Link</span>
          </button>

          <button
            onClick={() => setSelectedRowIds([])}
            style={{
              background: 'none',
              border: 'none',
              color: '#94A3B8',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              marginLeft: '4px'
            }}
            title="Deselect All"
          >
            <X size={16} />
          </button>
        </div>
      )}

      {/* 7. MODAL: LIVE TRACKING PREVIEW */}
      {livePreviewUrl && (
        <div style={{
          position: 'fixed',
          top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(15, 23, 42, 0.65)',
          backdropFilter: 'blur(3px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '24px',
          zIndex: 1000
        }}>
          <div style={{
            maxWidth: '900px',
            width: '100%',
            height: '85vh',
            backgroundColor: '#FFFFFF',
            borderRadius: '16px',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)'
          }}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '14px 20px',
              borderBottom: '1px solid #E2E8F0',
              backgroundColor: '#F8FAFC'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Eye size={18} color="#0E7490" />
                <span style={{ fontSize: '14px', fontWeight: '800', color: '#0F172A' }}>
                  Live Customer Tracking Portal Preview
                </span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <a
                  href={livePreviewUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px',
                    fontSize: '12px',
                    fontWeight: '700',
                    color: '#0E7490',
                    textDecoration: 'none'
                  }}
                >
                  <ExternalLink size={13} />
                  <span>Open in Tab</span>
                </a>
                <button
                  onClick={() => setLivePreviewUrl(null)}
                  style={{ background: 'none', border: 'none', color: '#64748B', cursor: 'pointer', display: 'flex' }}
                >
                  <X size={20} />
                </button>
              </div>
            </div>
            <div style={{ flex: 1, position: 'relative' }}>
              <iframe
                src={livePreviewUrl}
                title="Customer Tracking Live View"
                style={{ width: '100%', height: '100%', border: 'none' }}
              />
            </div>
          </div>
        </div>
      )}

      {/* 8. MODAL: CUSTOMER REPORTED ISSUES */}
      {showIssuesModal && (
        <div style={{
          position: 'fixed',
          top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(15, 23, 42, 0.55)',
          backdropFilter: 'blur(3px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '24px',
          zIndex: 1000
        }}>
          <div style={{
            maxWidth: '680px',
            width: '100%',
            backgroundColor: '#FFFFFF',
            borderRadius: '20px',
            padding: '28px',
            maxHeight: '85vh',
            overflowY: 'auto',
            position: 'relative',
            boxShadow: '0 20px 25px -5px rgba(15, 23, 42, 0.1)'
          }}>
            <button
              onClick={() => { setShowIssuesModal(false); setSelectedIssue(null); }}
              style={{ position: 'absolute', top: '20px', right: '20px', background: 'none', border: 'none', cursor: 'pointer', color: '#64748B' }}
            >
              <X size={20} />
            </button>

            <h2 style={{ fontSize: '18px', fontWeight: 800, color: '#0F172A', margin: '0 0 6px 0' }}>
              Customer Reported Issues
            </h2>
            <p style={{ fontSize: '13px', color: '#64748B', margin: '0 0 20px 0' }}>
              Submitted directly by customers via live tracking portal.
            </p>

            {openIssuesList.length === 0 ? (
              <div style={{ padding: '30px', textAlign: 'center', color: '#059669', backgroundColor: '#ECFDF5', borderRadius: '12px' }}>
                <CheckCircle2 size={32} style={{ margin: '0 auto 8px' }} />
                <div style={{ fontWeight: 700 }}>No Open Customer Issues</div>
                <div style={{ fontSize: '12px', marginTop: '2px' }}>All reported issues are currently resolved.</div>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {openIssuesList.map(issue => (
                  <div
                    key={issue.id}
                    style={{
                      border: '1px solid #FECACA',
                      borderRadius: '12px',
                      padding: '16px',
                      backgroundColor: '#FEF2F2'
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '6px' }}>
                      <div>
                        <span style={{ fontSize: '14px', fontWeight: 700, color: '#991B1B' }}>
                          {issue.issue_type.replace(/_/g, ' ')}
                        </span>
                        <span style={{ fontSize: '12px', color: '#64748B', marginLeft: '8px' }}>
                          • BOM: <strong>{issue.bom_code}</strong>
                        </span>
                      </div>
                      <span style={{ fontSize: '11px', color: '#94A3B8' }}>
                        {new Date(issue.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>

                    <div style={{ fontSize: '13px', color: '#1F2937', marginBottom: '8px' }}>
                      "{issue.remarks}"
                    </div>

                    <div style={{ fontSize: '12px', color: '#4B5563', marginBottom: '12px' }}>
                      Customer: <strong>{issue.customer_name}</strong> ({issue.customer_phone})
                    </div>

                    {selectedIssue?.id === issue.id ? (
                      <div style={{ marginTop: '10px', paddingTop: '10px', borderTop: '1px solid #FECACA' }}>
                        <textarea
                          rows={2}
                          value={resolutionText}
                          onChange={(e) => setResolutionText(e.target.value)}
                          placeholder="Enter resolution notes for customer..."
                          style={{
                            width: '100%',
                            padding: '8px 12px',
                            borderRadius: '8px',
                            border: '1px solid #CBD5E1',
                            fontSize: '13px',
                            boxSizing: 'border-box'
                          }}
                        />
                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '8px' }}>
                          <button
                            onClick={() => setSelectedIssue(null)}
                            style={{
                              padding: '6px 12px',
                              borderRadius: '6px',
                              border: '1px solid #CBD5E1',
                              backgroundColor: '#FFFFFF',
                              fontSize: '12px',
                              cursor: 'pointer'
                            }}
                          >
                            Cancel
                          </button>
                          <button
                            onClick={() => handleResolveIssue(issue.id)}
                            disabled={resolving}
                            style={{
                              padding: '6px 14px',
                              borderRadius: '6px',
                              border: 'none',
                              backgroundColor: '#16A34A',
                              color: '#FFFFFF',
                              fontSize: '12px',
                              fontWeight: 700,
                              cursor: 'pointer'
                            }}
                          >
                            {resolving ? 'Resolving...' : 'Confirm Resolved'}
                          </button>
                        </div>
                      </div>
                    ) : (
                      <button
                        onClick={() => { setSelectedIssue(issue); setResolutionText(''); }}
                        style={{
                          padding: '6px 14px',
                          borderRadius: '6px',
                          border: 'none',
                          backgroundColor: '#DC2626',
                          color: '#FFFFFF',
                          fontSize: '12px',
                          fontWeight: 700,
                          cursor: 'pointer'
                        }}
                      >
                        Resolve Issue
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

    </div>
  );
}
