import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Plus, Search, Phone, MessageCircle, RefreshCw } from 'lucide-react';
import { slApi, onSmartLeadChange, formatINR, formatDate, isOverdue } from './smartLeadsApi';
import { StageBadge, TempBadge, Pager, EmptyState, SkeletonRows } from './SlShared';
import LeadFormModal from './LeadFormModal';
import { StageModal, AssignModal } from './LeadActions';

const EMPTY_FILTERS = { search: '', stage: '', source: '', owner: '', temperature: '', due: '', sort: 'newest' };

export default function AllLeadsView({ meta, onOpenLead, toast }) {
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
      <div className="sl-toolbar">
        <div style={{ position: 'relative', flex: '1 1 260px', maxWidth: 360 }}>
          <Search size={15} style={{ position: 'absolute', left: 10, top: 11, color: '#9CA3AF' }} />
          <input className="sl-input" style={{ paddingLeft: 32, maxWidth: 'none' }} placeholder="Search company, contact, phone, lead no." value={searchInput} onChange={e => setSearchInput(e.target.value)} aria-label="Search leads" />
        </div>
        <select className="sl-select" value={filters.source} onChange={e => setFilter('source', e.target.value)} aria-label="Source">
          <option value="">All sources</option>
          {['IndiaMART', 'Website', 'WhatsApp', 'Referral', 'Manual', 'Direct', 'Meta'].map(s => <option key={s} value={s}>{s}</option>)}
        </select>
        {isManager && (
          <select className="sl-select" value={filters.owner} onChange={e => setFilter('owner', e.target.value)} aria-label="Owner">
            <option value="">All owners</option>
            <option value="unassigned">Unassigned</option>
            {(meta?.team || []).map(t => <option key={t.user_id} value={t.user_id}>{t.name}</option>)}
          </select>
        )}
        <select className="sl-select" value={filters.temperature} onChange={e => setFilter('temperature', e.target.value)} aria-label="Priority">
          <option value="">Hot / Warm / Cold</option>
          {['Hot', 'Warm', 'Cold'].map(t => <option key={t}>{t}</option>)}
        </select>
        <select className="sl-select" value={filters.due} onChange={e => setFilter('due', e.target.value)} aria-label="Next action">
          <option value="">Any next action</option>
          <option value="overdue">Overdue</option>
          <option value="today">Due today</option>
          <option value="none">No next action</option>
        </select>
        <select className="sl-select" value={filters.sort} onChange={e => setFilter('sort', e.target.value)} aria-label="Sort">
          <option value="newest">Newest</option>
          <option value="score">Highest score</option>
          <option value="due">Next action due</option>
          <option value="value">Highest value</option>
          <option value="updated">Recently updated</option>
        </select>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
          <button className="sl-btn" onClick={load} aria-label="Refresh"><RefreshCw size={14} /></button>
          <button className="sl-btn sl-btn-primary" onClick={() => setModal({ type: 'create' })}><Plus size={15} /> New lead</button>
        </div>
      </div>

      <div className="sl-chips" role="tablist" aria-label="Stage filter">
        <button className={`sl-chip ${!filters.stage ? 'active' : ''}`} onClick={() => setFilter('stage', '')}>All<span className="n">{filters.stage ? '' : totalAll}</span></button>
        {stages.map(s => (
          <button key={s} className={`sl-chip ${filters.stage === s ? 'active' : ''}`} onClick={() => setFilter('stage', s)}>
            {s}{!filters.stage && <span className="n">{data.stageCounts[s] || 0}</span>}
          </button>
        ))}
      </div>

      {error && <div className="sl-alert sl-alert-error">{error} <button className="sl-btn sl-btn-sm" style={{ marginLeft: 8 }} onClick={load}>Retry</button></div>}

      <div className="sl-card sl-table-wrap">
        {loading && data.rows.length === 0 ? <SkeletonRows /> : data.rows.length === 0 ? (
          <EmptyState title="No leads found" text="Try adjusting filters, or create a new lead." action={<button className="sl-btn sl-btn-primary" onClick={() => setModal({ type: 'create' })}><Plus size={15} /> New lead</button>} />
        ) : (
          <>
            <table className="sl-table">
              <thead>
                <tr>
                  <th style={{ width: 36 }}><input type="checkbox" checked={allOnPage} onChange={toggleAll} aria-label="Select all on page" /></th>
                  <th>Lead</th>
                  <th>Contact</th>
                  <th>Stage</th>
                  <th>Priority</th>
                  <th>Owner</th>
                  <th>Next action</th>
                  <th style={{ textAlign: 'right' }}>Est. value</th>
                </tr>
              </thead>
              <tbody>
                {data.rows.map(l => (
                  <tr key={l.id} className={selected.includes(l.id) ? 'selected' : ''} onClick={() => onOpenLead(l.id)}>
                    <td onClick={e => e.stopPropagation()}><input type="checkbox" checked={selected.includes(l.id)} onChange={() => toggle(l.id)} aria-label={`Select ${l.company_name}`} /></td>
                    <td><div className="sl-strong">{l.company_name}</div><div className="sl-faint">{l.lead_number} · {l.source || '—'} · {formatDate(l.created_at)}</div></td>
                    <td><div>{l.contact_person || '—'}</div><div className="sl-faint">{l.phone || l.email || '—'}</div></td>
                    <td><StageBadge stage={l.pipeline_stage} /></td>
                    <td><TempBadge temperature={l.temperature} score={l.score} /></td>
                    <td>{l.assigned_to_name || <span className="sl-faint">Unassigned</span>}</td>
                    <td>
                      {l.next_action_due_at ? (
                        <><div className={isOverdue(l.next_action_due_at) ? 'sl-overdue' : ''}>{formatDate(l.next_action_due_at, true)}</div><div className="sl-faint sl-ellipsis" style={{ maxWidth: 180 }}>{l.next_action}</div></>
                      ) : <span className="sl-faint">{['Won', 'Lost'].includes(l.pipeline_stage) ? '—' : 'Not set'}</span>}
                    </td>
                    <td style={{ textAlign: 'right' }}>{l.estimated_value ? formatINR(l.estimated_value) : <span className="sl-faint">—</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>

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
          <span>{selected.length} Selected</span>
          <span className="sep" />
          {selected.length === 1 && <button onClick={() => onOpenLead(selected[0])}>👁️ View Details</button>}
          {selected.length === 1 && <button onClick={() => setModal({ type: 'edit', lead: selectedLeads[0] })}>✏️ Edit Info</button>}
          {isManager && <button onClick={() => setModal({ type: 'assign' })}>👤 Reassign</button>}
          {isManager && <button onClick={() => setModal({ type: 'stage' })}>↔️ Change Stage</button>}
          {isAdmin && <button onClick={bulkDelete}>🗑️ Delete</button>}
          <button onClick={() => setSelected([])} aria-label="Clear selection">✕</button>
        </div>
      )}

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
