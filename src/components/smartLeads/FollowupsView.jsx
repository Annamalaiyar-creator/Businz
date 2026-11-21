import React, { useCallback, useEffect, useState } from 'react';
import {
  CalendarClock, Phone, MessageCircle, Mail, Users, CheckCircle2,
  Calendar, Search, X, RotateCcw, Building2, User, Eye
} from 'lucide-react';
import { slApi, onSmartLeadChange, formatINR, formatDate, isOverdue } from './smartLeadsApi';
import { StageBadge, TempBadge, EmptyState, SkeletonRows, Pager } from './SlShared';
import { ScheduleFollowupModal } from './LeadActions';

const OUTCOMES = [
  { value: 'INTERESTED', label: 'Interested / Active', color: '#059669' },
  { value: 'QUOTATION_REQUESTED', label: 'Quotation Requested', color: '#0E7490' },
  { value: 'CALL_LATER', label: 'Call Later / Busy', color: '#D97706' },
  { value: 'NO_ANSWER', label: 'No Answer / Ringing', color: '#64748B' },
  { value: 'NOT_INTERESTED', label: 'Not Interested / Lost', color: '#DC2626' },
  { value: 'MEETING_DONE', label: 'Meeting Done', color: '#7C3AED' }
];

const TYPE_CONFIG = {
  CALL: { label: 'Call', icon: Phone, bg: '#EFF6FF', color: '#1D4ED8', border: '#BFDBFE' },
  WHATSAPP: { label: 'WhatsApp', icon: MessageCircle, bg: '#ECFDF5', color: '#059669', border: '#A7F3D0' },
  EMAIL: { label: 'Email', icon: Mail, bg: '#FFFBEB', color: '#B45309', border: '#FDE68A' },
  MEETING: { label: 'Meeting', icon: Users, bg: '#FAF5FF', color: '#7E22CE', border: '#E9D5FF' }
};

export default function FollowupsView({ meta, onOpenLead, toast }) {
  const [tab, setTab] = useState('today');
  const [typeFilter, setTypeFilter] = useState('');
  const [search, setSearch] = useState('');
  const [data, setData] = useState({ rows: [], counts: { today: 0, overdue: 0, upcoming: 0, completed: 0, total: 0 }, total: 0 });
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [selected, setSelected] = useState([]);
  const [modal, setModal] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await slApi.listFollowups({ tab, type: typeFilter, page, pageSize });
      setData({ rows: res.data || [], counts: res.counts || {}, total: res.total || 0 });
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      setLoading(false);
    }
  }, [tab, typeFilter, page, pageSize, toast]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => onSmartLeadChange(({ type }) => {
    if (type === 'followup') load();
  }), [load]);

  const handleComplete = async (item, payload) => {
    try {
      await slApi.completeFollowup(item.id, payload);
      toast('Follow-up marked as completed!', 'success');
      setModal(null);
      setSelected([]);
      load();
    } catch (err) {
      toast(err.message, 'error');
    }
  };

  const handleReschedule = async (item, payload) => {
    try {
      await slApi.rescheduleFollowup(item.id, payload);
      toast('Follow-up rescheduled successfully!', 'success');
      setModal(null);
      setSelected([]);
      load();
    } catch (err) {
      toast(err.message, 'error');
    }
  };

  const toggle = (id) => setSelected(s => s.includes(id) ? s.filter(x => x !== id) : [...s, id]);
  const allOnPage = data.rows.length > 0 && data.rows.every(r => selected.includes(r.id));
  const toggleAll = () => {
    if (allOnPage) setSelected(s => s.filter(id => !data.rows.some(r => r.id === id)));
    else setSelected(s => [...new Set([...s, ...data.rows.map(r => r.id)])]);
  };

  const counts = data.counts || {};

  const tabs = [
    { key: 'today', label: 'Today', count: counts.today || 0 },
    { key: 'overdue', label: 'Overdue', count: counts.overdue || 0 },
    { key: 'upcoming', label: 'Upcoming', count: counts.upcoming || 0 },
    { key: 'completed', label: 'Completed', count: counts.completed || 0 },
    { key: 'all', label: 'All', count: counts.total || 0 }
  ];

  // Client-side quick filter for search
  const filteredRows = search.trim()
    ? data.rows.filter(r => {
        const q = search.toLowerCase();
        return (
          (r.lead_company_name || '').toLowerCase().includes(q) ||
          (r.lead_contact_person || '').toLowerCase().includes(q) ||
          (r.lead_phone || '').includes(q) ||
          (r.notes || '').toLowerCase().includes(q) ||
          (r.assigned_salesperson_name || '').toLowerCase().includes(q)
        );
      })
    : data.rows;

  const singleSelectedItem = selected.length === 1 ? data.rows.find(r => r.id === selected[0]) : null;
  const singleCleanPhone = (singleSelectedItem?.lead_phone || '').replace(/[^0-9]/g, '');

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      {/* Standard BUSINZ Search & Filter Toolbar (Matches AllLeadsView & CrmLeadsView) */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '12px',
        background: '#fafbfc',
        border: '1px solid #E2E8F0',
        borderRadius: '12px',
        padding: '10px 16px',
        flexWrap: 'wrap'
      }}>
        {/* Left: Search Box */}
        <div style={{
          position: 'relative',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          border: '1px solid #cbd5e1',
          borderRadius: '8px',
          padding: '0 12px',
          height: '38px',
          backgroundColor: '#FFFFFF',
          flex: '1 1 260px',
          maxWidth: '420px'
        }}>
          <Search size={15} color="#94A3B8" style={{ flexShrink: 0 }} />
          <input
            id="smart-leads-followup-search"
            type="text"
            placeholder="Search Follow-ups (Company, Contact, Phone)..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ border: 'none', background: 'none', outline: 'none', fontSize: '13px', width: '100%', color: '#334155' }}
            aria-label="Search follow-ups"
          />
          {search && (
            <X size={15} color="#94A3B8" style={{ cursor: 'pointer', flexShrink: 0 }} onClick={() => setSearch('')} />
          )}
        </div>

        {/* Right: Type Filter Dropdown & Reset */}
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap', flexShrink: 0, marginLeft: 'auto' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', border: '1px solid #cbd5e1', borderRadius: '8px', padding: '0 12px', height: '38px', backgroundColor: '#FFFFFF' }}>
            <Building2 style={{ width: '14px', height: '14px', color: '#64748b', flexShrink: 0 }} />
            <select
              id="smart-leads-followup-type-select"
              aria-label="Filter by follow-up type"
              value={typeFilter}
              onChange={(e) => { setTypeFilter(e.target.value); setPage(1); }}
              style={{ border: 'none', outline: 'none', fontSize: '13px', color: '#334155', backgroundColor: 'transparent', cursor: 'pointer' }}
            >
              <option value="">All Follow-up Types</option>
              <option value="CALL">Phone Calls</option>
              <option value="WHATSAPP">WhatsApp</option>
              <option value="EMAIL">Emails</option>
              <option value="MEETING">Meetings</option>
            </select>
          </div>

          <button
            onClick={() => {
              setSearch('');
              setTypeFilter('');
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

          <button
            onClick={() => setModal({ type: 'create' })}
            style={{
              height: '38px',
              padding: '0 16px',
              borderRadius: '8px',
              border: '1px solid #0E7490',
              background: '#0E7490',
              color: '#FFFFFF',
              fontSize: '13px',
              fontWeight: '700',
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              whiteSpace: 'nowrap',
              boxShadow: '0 1px 2px rgba(14,116,144,0.2)'
            }}
          >
            <CalendarClock size={15} /> Schedule Follow-up
          </button>
        </div>
      </div>

      {/* Main Authoritative Table Card (Matching Stock Status & CrmLeadsView Design System) */}
      <div className="sl-card sl-table-wrap" style={{ background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: '12px', overflow: 'hidden' }}>
        
        {/* Status Sub-Tabs Row (Exact Design from Stock Status / CRM Leads) */}
        <div style={{
          display: 'flex',
          borderBottom: '1px solid #E2E8F0',
          padding: '0 20px',
          gap: '20px',
          alignItems: 'center',
          flexWrap: 'wrap',
          backgroundColor: '#FFFFFF',
          overflowX: 'auto'
        }}>
          {tabs.map(t => {
            const isActive = tab === t.key;
            return (
              <button
                key={t.key}
                onClick={() => { setTab(t.key); setPage(1); setSelected([]); }}
                style={{
                  border: 'none',
                  background: 'transparent',
                  padding: '13px 4px',
                  fontSize: '13px',
                  fontWeight: 'bold',
                  color: isActive ? '#0E7490' : '#64748B',
                  borderBottom: isActive ? '2px solid #0E7490' : '2px solid transparent',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  whiteSpace: 'nowrap',
                  transition: 'all 0.15s ease'
                }}
              >
                {t.label}
                <span style={{
                  fontSize: '11px',
                  padding: '2px 8px',
                  borderRadius: '12px',
                  backgroundColor: isActive ? '#ECFEFF' : '#F1F5F9',
                  color: isActive ? '#0E7490' : '#64748B',
                  fontWeight: 'bold'
                }}>
                  {t.count}
                </span>
              </button>
            );
          })}
        </div>

        {/* Table Body */}
        {loading && data.rows.length === 0 ? (
          <SkeletonRows />
        ) : filteredRows.length === 0 ? (
          <EmptyState
            title={tab === 'today' ? "No follow-ups due today" : tab === 'overdue' ? "Zero overdue follow-ups!" : "No follow-ups found"}
            text={tab === 'overdue' ? "Great job! All customer follow-ups are on schedule." : "Schedule follow-ups on your leads to stay on top of communications."}
          />
        ) : (
          <>
            <div style={{ overflowX: 'auto', width: '100%' }}>
              <table className="sl-table custom-table" style={{ width: '100%', minWidth: '980px', borderCollapse: 'collapse', fontSize: '13px', textAlign: 'left' }}>
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
                    <th style={{ padding: '12px 14px', fontWeight: 'bold', whiteSpace: 'nowrap' }}>Follow-up Type</th>
                    <th style={{ padding: '12px 14px', fontWeight: 'bold', whiteSpace: 'nowrap' }}>Scheduled Date</th>
                    <th style={{ padding: '12px 14px', fontWeight: 'bold', whiteSpace: 'nowrap', textAlign: 'center' }}>Status</th>
                    <th style={{ padding: '12px 14px', fontWeight: 'bold', whiteSpace: 'nowrap' }}>Assigned To</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredRows.map(item => {
                    const isChecked = selected.includes(item.id);
                    const overdueFlag = item.status === 'PENDING' && isOverdue(item.scheduled_at);
                    const typeInfo = TYPE_CONFIG[item.followup_type] || TYPE_CONFIG.CALL;
                    const TypeIcon = typeInfo.icon;

                    return (
                      <tr
                        key={item.id}
                        className={`table-row-hover ${isChecked ? 'selected' : ''}`}
                        style={{
                          borderBottom: '1px solid #F1F5F9',
                          backgroundColor: isChecked ? '#ECFEFF' : 'transparent',
                          cursor: 'pointer',
                          transition: 'background-color 0.15s ease'
                        }}
                        onClick={() => toggle(item.id)}
                      >
                        {/* Checkbox Column */}
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
                            onChange={() => toggle(item.id)}
                            style={{ accentColor: '#0E7490', cursor: 'pointer', verticalAlign: 'middle', margin: 0, width: '16px', height: '16px' }}
                            aria-label={`Select ${item.lead_company_name}`}
                          />
                        </td>

                        {/* Lead & Company */}
                        <td style={{ padding: '12px 14px' }}>
                          <div style={{ fontWeight: 700, color: '#0F172A', fontSize: '13px' }}>
                            {item.lead_company_name || 'Individual Lead'}
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '2px', flexWrap: 'wrap' }}>
                            <StageBadge stage={item.lead_stage} />
                            {item.lead_temperature && <TempBadge temperature={item.lead_temperature} score={item.lead_score} />}
                            {item.lead_value > 0 && <span style={{ fontSize: '11px', fontWeight: 700, color: '#0E7490' }}>{formatINR(item.lead_value)}</span>}
                          </div>
                        </td>

                        {/* Primary Contact */}
                        <td style={{ padding: '12px 14px' }}>
                          <div style={{ fontWeight: 600, color: '#1E293B', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '5px' }}>
                            <User size={13} style={{ color: '#64748B' }} />
                            <span>{item.lead_contact_person || '—'}</span>
                          </div>
                          {item.lead_phone && (
                            <div style={{ fontSize: '11px', color: '#64748B', display: 'flex', alignItems: 'center', gap: '4px', marginTop: '2px' }}>
                              <Phone size={11} style={{ color: '#94A3B8' }} />
                              <span>{item.lead_phone}</span>
                            </div>
                          )}
                        </td>

                        {/* Follow-up Type & Agenda */}
                        <td style={{ padding: '12px 14px' }}>
                          <span style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '5px',
                            padding: '3px 8px',
                            borderRadius: '6px',
                            fontSize: '11px',
                            fontWeight: 700,
                            backgroundColor: typeInfo.bg,
                            color: typeInfo.color,
                            border: `1px solid ${typeInfo.border}`
                          }}>
                            <TypeIcon size={12} /> {typeInfo.label}
                          </span>
                          {item.notes && (
                            <div style={{ fontSize: '11px', color: '#64748B', marginTop: '4px', maxWidth: '240px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={item.notes}>
                              {item.notes}
                            </div>
                          )}
                        </td>

                        {/* Scheduled Date */}
                        <td style={{ padding: '12px 14px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                            <Calendar size={13} style={{ color: overdueFlag ? '#DC2626' : '#0E7490' }} />
                            <span style={{ fontSize: '13px', fontWeight: 600, color: overdueFlag ? '#DC2626' : '#0F172A' }}>
                              {formatDate(item.scheduled_at, true)}
                            </span>
                          </div>
                          {overdueFlag && (
                            <span style={{ display: 'inline-block', fontSize: '10px', fontWeight: 800, color: '#DC2626', backgroundColor: '#FEE2E2', padding: '1px 6px', borderRadius: '4px', marginTop: '3px' }}>
                              OVERDUE SLA
                            </span>
                          )}
                        </td>

                        {/* Status */}
                        <td style={{ padding: '12px 14px', textAlign: 'center' }}>
                          {item.status === 'COMPLETED' ? (
                            <span style={{ display: 'inline-block', fontSize: '11px', fontWeight: 700, color: '#15803D', backgroundColor: '#DCFCE7', padding: '3px 10px', borderRadius: '12px' }}>
                              ✓ Done
                            </span>
                          ) : overdueFlag ? (
                            <span style={{ display: 'inline-block', fontSize: '11px', fontWeight: 700, color: '#B91C1C', backgroundColor: '#FEE2E2', padding: '3px 10px', borderRadius: '12px' }}>
                              Overdue
                            </span>
                          ) : (
                            <span style={{ display: 'inline-block', fontSize: '11px', fontWeight: 700, color: '#0E7490', backgroundColor: '#ECFEFF', padding: '3px 10px', borderRadius: '12px' }}>
                              Pending
                            </span>
                          )}
                        </td>

                        {/* Assigned To (Avatar Circle) */}
                        <td style={{ padding: '12px 14px' }}>
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
                              justifyContent: 'center',
                              flexShrink: 0
                            }}>
                              {(item.assigned_salesperson_name || 'S').charAt(0).toUpperCase()}
                            </div>
                            <span style={{ fontSize: '13px', color: '#334155', fontWeight: 500, whiteSpace: 'nowrap' }}>
                              {item.assigned_salesperson_name || 'Sales Team'}
                            </span>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Pagination Footer */}
            {data.total > 0 && (
              <Pager
                page={page}
                pageSize={pageSize}
                total={data.total}
                onPage={setPage}
                onPageSize={(ps) => { setPageSize(ps); setPage(1); }}
              />
            )}
          </>
        )}
      </div>

      {/* Floating Action Bar (Single Line with All Action Buttons) */}
      {selected.length > 0 && (
        <div className="sl-actionbar">
          <span style={{ fontWeight: 700, fontSize: '13px', color: '#0E7490', marginRight: '4px' }}>
            {selected.length} Selected
          </span>
          <div className="sep" />

          {/* Quick Contact buttons if single lead selected */}
          {singleSelectedItem && singleCleanPhone && (
            <>
              <a
                href={`tel:${singleCleanPhone}`}
                style={{
                  color: '#2563EB',
                  textDecoration: 'none',
                  background: '#FFFFFF',
                  border: '1px solid #E2E8F0',
                  padding: '6px 14px',
                  borderRadius: '50px',
                  fontSize: '12px',
                  fontWeight: 700,
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px'
                }}
                title="Call Lead"
              >
                <Phone size={13} /> Call Lead
              </a>
              <a
                href={`https://wa.me/91${singleCleanPhone.slice(-10)}`}
                target="_blank"
                rel="noreferrer"
                style={{
                  color: '#059669',
                  textDecoration: 'none',
                  background: '#FFFFFF',
                  border: '1px solid #E2E8F0',
                  padding: '6px 14px',
                  borderRadius: '50px',
                  fontSize: '12px',
                  fontWeight: 700,
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px'
                }}
                title="WhatsApp Chat"
              >
                <MessageCircle size={13} /> WhatsApp
              </a>
            </>
          )}

          {/* Complete Button */}
          <button
            onClick={() => {
              const targetItem = singleSelectedItem || data.rows.find(r => selected.includes(r.id) && r.status === 'PENDING');
              if (targetItem) setModal({ type: 'complete', item: targetItem });
            }}
            style={{
              background: '#0E7490',
              color: '#FFFFFF',
              borderColor: '#0E7490',
              fontWeight: 700
            }}
          >
            <CheckCircle2 size={13} /> Complete {selected.length > 1 ? 'Selected' : 'Follow-up'}
          </button>

          {/* Reschedule Button */}
          <button
            onClick={() => {
              const targetItem = singleSelectedItem || data.rows.find(r => selected.includes(r.id) && r.status === 'PENDING');
              if (targetItem) setModal({ type: 'reschedule', item: targetItem });
            }}
          >
            <CalendarClock size={13} /> Reschedule {selected.length > 1 ? 'Selected' : 'Follow-up'}
          </button>

          {/* View Lead Details if single selected */}
          {singleSelectedItem && (
            <button onClick={() => onOpenLead(singleSelectedItem.lead_id)}>
              <Eye size={13} /> View Lead Details
            </button>
          )}

          {/* Deselect / Close */}
          <button className="sl-actionbar-close" onClick={() => setSelected([])} aria-label="Clear selection">✕</button>
        </div>
      )}

      {/* Complete Outcome Modal */}
      {modal?.type === 'complete' && (
        <CompleteModal
          item={modal.item}
          onClose={() => setModal(null)}
          onSubmit={(payload) => handleComplete(modal.item, payload)}
        />
      )}

      {/* Reschedule Modal */}
      {modal?.type === 'reschedule' && (
        <RescheduleModal
          item={modal.item}
          onClose={() => setModal(null)}
          onSubmit={(payload) => handleReschedule(modal.item, payload)}
        />
      )}

      {/* Schedule New Follow-up Modal */}
      {modal?.type === 'create' && (
        <ScheduleFollowupModal
          onClose={() => setModal(null)}
          onDone={(_res, msg) => {
            if (msg) toast(msg, 'success');
            setModal(null);
            load();
          }}
        />
      )}
    </div>
  );
}

// Complete Modal Component
function CompleteModal({ item, onClose, onSubmit }) {
  const [outcome, setOutcome] = useState('INTERESTED');
  const [remarks, setRemarks] = useState('');
  const [scheduleNext, setScheduleNext] = useState(false);
  const [nextDate, setNextDate] = useState('');
  const [nextType, setNextType] = useState('CALL');
  const [nextNotes, setNextNotes] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    onSubmit({
      outcome,
      outcome_remarks: remarks,
      next_followup: scheduleNext && nextDate ? {
        followup_type: nextType,
        scheduled_at: new Date(nextDate).toISOString(),
        notes: nextNotes
      } : null
    });
  };

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999, padding: '16px' }}>
      <div style={{ background: '#FFFFFF', borderRadius: '16px', maxWidth: '480px', width: '100%', padding: '24px', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <h3 style={{ fontSize: '17px', fontWeight: '800', color: '#0F172A', margin: 0 }}>
            Complete Follow-up
          </h3>
          <button onClick={onClose} style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: '#94A3B8' }}>
            <X size={20} />
          </button>
        </div>

        <div style={{ fontSize: '13px', color: '#64748B', marginBottom: '16px' }}>
          Lead: <strong>{item.lead_company_name || 'Individual'}</strong> ({item.lead_phone})
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div>
            <label style={{ fontSize: '12px', fontWeight: '700', color: '#334155', display: 'block', marginBottom: '6px' }}>
              Interaction Outcome *
            </label>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '8px' }}>
              {OUTCOMES.map(o => (
                <button
                  type="button"
                  key={o.value}
                  onClick={() => setOutcome(o.value)}
                  style={{
                    padding: '8px 10px',
                    borderRadius: '8px',
                    border: outcome === o.value ? `2px solid ${o.color}` : '1px solid #E2E8F0',
                    background: outcome === o.value ? `${o.color}15` : '#FFFFFF',
                    color: outcome === o.value ? o.color : '#475569',
                    fontSize: '12px',
                    fontWeight: '700',
                    cursor: 'pointer',
                    textAlign: 'left'
                  }}
                >
                  {o.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label style={{ fontSize: '12px', fontWeight: '700', color: '#334155', display: 'block', marginBottom: '6px' }}>
              Discussion Remarks & Next Steps
            </label>
            <textarea
              value={remarks}
              onChange={(e) => setRemarks(e.target.value)}
              placeholder="Summary of customer conversation, objections, or price agreed..."
              rows={3}
              style={{ width: '100%', padding: '8px 12px', borderRadius: '8px', border: '1px solid #CBD5E1', fontSize: '13px' }}
            />
          </div>

          <div style={{ background: '#F8FAFC', padding: '12px', borderRadius: '8px', border: '1px solid #E2E8F0' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', fontWeight: '700', color: '#0E7490', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={scheduleNext}
                onChange={(e) => setScheduleNext(e.target.checked)}
                style={{ accentColor: '#0E7490' }}
              />
              Schedule Next Follow-up Immediately
            </label>

            {scheduleNext && (
              <div style={{ marginTop: '10px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                  <select
                    value={nextType}
                    onChange={(e) => setNextType(e.target.value)}
                    style={{ height: '36px', padding: '0 8px', borderRadius: '6px', border: '1px solid #CBD5E1', fontSize: '12px' }}
                  >
                    <option value="CALL">Phone Call</option>
                    <option value="WHATSAPP">WhatsApp</option>
                    <option value="EMAIL">Email</option>
                    <option value="MEETING">Meeting</option>
                  </select>
                  <input
                    type="datetime-local"
                    value={nextDate}
                    onChange={(e) => setNextDate(e.target.value)}
                    required={scheduleNext}
                    style={{ height: '36px', padding: '0 8px', borderRadius: '6px', border: '1px solid #CBD5E1', fontSize: '12px' }}
                  />
                </div>
                <input
                  type="text"
                  value={nextNotes}
                  onChange={(e) => setNextNotes(e.target.value)}
                  placeholder="Next follow-up agenda..."
                  style={{ height: '34px', padding: '0 8px', borderRadius: '6px', border: '1px solid #CBD5E1', fontSize: '12px' }}
                />
              </div>
            )}
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '6px' }}>
            <button
              type="button"
              onClick={onClose}
              style={{ padding: '8px 16px', borderRadius: '8px', border: '1px solid #CBD5E1', background: '#FFFFFF', fontSize: '13px', fontWeight: '600', cursor: 'pointer' }}
            >
              Cancel
            </button>
            <button
              type="submit"
              style={{ padding: '8px 18px', borderRadius: '8px', border: 'none', background: '#0E7490', color: '#FFFFFF', fontSize: '13px', fontWeight: '700', cursor: 'pointer' }}
            >
              Save & Complete
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// Reschedule Modal Component
function RescheduleModal({ item, onClose, onSubmit }) {
  const [newDate, setNewDate] = useState('');
  const [reason, setReason] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!newDate) return;
    onSubmit({
      scheduled_at: new Date(newDate).toISOString(),
      reason
    });
  };

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999, padding: '16px' }}>
      <div style={{ background: '#FFFFFF', borderRadius: '16px', maxWidth: '420px', width: '100%', padding: '24px', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <h3 style={{ fontSize: '17px', fontWeight: '800', color: '#0F172A', margin: 0 }}>
            Reschedule Follow-up
          </h3>
          <button onClick={onClose} style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: '#94A3B8' }}>
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div>
            <label style={{ fontSize: '12px', fontWeight: '700', color: '#334155', display: 'block', marginBottom: '6px' }}>
              New Date & Time *
            </label>
            <input
              type="datetime-local"
              value={newDate}
              onChange={(e) => setNewDate(e.target.value)}
              required
              style={{ width: '100%', height: '38px', padding: '0 10px', borderRadius: '8px', border: '1px solid #CBD5E1', fontSize: '13px' }}
            />
          </div>

          <div>
            <label style={{ fontSize: '12px', fontWeight: '700', color: '#334155', display: 'block', marginBottom: '6px' }}>
              Reason for Reschedule
            </label>
            <input
              type="text"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g. Customer requested call after lunch"
              style={{ width: '100%', height: '38px', padding: '0 10px', borderRadius: '8px', border: '1px solid #CBD5E1', fontSize: '13px' }}
            />
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '8px' }}>
            <button
              type="button"
              onClick={onClose}
              style={{ padding: '8px 16px', borderRadius: '8px', border: '1px solid #CBD5E1', background: '#FFFFFF', fontSize: '13px', fontWeight: '600', cursor: 'pointer' }}
            >
              Cancel
            </button>
            <button
              type="submit"
              style={{ padding: '8px 18px', borderRadius: '8px', border: 'none', background: '#0E7490', color: '#FFFFFF', fontSize: '13px', fontWeight: '700', cursor: 'pointer' }}
            >
              Confirm Reschedule
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
