import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Search, RotateCcw, RefreshCw, ChevronLeft, ChevronRight,
  ChevronsLeft, ChevronsRight, Plus
} from 'lucide-react';
import { slApi, onSmartLeadChange, formatINR, formatDate, isOverdue } from './smartLeadsApi';
import { StageBadge, TempBadge, SkeletonRows, EmptyState } from './SlShared';
import LeadFormModal from './LeadFormModal';
import { StageModal, AssignModal } from './LeadActions';

const EMPTY_FILTERS = { search: '', stage: '', source: '', owner: '', temperature: '', due: '', sort: 'newest' };

export default function AllLeadsView({ meta, onOpenLead, toast }) {
  const [filters, setFilters] = useState(EMPTY_FILTERS);
  const [searchInput, setSearchInput] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [goToPageInput, setGoToPageInput] = useState('');
  const [data, setData] = useState({ rows: [], total: 0, stageCounts: {} });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selected, setSelected] = useState([]);
  const [modal, setModal] = useState(null);
  const reqId = useRef(0);
  const isManager = !!meta?.me?.isManager;
  const isAdmin = !!meta?.me?.isAdmin;

  const load = useCallback(async () => {
    const id = ++reqId.current;
    setLoading(true); setError('');
    try {
      const res = await slApi.listLeads({ ...filters, page, pageSize });
      if (id !== reqId.current) return;
      setData({ rows: res.data, total: res.total, stageCounts: res.stageCounts || {} });
    } catch (err) {
      if (id === reqId.current) setError(err.message);
    } finally {
      if (id === reqId.current) setLoading(false);
    }
  }, [filters, page, pageSize]);

  useEffect(() => { load(); }, [load]);

  // Debounced search
  useEffect(() => {
    const t = setTimeout(() => { setFilters(f => (f.search === searchInput ? f : { ...f, search: searchInput })); setPage(1); }, 300);
    return () => clearTimeout(t);
  }, [searchInput]);

  // Realtime: single-row merge
  const rowsRef = useRef([]);
  rowsRef.current = data.rows;
  useEffect(() => onSmartLeadChange(({ action, leadId }) => {
    if (!leadId) return;
    if (action === 'delete') { setData(d => ({ ...d, rows: d.rows.filter(r => r.id !== leadId) })); return; }
    const onPage = rowsRef.current.some(r => r.id === leadId);
    const unfiltered = Object.entries(filters).every(([k, v]) => k === 'sort' || !v);
    const canPrepend = action === 'create' && page === 1 && unfiltered && filters.sort === 'newest';
    if (!onPage && !canPrepend) return;
    slApi.leadSummary(leadId).then(({ lead }) => setData(d => {
      const idx = d.rows.findIndex(r => r.id === lead.id);
      if (idx >= 0) { const rows = [...d.rows]; rows[idx] = { ...rows[idx], ...lead }; return { ...d, rows }; }
      return { ...d, rows: [lead, ...d.rows].slice(0, pageSize), total: d.total + 1 };
    })).catch(() => {});
  }), [filters, page, pageSize]);

  const setFilter = (k, v) => { setFilters(f => ({ ...f, [k]: v })); setPage(1); setSelected([]); };
  const toggle = (id) => setSelected(s => (s.includes(id) ? s.filter(x => x !== id) : [...s, id]));
  const allOnPage = data.rows.length > 0 && data.rows.every(r => selected.includes(r.id));
  const toggleAll = () => setSelected(allOnPage ? [] : data.rows.map(r => r.id));
  const selectedLeads = data.rows.filter(r => selected.includes(r.id));

  const clearFilters = () => {
    setSearchInput('');
    setFilters(EMPTY_FILTERS);
    setPage(1);
    setSelected([]);
  };

  const afterAction = (lead, msg) => {
    setModal(null);
    if (msg && toast) toast(msg, 'success');
    if (lead) setData(d => ({ ...d, rows: d.rows.some(r => r.id === lead.id) ? d.rows.map(r => (r.id === lead.id ? { ...r, ...lead } : r)) : [lead, ...d.rows].slice(0, pageSize), total: d.rows.some(r => r.id === lead.id) ? d.total : d.total + 1 }));
    else { setSelected([]); load(); }
  };

  const bulkDelete = async () => {
    if (!window.confirm(`Delete ${selected.length} lead(s)? They will be hidden from Smart Leads (soft delete).`)) return;
    try {
      await slApi.bulk({ ids: selected, action: 'delete' });
      if (toast) toast(`${selected.length} lead(s) deleted`, 'success');
      setSelected([]);
      load();
    } catch (err) {
      if (toast) toast(err.message, 'error');
    }
  };

  const stages = meta?.stages || ['New', 'Contacted', 'Qualified', 'Quotation Sent', 'Negotiation', 'Won', 'Lost'];
  const totalAll = Object.values(data.stageCounts).reduce((a, b) => a + b, 0);
  const totalPages = Math.max(1, Math.ceil(data.total / pageSize));
  const safePage = Math.min(page, totalPages);
  const fromRecord = data.total === 0 ? 0 : (safePage - 1) * pageSize + 1;
  const toRecord = Math.min(data.total, safePage * pageSize);

  const hasActiveFilters = searchInput || filters.stage || filters.source || filters.owner || filters.temperature || filters.due || filters.sort !== 'newest';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', width: '100%' }}>
      {/* AUTHORITATIVE CARD CONTAINER (NATIVE BUSINZ TABLE DESIGN) */}
      <div className="section-card" style={{ padding: '0', backgroundColor: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: '12px', overflow: 'hidden', width: '100%', boxSizing: 'border-box' }}>
        
        {/* 1. Integrated Search & Dropdown Filters Strip */}
        <div style={{ padding: '14px 20px', backgroundColor: '#FFFFFF', borderBottom: '1px solid #F1F5F9', display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
          <div style={{ position: 'relative', flex: '1 1 260px', minWidth: '220px' }}>
            <input
              type="text"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Search company, contact, phone, lead no..."
              style={{ height: '38px', borderRadius: '8px', border: '1px solid #CBD5E1', padding: '0 12px 0 36px', fontSize: '13px', width: '100%', boxSizing: 'border-box', backgroundColor: '#FFFFFF', color: '#334155', outline: 'none' }}
            />
            <Search style={{ width: '14px', height: '14px', color: '#94A3B8', position: 'absolute', left: '12px', top: '12px' }} />
          </div>

          <div style={{ minWidth: '130px' }}>
            <select
              value={filters.source}
              onChange={(e) => setFilter('source', e.target.value)}
              style={{ height: '38px', width: '100%', borderRadius: '8px', border: '1px solid #CBD5E1', padding: '0 12px', fontSize: '13px', backgroundColor: '#FFFFFF', color: '#334155', outline: 'none' }}
            >
              <option value="">All Sources</option>
              {['IndiaMART', 'Website', 'WhatsApp', 'Referral', 'Manual', 'Direct', 'Meta'].map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>

          <div style={{ minWidth: '140px' }}>
            <select
              value={filters.temperature}
              onChange={(e) => setFilter('temperature', e.target.value)}
              style={{ height: '38px', width: '100%', borderRadius: '8px', border: '1px solid #CBD5E1', padding: '0 12px', fontSize: '13px', backgroundColor: '#FFFFFF', color: '#334155', outline: 'none' }}
            >
              <option value="">All Priorities</option>
              {['Hot', 'Warm', 'Cold'].map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>

          {isManager && (
            <div style={{ minWidth: '150px' }}>
              <select
                value={filters.owner}
                onChange={(e) => setFilter('owner', e.target.value)}
                style={{ height: '38px', width: '100%', borderRadius: '8px', border: '1px solid #CBD5E1', padding: '0 12px', fontSize: '13px', backgroundColor: '#FFFFFF', color: '#334155', outline: 'none' }}
              >
                <option value="">All Assignees</option>
                <option value="unassigned">Unassigned</option>
                {(meta?.team || []).map(t => <option key={t.user_id} value={t.user_id}>{t.name}</option>)}
              </select>
            </div>
          )}

          <div style={{ minWidth: '140px' }}>
            <select
              value={filters.due}
              onChange={(e) => setFilter('due', e.target.value)}
              style={{ height: '38px', width: '100%', borderRadius: '8px', border: '1px solid #CBD5E1', padding: '0 12px', fontSize: '13px', backgroundColor: '#FFFFFF', color: '#334155', outline: 'none' }}
            >
              <option value="">Any Next Action</option>
              <option value="overdue">Overdue</option>
              <option value="today">Due Today</option>
              <option value="none">No Next Action</option>
            </select>
          </div>

          <div style={{ minWidth: '140px' }}>
            <select
              value={filters.sort}
              onChange={(e) => setFilter('sort', e.target.value)}
              style={{ height: '38px', width: '100%', borderRadius: '8px', border: '1px solid #CBD5E1', padding: '0 12px', fontSize: '13px', backgroundColor: '#FFFFFF', color: '#334155', outline: 'none' }}
            >
              <option value="newest">Sort: Newest</option>
              <option value="score">Sort: Highest Score</option>
              <option value="due">Sort: Next Action Due</option>
              <option value="value">Sort: Highest Value</option>
              <option value="updated">Sort: Recently Updated</option>
            </select>
          </div>

          {hasActiveFilters && (
            <button
              onClick={clearFilters}
              title="Reset Filters"
              style={{
                height: '38px', padding: '0 12px', borderRadius: '8px',
                border: '1px solid #CBD5E1', backgroundColor: '#F8FAFC',
                color: '#475569', fontSize: '12px', fontWeight: '600',
                cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px'
              }}
            >
              <RotateCcw size={13} /> Reset
            </button>
          )}

          <button
            onClick={load}
            title="Refresh Leads"
            style={{
              height: '38px', width: '38px', borderRadius: '8px',
              border: '1px solid #CBD5E1', backgroundColor: '#FFFFFF',
              color: '#475569', cursor: 'pointer', display: 'flex',
              alignItems: 'center', justifyContent: 'center', marginLeft: 'auto'
            }}
          >
            <RefreshCw size={14} />
          </button>
        </div>

        {/* 2. Status Sub-Tabs Row (Exact Native BUSINZ Underline Tabs Design) */}
        <div style={{
          display: 'flex', borderBottom: '1px solid #E2E8F0', padding: '0 20px',
          gap: '20px', alignItems: 'center', flexWrap: 'nowrap', backgroundColor: '#FFFFFF',
          overflowX: 'auto', scrollbarWidth: 'none'
        }}>
          <button
            onClick={() => setFilter('stage', '')}
            style={{
              border: 'none', background: 'transparent', padding: '12px 4px',
              fontSize: '13px', fontWeight: 'bold',
              color: !filters.stage ? '#0E7490' : '#64748B',
              borderBottom: !filters.stage ? '2px solid #0E7490' : '2px solid transparent',
              cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', whiteSpace: 'nowrap'
            }}
          >
            <span>All Leads</span>
            <span style={{
              fontSize: '10px', fontWeight: 'bold',
              backgroundColor: !filters.stage ? '#ECFEFF' : '#F1F5F9',
              color: !filters.stage ? '#0E7490' : '#475569',
              padding: '1px 7px', borderRadius: '10px'
            }}>
              {totalAll}
            </span>
          </button>

          {stages.map(st => {
            const isActive = filters.stage === st;
            const count = data.stageCounts[st] || 0;
            return (
              <button
                key={st}
                onClick={() => setFilter('stage', st)}
                style={{
                  border: 'none', background: 'transparent', padding: '12px 4px',
                  fontSize: '13px', fontWeight: 'bold',
                  color: isActive ? '#0E7490' : '#64748B',
                  borderBottom: isActive ? '2px solid #0E7490' : '2px solid transparent',
                  cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', whiteSpace: 'nowrap'
                }}
              >
                <span>{st}</span>
                <span style={{
                  fontSize: '10px', fontWeight: 'bold',
                  backgroundColor: isActive ? '#ECFEFF' : '#F1F5F9',
                  color: isActive ? '#0E7490' : '#475569',
                  padding: '1px 7px', borderRadius: '10px'
                }}>
                  {count}
                </span>
              </button>
            );
          })}
        </div>

        {error && (
          <div style={{ padding: '12px 20px', background: '#FEF2F2', color: '#DC2626', fontSize: '13px' }}>
            {error} <button onClick={load} style={{ marginLeft: '10px', fontWeight: 'bold', cursor: 'pointer', background: 'none', border: 'none', color: '#DC2626', textDecoration: 'underline' }}>Retry</button>
          </div>
        )}

        {/* 3. Table Content */}
        {loading && data.rows.length === 0 ? (
          <div style={{ padding: '24px' }}><SkeletonRows rows={6} /></div>
        ) : data.rows.length === 0 ? (
          <div style={{ padding: '40px 20px', textAlign: 'center' }}>
            <EmptyState
              title="No leads found"
              text="Try adjusting your search query or filters."
              action={
                <button
                  onClick={() => setModal({ type: 'create' })}
                  style={{
                    backgroundColor: '#0E7490', border: 'none', color: '#FFFFFF',
                    padding: '8px 18px', borderRadius: '8px', fontSize: '13px',
                    fontWeight: '600', cursor: 'pointer', marginTop: '12px'
                  }}
                >
                  <Plus size={14} style={{ verticalAlign: -2, marginRight: 6 }} /> Create Lead
                </button>
              }
            />
          </div>
        ) : (
          <div style={{ overflowX: 'auto', width: '100%' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
              <thead>
                <tr style={{ height: '46px', backgroundColor: '#F8FAFC', borderBottom: '1px solid #E2E8F0' }}>
                  <th style={{ width: '44px', textAlign: 'center', padding: '0 8px' }}>
                    <input
                      type="checkbox"
                      checked={allOnPage}
                      onChange={toggleAll}
                      style={{ accentColor: '#0E7490', width: '16px', height: '16px', cursor: 'pointer' }}
                    />
                  </th>
                  <th style={{ padding: '10px 14px', fontSize: '11px', fontWeight: '700', color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.05em' }}>LEAD</th>
                  <th style={{ padding: '10px 14px', fontSize: '11px', fontWeight: '700', color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.05em' }}>CONTACT</th>
                  <th style={{ padding: '10px 14px', fontSize: '11px', fontWeight: '700', color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.05em' }}>STAGE</th>
                  <th style={{ padding: '10px 14px', fontSize: '11px', fontWeight: '700', color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.05em' }}>PRIORITY</th>
                  <th style={{ padding: '10px 14px', fontSize: '11px', fontWeight: '700', color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.05em' }}>OWNER</th>
                  <th style={{ padding: '10px 14px', fontSize: '11px', fontWeight: '700', color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.05em' }}>NEXT ACTION</th>
                  <th style={{ padding: '10px 14px', fontSize: '11px', fontWeight: '700', color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.05em', textAlign: 'right' }}>EST. VALUE</th>
                </tr>
              </thead>
              <tbody>
                {data.rows.map(l => {
                  const isSelected = selected.includes(l.id);
                  return (
                    <tr
                      key={l.id}
                      onClick={() => onOpenLead(l.id)}
                      style={{
                        backgroundColor: isSelected ? '#ECFEFF' : '#FFFFFF',
                        borderBottom: '1px solid #F1F5F9',
                        cursor: 'pointer',
                        transition: 'background-color 0.12s ease'
                      }}
                      onMouseEnter={(e) => { if (!isSelected) e.currentTarget.style.backgroundColor = '#F8FAFC'; }}
                      onMouseLeave={(e) => { if (!isSelected) e.currentTarget.style.backgroundColor = '#FFFFFF'; }}
                    >
                      <td
                        onClick={(e) => e.stopPropagation()}
                        style={{
                          textAlign: 'center', padding: '0 8px',
                          borderLeft: isSelected ? '4px solid #0E7490' : '4px solid transparent'
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggle(l.id)}
                          style={{ accentColor: '#0E7490', width: '16px', height: '16px', cursor: 'pointer' }}
                        />
                      </td>
                      <td style={{ padding: '12px 14px' }}>
                        <div style={{ fontWeight: '700', color: '#0F172A' }}>{l.company_name}</div>
                        <div style={{ fontSize: '11px', color: '#64748B', marginTop: '2px' }}>
                          {l.lead_number} · {l.source || 'Direct'} · {formatDate(l.created_at)}
                        </div>
                      </td>
                      <td style={{ padding: '12px 14px' }}>
                        <div style={{ color: '#1E293B', fontWeight: '500' }}>{l.contact_person || '—'}</div>
                        <div style={{ fontSize: '11px', color: '#64748B', marginTop: '2px' }}>{l.phone || l.email || '—'}</div>
                      </td>
                      <td style={{ padding: '12px 14px' }}>
                        <StageBadge stage={l.pipeline_stage} />
                      </td>
                      <td style={{ padding: '12px 14px' }}>
                        <TempBadge temperature={l.temperature} score={l.score} />
                      </td>
                      <td style={{ padding: '12px 14px', color: '#334155', fontWeight: '500' }}>
                        {l.assigned_to_name || <span style={{ color: '#94A3B8' }}>Unassigned</span>}
                      </td>
                      <td style={{ padding: '12px 14px' }}>
                        {l.next_action_due_at ? (
                          <>
                            <div style={{ color: isOverdue(l.next_action_due_at) ? '#DC2626' : '#334155', fontWeight: '600', fontSize: '12px' }}>
                              {formatDate(l.next_action_due_at, true)}
                            </div>
                            <div style={{ fontSize: '11px', color: '#64748B', maxWidth: '180px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {l.next_action}
                            </div>
                          </>
                        ) : (
                          <span style={{ color: '#94A3B8', fontSize: '12px' }}>
                            {['Won', 'Lost'].includes(l.pipeline_stage) ? '—' : 'Not set'}
                          </span>
                        )}
                      </td>
                      <td style={{ padding: '12px 14px', textAlign: 'right', fontWeight: '700', color: '#0F172A' }}>
                        {l.estimated_value ? formatINR(l.estimated_value) : <span style={{ color: '#94A3B8' }}>—</span>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* 4. Standard BUSINZ Pagination Footer (Rule 6 Strict Compliance) */}
        <div style={{
          padding: '14px 20px', backgroundColor: '#FFFFFF', borderTop: '1px solid #E2E8F0',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '12px', color: '#64748B' }}>Showing per page</span>
            <select
              value={pageSize}
              onChange={(e) => { setPageSize(Number(e.target.value)); setPage(1); setSelected([]); }}
              style={{ padding: '4px 8px', borderRadius: '6px', border: '1px solid #CBD5E1', fontSize: '12px', backgroundColor: '#FFFFFF', color: '#334155' }}
            >
              <option value={5}>5</option>
              <option value={10}>10</option>
            </select>
            <span style={{ fontSize: '12px', color: '#64748B', marginLeft: '6px' }}>
              Showing {fromRecord} to {toRecord} of {data.total} entries
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <button
              onClick={() => { setPage(1); setSelected([]); }}
              disabled={safePage === 1}
              style={{
                padding: '5px 8px', borderRadius: '6px', border: '1px solid #CBD5E1',
                backgroundColor: '#FFFFFF', color: '#475569', cursor: safePage === 1 ? 'not-allowed' : 'pointer',
                opacity: safePage === 1 ? 0.4 : 1
              }}
            >
              <ChevronsLeft size={14} />
            </button>
            <button
              onClick={() => { setPage(prev => Math.max(1, prev - 1)); setSelected([]); }}
              disabled={safePage === 1}
              style={{
                padding: '5px 8px', borderRadius: '6px', border: '1px solid #CBD5E1',
                backgroundColor: '#FFFFFF', color: '#475569', cursor: safePage === 1 ? 'not-allowed' : 'pointer',
                opacity: safePage === 1 ? 0.4 : 1
              }}
            >
              <ChevronLeft size={14} />
            </button>

            {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
              const startPage = Math.max(1, Math.min(safePage - 2, totalPages - 4));
              const p = startPage + i;
              if (p > totalPages) return null;
              return (
                <button
                  key={p}
                  onClick={() => { setPage(p); setSelected([]); }}
                  style={{
                    minWidth: '28px', height: '28px', padding: '0 6px', borderRadius: '6px',
                    border: '1px solid', borderColor: safePage === p ? '#0E7490' : '#CBD5E1',
                    backgroundColor: safePage === p ? '#0E7490' : '#FFFFFF',
                    color: safePage === p ? '#FFFFFF' : '#334155',
                    fontSize: '12px', fontWeight: 700, cursor: 'pointer'
                  }}
                >
                  {p}
                </button>
              );
            })}

            <button
              onClick={() => { setPage(prev => Math.min(totalPages, prev + 1)); setSelected([]); }}
              disabled={safePage === totalPages}
              style={{
                padding: '5px 8px', borderRadius: '6px', border: '1px solid #CBD5E1',
                backgroundColor: '#FFFFFF', color: '#475569', cursor: safePage === totalPages ? 'not-allowed' : 'pointer',
                opacity: safePage === totalPages ? 0.4 : 1
              }}
            >
              <ChevronRight size={14} />
            </button>
            <button
              onClick={() => { setPage(totalPages); setSelected([]); }}
              disabled={safePage === totalPages}
              style={{
                padding: '5px 8px', borderRadius: '6px', border: '1px solid #CBD5E1',
                backgroundColor: '#FFFFFF', color: '#475569', cursor: safePage === totalPages ? 'not-allowed' : 'pointer',
                opacity: safePage === totalPages ? 0.4 : 1
              }}
            >
              <ChevronsRight size={14} />
            </button>

            {/* Go to page input */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginLeft: '6px' }}>
              <span style={{ fontSize: '12px', color: '#64748B' }}>Go to page</span>
              <input
                type="number"
                min={1}
                max={totalPages}
                value={goToPageInput}
                onChange={(e) => setGoToPageInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    const p = parseInt(goToPageInput, 10);
                    if (p >= 1 && p <= totalPages) {
                      setPage(p);
                      setSelected([]);
                      setGoToPageInput('');
                    }
                  }
                }}
                style={{ width: '45px', padding: '4px 6px', borderRadius: '6px', border: '1px solid #CBD5E1', fontSize: '12px', textAlign: 'center' }}
              />
              <button
                onClick={() => {
                  const p = parseInt(goToPageInput, 10);
                  if (p >= 1 && p <= totalPages) {
                    setPage(p);
                    setSelected([]);
                    setGoToPageInput('');
                  }
                }}
                style={{ padding: '4px 10px', borderRadius: '6px', border: '1px solid #CBD5E1', backgroundColor: '#FFFFFF', color: '#334155', fontSize: '12px', fontWeight: '600', cursor: 'pointer' }}
              >
                Go ›
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Floating Bottom Action Bar (Rule 6 Single Line Toolbar) */}
      {selected.length > 0 && (
        <div style={{
          position: 'fixed', bottom: '24px', left: '50%', transform: 'translateX(-50%)',
          borderRadius: '50px', display: 'flex', flexDirection: 'row', flexWrap: 'nowrap',
          whiteSpace: 'nowrap', alignItems: 'center', gap: '6px', padding: '6px 12px 6px 18px',
          background: '#0F172A', color: '#FFFFFF', boxShadow: '0 10px 30px rgba(0,0,0,0.25)',
          zIndex: 1200, fontSize: '13px'
        }}>
          <span style={{ fontWeight: '700', marginRight: '6px' }}>{selected.length} Selected</span>
          <span style={{ width: '1px', height: '18px', background: 'rgba(255,255,255,0.2)', margin: '0 4px' }} />
          {selected.length === 1 && (
            <button
              onClick={() => onOpenLead(selected[0])}
              style={{ background: 'transparent', border: 'none', color: '#FFFFFF', padding: '6px 10px', borderRadius: '20px', fontSize: '12px', fontWeight: '600', cursor: 'pointer' }}
            >
              👁️ View Details
            </button>
          )}
          {selected.length === 1 && (
            <button
              onClick={() => setModal({ type: 'edit', lead: selectedLeads[0] })}
              style={{ background: 'transparent', border: 'none', color: '#FFFFFF', padding: '6px 10px', borderRadius: '20px', fontSize: '12px', fontWeight: '600', cursor: 'pointer' }}
            >
              ✏️ Edit Info
            </button>
          )}
          {isManager && (
            <button
              onClick={() => setModal({ type: 'assign' })}
              style={{ background: 'transparent', border: 'none', color: '#FFFFFF', padding: '6px 10px', borderRadius: '20px', fontSize: '12px', fontWeight: '600', cursor: 'pointer' }}
            >
              👤 Reassign
            </button>
          )}
          {isManager && (
            <button
              onClick={() => setModal({ type: 'stage' })}
              style={{ background: 'transparent', border: 'none', color: '#FFFFFF', padding: '6px 10px', borderRadius: '20px', fontSize: '12px', fontWeight: '600', cursor: 'pointer' }}
            >
              ↔️ Change Stage
            </button>
          )}
          {isAdmin && (
            <button
              onClick={bulkDelete}
              style={{ background: 'transparent', border: 'none', color: '#F87171', padding: '6px 10px', borderRadius: '20px', fontSize: '12px', fontWeight: '600', cursor: 'pointer' }}
            >
              🗑️ Delete
            </button>
          )}
          <button
            onClick={() => setSelected([])}
            style={{ background: 'transparent', border: 'none', color: '#94A3B8', padding: '6px 8px', borderRadius: '20px', fontSize: '13px', cursor: 'pointer' }}
          >
            ✕
          </button>
        </div>
      )}

      {/* Modals */}
      {modal?.type === 'create' && <LeadFormModal meta={meta} onClose={() => setModal(null)} onSaved={afterAction} />}
      {modal?.type === 'edit' && <LeadEditLoader lead={modal.lead} meta={meta} onClose={() => setModal(null)} onSaved={afterAction} toast={toast} />}
      {modal?.type === 'assign' && <AssignModal meta={meta} leads={selectedLeads} onClose={() => setModal(null)} onDone={afterAction} />}
      {modal?.type === 'stage' && (
        selectedLeads.length === 1
          ? <StageModal meta={meta} lead={selectedLeads[0]} onClose={() => setModal(null)} onDone={afterAction} />
          : <StageModal meta={meta} lead={{ company_name: `${selectedLeads.length} leads`, pipeline_stage: null }} bulkIds={selected} onClose={() => setModal(null)} onDone={afterAction} />
      )}
    </div>
  );
}

function LeadEditLoader({ lead, meta, onClose, onSaved, toast }) {
  const [full, setFull] = useState(null);
  useEffect(() => {
    let alive = true;
    slApi.getLead(lead.id).then(r => alive && setFull(r.lead)).catch(err => { if (toast) toast(err.message, 'error'); onClose(); });
    return () => { alive = false; };
  }, [lead.id]);
  if (!full) return null;
  return <LeadFormModal meta={meta} lead={full} onClose={onClose} onSaved={onSaved} />;
}
