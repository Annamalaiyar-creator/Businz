import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Plus, Search, Phone, MessageCircle, RotateCcw, Building2, X, User, Calendar, CalendarClock, Eye, Edit3, UserCheck, ArrowRightLeft, Trash2, UserPlus } from 'lucide-react';
import { slApi, onSmartLeadChange, formatDate, isOverdue } from './smartLeadsApi';
import { StageBadge, TempBadge, Pager, EmptyState, SkeletonRows } from './SlShared';
import LeadFormModal from './LeadFormModal';
import { StageModal, AssignModal, ScheduleFollowupModal } from './LeadActions';

const EMPTY_FILTERS = { search: '', stage: '', source: '', owner: '', temperature: '', due: '', sort: 'newest' };

export default function AllLeadsView({ meta, onOpenLead, toast, canCreateLead = true, onNavigateTab }) {
  const [filters, setFilters] = useState(EMPTY_FILTERS);
  const [searchInput, setSearchInput] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [data, setData] = useState({ rows: [], total: 0, stageCounts: {} });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selected, setSelected] = useState([]);
  const [modal, setModal] = useState(null);
  const reqId = useRef(0);
  const isManager = !!meta?.me?.isManager;
  const isAdmin = !!meta?.me?.isAdmin;
  const activeRole = String(meta?.me?.role || localStorage.getItem('vrm_user_role') || '').toLowerCase().trim();
  const isSales = /sales/i.test(activeRole) && !/ceo|tech\s*support|technical\s*support|technical\s*admin|admin|md/i.test(activeRole);
  const effectiveCanCreate = canCreateLead && !isSales;

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

  // Realtime: SSE carries IDs only. Fetch just that one row (scoped) when it affects the visible page — never a full reload.
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
    })).catch(() => { /* not visible to this user */ });
  }), [filters, page, pageSize]);

  const setFilter = (k, v) => { setFilters(f => ({ ...f, [k]: v })); setPage(1); setSelected([]); };
  const toggle = (id) => setSelected(s => (s.includes(id) ? s.filter(x => x !== id) : [...s, id]));
  const allOnPage = data.rows.length > 0 && data.rows.every(r => selected.includes(r.id));
  const toggleAll = () => setSelected(allOnPage ? [] : data.rows.map(r => r.id));
  const selectedLeads = data.rows.filter(r => selected.includes(r.id));

  const afterAction = (lead, msg) => {
    setModal(null);
    if (msg) toast(msg);
    if (lead) setData(d => ({ ...d, rows: d.rows.some(r => r.id === lead.id) ? d.rows.map(r => (r.id === lead.id ? { ...r, ...lead } : r)) : [lead, ...d.rows].slice(0, pageSize), total: d.rows.some(r => r.id === lead.id) ? d.total : d.total + 1 }));
    else { setSelected([]); load(); } // bulk actions: one paginated reload of the current page
  };

  const bulkDelete = async () => {
    if (!window.confirm(`Delete ${selected.length} lead(s)? They will be hidden from Smart Leads (soft delete, recoverable by admin).`)) return;
    try { await slApi.bulk({ ids: selected, action: 'delete' }); toast(`${selected.length} lead(s) deleted`); setSelected([]); load(); }
    catch (err) { toast(err.message, 'error'); }
  };

  const stages = meta?.stages || [];
  const totalAll = Object.values(data.stageCounts).reduce((a, b) => a + b, 0);

  return (
    <div>
      {/* Search & Filter Bar (Matching CRM Customers Standard Design) */}
      <div style={{
        display: 'flex',
        padding: '12px 16px',
        backgroundColor: '#fafbfc',
        borderRadius: '12px',
        border: '1px solid #e2e8f0',
        alignItems: 'center',
        width: '100%',
        boxSizing: 'border-box',
        justifyContent: 'space-between',
        gap: '12px',
        flexWrap: 'wrap',
        marginBottom: '14px'
      }}>
        {/* Left Search Input */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          border: '1px solid #cbd5e1',
          borderRadius: '8px',
          padding: '0 12px',
          height: '38px',
          backgroundColor: '#f8fafc',
          width: '360px',
          maxWidth: '100%'
        }}>
          <Search style={{ width: '15px', height: '15px', color: '#64748b', flexShrink: 0 }} />
          <input
            id="smart-leads-search-term"
            type="text"
            placeholder="Search Leads (Company, Contact, Phone, Lead No)..."
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            style={{ border: 'none', background: 'none', outline: 'none', fontSize: '13px', width: '100%', color: '#334155' }}
            aria-label="Search leads"
          />
          {searchInput && (
            <X size={15} color="#94A3B8" style={{ cursor: 'pointer', flexShrink: 0 }} onClick={() => setSearchInput('')} />
          )}
        </div>

        {/* Right Stage Dropdown, Reset & Actions */}
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap', flexShrink: 0, marginLeft: 'auto' }}>
          {/* Stage Dropdown (All, New, Contacted, Qualified, Quotation Sent, Negotiation, Won, Lost) */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', border: '1px solid #cbd5e1', borderRadius: '8px', padding: '0 12px', height: '38px', backgroundColor: '#FFFFFF' }}>
            <Building2 style={{ width: '14px', height: '14px', color: '#64748b', flexShrink: 0 }} />
            <select
              id="smart-leads-stage-select"
              aria-label="Filter by stage"
              value={filters.stage}
              onChange={(e) => setFilter('stage', e.target.value)}
              style={{ border: 'none', outline: 'none', fontSize: '13px', color: '#334155', backgroundColor: 'transparent', cursor: 'pointer' }}
            >
              <option value="">All Stages {totalAll > 0 ? `(${totalAll})` : ''}</option>
              {stages.map(s => (
                <option key={s} value={s}>
                  {s} {data.stageCounts[s] ? `(${data.stageCounts[s]})` : ''}
                </option>
              ))}
            </select>
          </div>

          {/* Reset / Reload Filter button (RotateCcw) */}
          <button
            onClick={() => {
              setSearchInput('');
              setFilters(EMPTY_FILTERS);
              setPage(1);
              setSelected([]);
              load();
            }}
            title="Reset Filters"
            style={{
              background: '#f1f5f9',
              border: '1px solid #cbd5e1',
              color: '#475569',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: '8px',
              height: '38px',
              width: '38px',
              flexShrink: 0
            }}
          >
            <RotateCcw style={{ width: '15px', height: '15px' }} />
          </button>

          {/* New Lead (Admin / Privileged Only) */}
          {effectiveCanCreate && (
            <button
              onClick={() => setModal({ type: 'create' })}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                height: '38px',
                padding: '0 14px',
                borderRadius: '8px',
                border: '1px solid #0E7490',
                background: '#0E7490',
                color: '#FFFFFF',
                fontSize: '13px',
                fontWeight: '700',
                cursor: 'pointer',
                whiteSpace: 'nowrap',
                boxShadow: '0 1px 2px rgba(14,116,144,0.2)'
              }}
            >
              <Plus size={15} /> New lead
            </button>
          )}
        </div>
      </div>

      {/* Stage Filter Pills */}
      <div style={{ display: 'flex', gap: '8px', padding: '2px 0 12px', alignItems: 'center', flexWrap: 'wrap' }}>
        {[{ id: '', label: 'All Stages', count: totalAll }, ...stages.map(s => ({ id: s, label: s, count: data.stageCounts[s] || 0 }))].map(pill => {
          const isSelected = (filters.stage || '') === pill.id;
          return (
            <button
              key={pill.id || 'all'}
              type="button"
              onClick={() => setFilter('stage', pill.id)}
              style={{
                backgroundColor: isSelected ? '#0E7490' : '#FFFFFF',
                color: isSelected ? '#FFFFFF' : '#334155',
                border: isSelected ? '1px solid #0E7490' : '1px solid #E2E8F0',
                borderRadius: '9999px',
                padding: '7px 14px',
                fontSize: '12.5px',
                fontWeight: '700',
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                boxShadow: isSelected ? '0 2px 8px rgba(14, 116, 144, 0.25)' : '0 1px 2px rgba(15, 23, 42, 0.04)',
                transition: 'all 0.15s ease',
                whiteSpace: 'nowrap'
              }}
            >
              <span>{pill.label}</span>
              <span style={{
                fontSize: '11px',
                padding: '1px 7px',
                borderRadius: '9999px',
                backgroundColor: isSelected ? 'rgba(255, 255, 255, 0.22)' : '#F1F5F9',
                color: isSelected ? '#FFFFFF' : '#475569',
                fontWeight: '800',
                lineHeight: '1.3'
              }}>
                {pill.count}
              </span>
            </button>
          );
        })}
      </div>

      {error && <div className="sl-alert sl-alert-error">{error} <button className="sl-btn sl-btn-sm" style={{ marginLeft: 8 }} onClick={load}>Retry</button></div>}

      <div className="sl-card sl-table-wrap">
        {loading && data.rows.length === 0 ? <SkeletonRows /> : data.rows.length === 0 ? (
          <EmptyState
            title="No leads found"
            text={effectiveCanCreate ? "Try adjusting filters, or create a new lead." : "Try adjusting your filters to find leads."}
            action={effectiveCanCreate ? <button className="sl-btn sl-btn-primary" onClick={() => setModal({ type: 'create' })}><Plus size={15} /> New lead</button> : null}
          />
        ) : (
          <>
            <div style={{ overflowX: 'auto', width: '100%' }}>
              <table className="sl-table custom-table" style={{ width: '100%', minWidth: '1080px', borderCollapse: 'collapse', fontSize: '13px', textAlign: 'left' }}>
                <thead>
                  <tr style={{ color: '#475569', borderBottom: '1px solid #E2E8F0', backgroundColor: '#F8FAFC', fontSize: '12px', fontWeight: 'bold', height: '48px' }}>
                    <th style={{ width: '48px', minWidth: '48px', maxWidth: '48px', padding: '12px 0', textAlign: 'center', verticalAlign: 'middle', boxSizing: 'border-box' }}>
                      <input
                        type="checkbox"
                        checked={allOnPage}
                        onChange={toggleAll}
                        style={{ accentColor: '#0E7490', cursor: 'pointer', verticalAlign: 'middle', margin: 0, width: '16px', height: '16px' }}
                        aria-label="Select all on page"
                      />
                    </th>
                    <th style={{ padding: '12px 14px', fontWeight: 'bold', whiteSpace: 'nowrap' }}>Lead & Company</th>
                    <th style={{ padding: '12px 14px', fontWeight: 'bold', whiteSpace: 'nowrap' }}>Primary Contact</th>
                    <th style={{ padding: '12px 14px', fontWeight: 'bold', whiteSpace: 'nowrap', textAlign: 'center' }}>Stage</th>
                    <th style={{ padding: '12px 14px', fontWeight: 'bold', whiteSpace: 'nowrap' }}>Priority</th>
                    <th style={{ padding: '12px 14px', fontWeight: 'bold', whiteSpace: 'nowrap' }}>Assigned To</th>
                    <th style={{ padding: '12px 14px', fontWeight: 'bold', whiteSpace: 'nowrap' }}>Next Action</th>
                  </tr>
                </thead>
                <tbody>
                  {data.rows.map(l => {
                    const isChecked = selected.includes(l.id);
                    return (
                      <tr
                        key={l.id}
                        className={`table-row-hover ${isChecked ? 'selected' : ''}`}
                        style={{
                          borderBottom: '1px solid #F1F5F9',
                          backgroundColor: isChecked ? '#ECFEFF' : 'transparent',
                          cursor: 'pointer',
                          transition: 'background-color 0.15s ease'
                        }}
                        onClick={() => onOpenLead(l.id)}
                      >
                        <td
                          onClick={e => e.stopPropagation()}
                          style={{
                            width: '48px',
                            minWidth: '48px',
                            maxWidth: '48px',
                            padding: '12px 0',
                            textAlign: 'center',
                            verticalAlign: 'middle',
                            boxSizing: 'border-box',
                            borderLeft: isChecked ? '4px solid #0E7490' : '4px solid transparent'
                          }}
                        >
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => toggle(l.id)}
                            style={{ accentColor: '#0E7490', cursor: 'pointer', verticalAlign: 'middle', margin: 0, width: '16px', height: '16px' }}
                            aria-label={`Select ${l.company_name}`}
                          />
                        </td>
                        <td style={{ padding: '12px 14px' }}>
                          <div style={{ fontWeight: 700, color: '#0F172A', fontSize: '13px' }}>{l.company_name}</div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '2px', flexWrap: 'wrap' }}>
                            <span style={{ fontSize: '11px', color: '#0E7490', fontWeight: 700 }}>{l.lead_number}</span>
                            {l.source && <span style={{ fontSize: '11px', color: '#64748B' }}>• {l.source}</span>}
                            {l.created_at && <span style={{ fontSize: '11px', color: '#94A3B8' }}>• {formatDate(l.created_at)}</span>}
                          </div>
                        </td>
                        <td style={{ padding: '12px 14px' }}>
                          <div style={{ fontWeight: 600, color: '#1E293B', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '5px' }}>
                            <User size={13} style={{ color: '#64748B' }} />
                            <span>{l.contact_person || '—'}</span>
                          </div>
                          {(l.phone || l.email) && (
                            <div style={{ fontSize: '11px', color: '#64748B', display: 'flex', alignItems: 'center', gap: '4px', marginTop: '2px' }}>
                              {l.phone && <><Phone size={11} style={{ color: '#94A3B8' }} /> <span>{l.phone}</span></>}
                              {l.phone && l.email && <span>·</span>}
                              {l.email && <span style={{ color: '#94A3B8' }}>{l.email}</span>}
                            </div>
                          )}
                        </td>
                        <td style={{ padding: '12px 14px', textAlign: 'center' }}>
                          <StageBadge stage={l.pipeline_stage} />
                        </td>
                        <td style={{ padding: '12px 14px' }}>
                          <TempBadge temperature={l.temperature} score={l.score} />
                        </td>
                        <td style={{ padding: '12px 14px' }}>
                          {l.assigned_to_name ? (
                            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                              <div style={{
                                width: '24px',
                                height: '24px',
                                borderRadius: '50%',
                                backgroundColor: '#E0F2FE',
                                color: '#0369A1',
                                fontSize: '11px',
                                fontWeight: 700,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center'
                              }}>
                                {l.assigned_to_name.charAt(0).toUpperCase()}
                              </div>
                              <span style={{ fontWeight: 600, color: '#0F172A', fontSize: '12px' }}>
                                {l.assigned_to_name}
                              </span>
                            </div>
                          ) : (
                            <span style={{ fontSize: '11px', color: '#D97706', fontWeight: 600, backgroundColor: '#FEF3C7', padding: '2px 8px', borderRadius: '4px' }}>
                              Unassigned
                            </span>
                          )}
                        </td>
                        <td style={{ padding: '12px 14px' }}>
                          {l.next_action_due_at ? (
                            <div>
                              <div style={{
                                fontSize: '11px',
                                fontWeight: 700,
                                color: isOverdue(l.next_action_due_at) ? '#DC2626' : '#0E7490',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '4px'
                              }}>
                                <Calendar size={11} /> {formatDate(l.next_action_due_at, true)}
                              </div>
                              {l.next_action && (
                                <div style={{ fontSize: '11px', color: '#64748B', maxWidth: '200px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', marginTop: '2px' }}>
                                  {l.next_action}
                                </div>
                              )}
                            </div>
                          ) : (
                            <span style={{ fontSize: '11px', color: '#94A3B8' }}>
                              {['Won', 'Lost'].includes(l.pipeline_stage) ? '—' : 'Not set'}
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="sl-mlist">
              {data.rows.map(l => (
                <div key={l.id} className={`sl-mcard ${selected.includes(l.id) ? 'selected' : ''}`}>
                  <input type="checkbox" checked={selected.includes(l.id)} onChange={() => toggle(l.id)} aria-label={`Select ${l.company_name}`} style={{ marginTop: 2 }} />
                  <div className="sl-mcard-body" onClick={() => onOpenLead(l.id)} role="button" tabIndex={0}>
                    <div className="sl-mcard-row"><span className="sl-strong sl-ellipsis">{l.company_name}</span><StageBadge stage={l.pipeline_stage} /></div>
                    <div className="sl-muted sl-ellipsis">{l.contact_person || '—'} · {l.assigned_to_name || 'Unassigned'}</div>
                    <div className="sl-mcard-row" style={{ marginTop: 6 }}>
                      <TempBadge temperature={l.temperature} score={l.score} />
                      <span className={`sl-faint ${isOverdue(l.next_action_due_at) ? 'sl-overdue' : ''}`}>{l.next_action_due_at ? formatDate(l.next_action_due_at, true) : 'No next action'}</span>
                    </div>
                    {(l.phone || l.whatsapp) && (
                      <div className="sl-quick" onClick={e => e.stopPropagation()}>
                        {l.phone && <a className="sl-btn sl-btn-sm" href={`tel:${l.phone}`}><Phone size={13} /> Call</a>}
                        <a className="sl-btn sl-btn-sm" href={`https://wa.me/${String(l.whatsapp || l.phone).replace(/\D/g, '').replace(/^(\d{10})$/, '91$1')}`} target="_blank" rel="noreferrer"><MessageCircle size={13} /> WhatsApp</a>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
            <Pager page={page} pageSize={pageSize} total={data.total} onPage={(p) => { setPage(p); setSelected([]); }} onPageSize={(s) => { setPageSize(s); setPage(1); setSelected([]); }} />
          </>
        )}
      </div>

      {selected.length > 0 && (
        <div className="sl-actionbar" role="toolbar" aria-label="Selected leads actions">
          <span style={{ fontSize: '13px', fontWeight: '700', color: '#64748B', display: 'inline-flex', alignItems: 'center', gap: '4px', paddingRight: '6px', whiteSpace: 'nowrap', flexShrink: 0 }}>
            <strong style={{ color: '#0F172A', fontSize: '14px' }}>{selected.length}</strong> Selected
          </span>
          <span className="sep" />
          {selected.length === 1 && (
            <button onClick={() => onOpenLead(selected[0])}>
              <Eye size={13} style={{ color: '#64748B' }} /> View Details
            </button>
          )}
          {selected.length === 1 && (
            <button onClick={() => setModal({ type: 'edit', lead: selectedLeads[0] })}>
              <Edit3 size={13} style={{ color: '#64748B' }} /> Edit Info
            </button>
          )}
          {selected.length === 1 && (
            <button onClick={() => setModal({ type: 'followup', lead: selectedLeads[0] })}>
              <CalendarClock size={13} style={{ color: '#64748B' }} /> Follow-up
            </button>
          )}
          {selected.length === 1 && !selectedLeads[0]?.is_converted && (
            <button
              onClick={async () => {
                const lead = selectedLeads[0];
                if (!lead) return;
                try {
                  const res = await slApi.convertToCustomer(lead.id);
                  toast(res.message || 'Converted to Customer successfully!');
                  load();
                  setSelected([]);
                } catch (err) {
                  toast(err.message, 'error');
                }
              }}
              style={{ color: '#0E7490', fontWeight: 700 }}
              title="Convert this lead to an official Customer Master record"
            >
              <UserPlus size={13} style={{ color: '#0E7490' }} /> Convert to Customer
            </button>
          )}
          {isManager && (
            <button onClick={() => setModal({ type: 'assign' })}>
              <UserCheck size={13} style={{ color: '#64748B' }} /> Reassign
            </button>
          )}
          {isManager && (
            <button onClick={() => setModal({ type: 'stage' })}>
              <ArrowRightLeft size={13} style={{ color: '#64748B' }} /> Change Stage
            </button>
          )}
          {isAdmin && (
            <button className="sl-actionbar-danger" onClick={bulkDelete}>
              <Trash2 size={13} /> Delete
            </button>
          )}
          <button className="sl-actionbar-close" onClick={() => setSelected([])} aria-label="Clear selection">✕</button>
        </div>
      )}

      {modal?.type === 'create' && <LeadFormModal meta={meta} onClose={() => setModal(null)} onSaved={afterAction} />}
      {modal?.type === 'edit' && <LeadEditLoader lead={modal.lead} meta={meta} onClose={() => setModal(null)} onSaved={afterAction} toast={toast} />}
      {modal?.type === 'followup' && <ScheduleFollowupModal lead={modal.lead} onClose={() => setModal(null)} onDone={afterAction} />}
      {modal?.type === 'assign' && <AssignModal meta={meta} leads={selectedLeads} onClose={() => setModal(null)} onDone={afterAction} />}
      {modal?.type === 'stage' && (
        selectedLeads.length === 1
          ? <StageModal meta={meta} lead={selectedLeads[0]} onClose={() => setModal(null)} onDone={afterAction} />
          : <StageModal meta={meta} lead={{ company_name: `${selectedLeads.length} leads`, pipeline_stage: null }} bulkIds={selected} onClose={() => setModal(null)} onDone={afterAction} />
      )}
    </div>
  );
}

// Edit needs full detail fields (designation, requirement…) that list rows don't carry: fetch the one lead first.
function LeadEditLoader({ lead, meta, onClose, onSaved, toast }) {
  const [full, setFull] = useState(null);
  useEffect(() => {
    let alive = true;
    slApi.getLead(lead.id).then(r => alive && setFull(r.lead)).catch(err => { toast(err.message, 'error'); onClose(); });
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- fetch once per lead; callbacks are inline arrows
  }, [lead.id]);
  if (!full) return null;
  return <LeadFormModal meta={meta} lead={full} onClose={onClose} onSaved={onSaved} />;
}
