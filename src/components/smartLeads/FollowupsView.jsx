import React, { useCallback, useEffect, useState } from 'react';
import {
  CalendarClock, Phone, MessageCircle, Mail, Users, CheckCircle2,
  Clock, AlertTriangle, RefreshCw, Plus, ArrowRight, X, ChevronRight
} from 'lucide-react';
import { slApi, onSmartLeadChange, formatINR, formatDate, isOverdue } from './smartLeadsApi';
import { StageBadge, TempBadge, EmptyState, SkeletonRows, Pager, BusinzKpiGrid, BusinzKpiCard } from './SlShared';

const OUTCOMES = [
  { value: 'INTERESTED', label: 'Interested / Active', color: '#059669' },
  { value: 'QUOTATION_REQUESTED', label: 'Quotation Requested', color: '#0E7490' },
  { value: 'CALL_LATER', label: 'Call Later / Busy', color: '#D97706' },
  { value: 'NO_ANSWER', label: 'No Answer / Ringing', color: '#64748B' },
  { value: 'NOT_INTERESTED', label: 'Not Interested / Lost', color: '#DC2626' },
  { value: 'MEETING_DONE', label: 'Meeting Done', color: '#7C3AED' }
];

export default function FollowupsView({ meta, onOpenLead, toast }) {
  const [tab, setTab] = useState('today');
  const [typeFilter, setTypeFilter] = useState('');
  const [data, setData] = useState({ rows: [], counts: { today: 0, overdue: 0, upcoming: 0, completed: 0, total: 0 }, total: 0 });
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [modal, setModal] = useState(null); // { type: 'complete' | 'reschedule', item: {} }

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

  // Realtime update listener
  useEffect(() => onSmartLeadChange(({ type }) => {
    if (type === 'followup') load();
  }), [load]);

  const handleComplete = async (item, payload) => {
    try {
      await slApi.completeFollowup(item.id, payload);
      toast('Follow-up marked as completed!', 'success');
      setModal(null);
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
      load();
    } catch (err) {
      toast(err.message, 'error');
    }
  };

  const counts = data.counts || {};

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Signature BUSINZ Follow-up KPI Cards */}
      <BusinzKpiGrid minWidth="200px">
        <BusinzKpiCard
          title="TODAY'S TASKS"
          value={String(counts.today || 0)}
          valColor="#0E7490"
          icon={CalendarClock}
          iconColor="#0E7490"
          iconBg="#ECFEFF"
          trend="Scheduled"
          trendNeutral={true}
          bottomPrefix="Due today"
          bottomHighlight={`${counts.today || 0} Follow-ups`}
          bottomHighlightColor="#0E7490"
          onClick={() => { setTab('today'); setPage(1); }}
          isSelected={tab === 'today'}
        />

        <BusinzKpiCard
          title="OVERDUE SLA"
          value={String(counts.overdue || 0)}
          valColor={counts.overdue > 0 ? '#DC2626' : '#059669'}
          icon={AlertTriangle}
          iconColor={counts.overdue > 0 ? '#DC2626' : '#059669'}
          iconBg={counts.overdue > 0 ? '#FEF2F2' : '#ECFDF5'}
          trend={counts.overdue > 0 ? 'Urgent Action' : 'All Clear'}
          trendUp={counts.overdue === 0}
          trendNeutral={false}
          bottomPrefix="SLA missed / delayed"
          bottomHighlight={`${counts.overdue || 0} Overdue`}
          bottomHighlightColor={counts.overdue > 0 ? '#DC2626' : '#059669'}
          onClick={() => { setTab('overdue'); setPage(1); }}
          isSelected={tab === 'overdue'}
          highlightCard={counts.overdue > 0}
        />

        <BusinzKpiCard
          title="UPCOMING SCHEDULED"
          value={String(counts.upcoming || 0)}
          valColor="#0F172A"
          icon={Clock}
          iconColor="#64748B"
          iconBg="#F8FAFC"
          trend="Pipeline"
          trendNeutral={true}
          bottomPrefix="Future client interactions"
          bottomHighlight={`${counts.upcoming || 0} Scheduled`}
          bottomHighlightColor="#0F172A"
          onClick={() => { setTab('upcoming'); setPage(1); }}
          isSelected={tab === 'upcoming'}
        />

        <BusinzKpiCard
          title="COMPLETED INTERACTIONS"
          value={String(counts.completed || 0)}
          valColor="#059669"
          icon={CheckCircle2}
          iconColor="#059669"
          iconBg="#ECFDF5"
          trend="Logged"
          trendUp={true}
          bottomPrefix="Successfully logged"
          bottomHighlight={`${counts.completed || 0} Done`}
          bottomHighlightColor="#059669"
          onClick={() => { setTab('completed'); setPage(1); }}
          isSelected={tab === 'completed'}
        />
      </BusinzKpiGrid>

      {/* Filter Tabs & Type Selector */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
        <div style={{ display: 'flex', gap: '8px', background: '#F1F5F9', padding: '4px', borderRadius: '10px' }}>
          {[
            { key: 'today', label: `Today (${counts.today || 0})` },
            { key: 'overdue', label: `Overdue (${counts.overdue || 0})` },
            { key: 'upcoming', label: `Upcoming (${counts.upcoming || 0})` },
            { key: 'completed', label: `Completed (${counts.completed || 0})` },
            { key: 'all', label: `All (${counts.total || 0})` }
          ].map(t => (
            <button
              key={t.key}
              onClick={() => { setTab(t.key); setPage(1); }}
              style={{
                border: 'none',
                background: tab === t.key ? '#FFFFFF' : 'transparent',
                color: tab === t.key ? '#0F172A' : '#64748B',
                fontWeight: tab === t.key ? '700' : '600',
                fontSize: '13px',
                padding: '6px 14px',
                borderRadius: '8px',
                cursor: 'pointer',
                boxShadow: tab === t.key ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
                transition: 'all 0.15s ease'
              }}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <select
            value={typeFilter}
            onChange={(e) => { setTypeFilter(e.target.value); setPage(1); }}
            style={{
              height: '36px',
              padding: '0 12px',
              fontSize: '13px',
              borderRadius: '8px',
              border: '1px solid #CBD5E1',
              background: '#FFFFFF',
              color: '#334155',
              cursor: 'pointer'
            }}
          >
            <option value="">All Follow-up Types</option>
            <option value="CALL">📞 Phone Calls</option>
            <option value="WHATSAPP">💬 WhatsApp</option>
            <option value="EMAIL">✉️ Emails</option>
            <option value="MEETING">🤝 Meetings</option>
          </select>

          <button
            onClick={load}
            style={{
              height: '36px',
              width: '36px',
              borderRadius: '8px',
              border: '1px solid #CBD5E1',
              background: '#FFFFFF',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              color: '#64748B'
            }}
            title="Refresh list"
          >
            <RefreshCw size={15} />
          </button>
        </div>
      </div>

      {/* Main List */}
      <div style={{ background: '#FFFFFF', borderRadius: '12px', border: '1px solid #E2E8F0', overflow: 'hidden' }}>
        {loading ? (
          <div style={{ padding: '24px' }}>
            <SkeletonRows rows={5} />
          </div>
        ) : data.rows.length === 0 ? (
          <div style={{ padding: '48px 24px' }}>
            <EmptyState
              title={tab === 'today' ? "No follow-ups due today" : tab === 'overdue' ? "Zero overdue follow-ups!" : "No follow-ups found"}
              text={tab === 'overdue' ? "Great job! All customer follow-ups are on schedule." : "Schedule follow-ups on your leads to stay on top of communications."}
            />
          </div>
        ) : (
          <div>
            {data.rows.map(item => {
              const overdueFlag = item.status === 'PENDING' && isOverdue(item.scheduled_at);
              const cleanPhone = (item.lead_phone || '').replace(/[^0-9]/g, '');

              return (
                <div
                  key={item.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '16px 20px',
                    borderBottom: '1px solid #F1F5F9',
                    backgroundColor: overdueFlag ? '#FEF2F2' : '#FFFFFF',
                    transition: 'background 0.15s ease',
                    gap: '16px',
                    flexWrap: 'wrap'
                  }}
                >
                  {/* Left: Type Icon & Lead Info */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '14px', flex: '1 1 320px' }}>
                    <div style={{
                      width: '42px',
                      height: '42px',
                      borderRadius: '10px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      background: item.followup_type === 'CALL' ? '#EFF6FF' : item.followup_type === 'WHATSAPP' ? '#ECFDF5' : item.followup_type === 'EMAIL' ? '#FEF3C7' : '#F5F3FF',
                      color: item.followup_type === 'CALL' ? '#2563EB' : item.followup_type === 'WHATSAPP' ? '#059669' : item.followup_type === 'EMAIL' ? '#D97706' : '#7C3AED'
                    }}>
                      {item.followup_type === 'CALL' && <Phone size={20} />}
                      {item.followup_type === 'WHATSAPP' && <MessageCircle size={20} />}
                      {item.followup_type === 'EMAIL' && <Mail size={20} />}
                      {item.followup_type === 'MEETING' && <Users size={20} />}
                    </div>

                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span
                          onClick={() => onOpenLead(item.lead_id)}
                          style={{ fontSize: '15px', fontWeight: '700', color: '#0F172A', cursor: 'pointer', textDecoration: 'underline' }}
                        >
                          {item.lead_company_name || 'Individual Lead'}
                        </span>
                        <StageBadge stage={item.lead_stage} />
                        {item.lead_temperature && <TempBadge temp={item.lead_temperature} />}
                      </div>

                      <div style={{ fontSize: '13px', color: '#64748B', marginTop: '2px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <span>👤 {item.lead_contact_person || 'No contact name'}</span>
                        {item.lead_phone && <span>📞 {item.lead_phone}</span>}
                        {item.lead_value > 0 && <span style={{ fontWeight: '700', color: '#0E7490' }}>{formatINR(item.lead_value)}</span>}
                      </div>

                      {item.notes && (
                        <div style={{ fontSize: '12px', color: '#334155', background: '#F8FAFC', padding: '4px 8px', borderRadius: '6px', marginTop: '6px', borderLeft: '3px solid #0E7490' }}>
                          <strong>Agenda:</strong> {item.notes}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Middle: Scheduled Time & Status */}
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', minWidth: '180px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <Clock size={14} color={overdueFlag ? '#DC2626' : '#64748B'} />
                      <span style={{ fontSize: '13px', fontWeight: '700', color: overdueFlag ? '#DC2626' : '#0F172A' }}>
                        {formatDate(item.scheduled_at, true)}
                      </span>
                    </div>

                    {overdueFlag && (
                      <span style={{ fontSize: '11px', fontWeight: '700', color: '#DC2626', background: '#FEE2E2', padding: '2px 6px', borderRadius: '4px', marginTop: '3px' }}>
                        OVERDUE SLA
                      </span>
                    )}

                    {item.status === 'COMPLETED' && (
                      <div style={{ marginTop: '4px' }}>
                        <span style={{ fontSize: '11px', fontWeight: '700', color: '#059669', background: '#DCFCE7', padding: '2px 6px', borderRadius: '4px' }}>
                          ✓ Completed: {item.outcome || 'DONE'}
                        </span>
                        {item.outcome_remarks && (
                          <div style={{ fontSize: '11px', color: '#64748B', marginTop: '2px' }}>
                            {item.outcome_remarks}
                          </div>
                        )}
                      </div>
                    )}

                    <div style={{ fontSize: '11px', color: '#94A3B8', marginTop: '4px' }}>
                      Assigned: {item.assigned_salesperson_name || 'Sales Team'}
                    </div>
                  </div>

                  {/* Right: Quick Action Buttons */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    {cleanPhone && (
                      <>
                        <a
                          href={`tel:${cleanPhone}`}
                          style={{
                            width: '34px', height: '34px', borderRadius: '8px', border: '1px solid #E2E8F0',
                            background: '#FFFFFF', display: 'flex', alignItems: 'center', justifyContent: 'center',
                            color: '#2563EB', textDecoration: 'none'
                          }}
                          title="Call Lead"
                        >
                          <Phone size={15} />
                        </a>
                        <a
                          href={`https://wa.me/91${cleanPhone.slice(-10)}`}
                          target="_blank"
                          rel="noreferrer"
                          style={{
                            width: '34px', height: '34px', borderRadius: '8px', border: '1px solid #E2E8F0',
                            background: '#FFFFFF', display: 'flex', alignItems: 'center', justifyContent: 'center',
                            color: '#059669', textDecoration: 'none'
                          }}
                          title="WhatsApp Chat"
                        >
                          <MessageCircle size={15} />
                        </a>
                      </>
                    )}

                    {item.status === 'PENDING' && (
                      <>
                        <button
                          onClick={() => setModal({ type: 'complete', item })}
                          style={{
                            height: '34px', padding: '0 12px', borderRadius: '8px',
                            background: '#0E7490', border: 'none', color: '#FFFFFF',
                            fontSize: '12px', fontWeight: '700', cursor: 'pointer',
                            display: 'flex', alignItems: 'center', gap: '5px'
                          }}
                        >
                          <CheckCircle2 size={14} /> Complete
                        </button>
                        <button
                          onClick={() => setModal({ type: 'reschedule', item })}
                          style={{
                            height: '34px', padding: '0 10px', borderRadius: '8px',
                            background: '#F1F5F9', border: '1px solid #CBD5E1', color: '#475569',
                            fontSize: '12px', fontWeight: '600', cursor: 'pointer'
                          }}
                        >
                          Reschedule
                        </button>
                      </>
                    )}

                    <button
                      onClick={() => onOpenLead(item.lead_id)}
                      style={{
                        height: '34px', width: '34px', borderRadius: '8px',
                        background: '#F8FAFC', border: '1px solid #E2E8F0', color: '#64748B',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer'
                      }}
                      title="Open Lead Profile"
                    >
                      <ChevronRight size={16} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Pagination Footer */}
      {data.total > 0 && (
        <Pager
          page={page}
          pageSize={pageSize}
          total={data.total}
          onPageChange={setPage}
          onPageSizeChange={(ps) => { setPageSize(ps); setPage(1); }}
        />
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
                    <option value="CALL">📞 Phone Call</option>
                    <option value="WHATSAPP">💬 WhatsApp</option>
                    <option value="EMAIL">✉️ Email</option>
                    <option value="MEETING">🤝 Meeting</option>
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
