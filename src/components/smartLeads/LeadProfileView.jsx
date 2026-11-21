import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowLeft, Phone, MessageCircle, Mail, PhoneCall, StickyNote,
  ArrowRightLeft, UserCheck, Pencil, CalendarClock, FileText,
  Clock, User, ArrowRight, Users, X, Check, UserPlus, Building2, Plus
} from 'lucide-react';
import { slApi, onSmartLeadChange, formatINR, formatDate, isOverdue } from './smartLeadsApi';
import { StageBadge, TempBadge, EmptyState, SkeletonRows } from './SlShared';
import LeadFormModal from './LeadFormModal';
import { StageModal, AssignModal, ActivityModal, ScheduleFollowupModal } from './LeadActions';

const EVENT_CONFIG = {
  activity: { icon: PhoneCall, bg: '#EFF6FF', color: '#2563EB', label: 'Activity' },
  call: { icon: Phone, bg: '#EFF6FF', color: '#2563EB', label: 'Phone Call' },
  whatsapp: { icon: MessageCircle, bg: '#ECFDF5', color: '#059669', label: 'WhatsApp' },
  email: { icon: Mail, bg: '#FFFBEB', color: '#D97706', label: 'Email' },
  meeting: { icon: Users, bg: '#FAF5FF', color: '#7E22CE', label: 'Meeting' },
  note: { icon: StickyNote, bg: '#FFF7ED', color: '#EA580C', label: 'Note' },
  stage: { icon: ArrowRightLeft, bg: '#ECFEFF', color: '#0E7490', label: 'Stage Change' },
  assign: { icon: UserCheck, bg: '#EEF2FF', color: '#4F46E5', label: 'Assignment' },
  audit: { icon: Pencil, bg: '#F1F5F9', color: '#64748B', label: 'Field Update' },
  followup: { icon: CalendarClock, bg: '#F0FDF4', color: '#16A34A', label: 'Follow-up' }
};

export default function LeadProfileView({ meta, leadId, onBack, toast, isModal = false, onNavigateTab }) {
  const [detail, setDetail] = useState(null);
  const [error, setError] = useState('');
  const [modal, setModal] = useState(null);
  const [tab, setTab] = useState('all');
  const [note, setNote] = useState('');
  const [savingNote, setSavingNote] = useState(false);
  const [convertingCustomer, setConvertingCustomer] = useState(false);
  const lastLocalWrite = useRef(0);

  const load = useCallback(async () => {
    try {
      setError('');
      setDetail(await slApi.getLead(leadId));
    } catch (err) {
      setError(err.message);
    }
  }, [leadId]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => onSmartLeadChange(({ leadId: changed, action }) => {
    if (changed !== leadId || Date.now() - lastLocalWrite.current < 3000) return;
    if (action === 'delete') {
      toast('This lead was removed or merged');
      onBack();
    } else {
      load();
    }
  }), [leadId, load, onBack, toast]);

  const timeline = useMemo(() => {
    if (!detail) return [];
    const items = [
      ...detail.activities.map(a => {
        const type = (a.activity_type || '').toUpperCase();
        const kindKey = type === 'CALL' ? 'call' : type === 'WHATSAPP' ? 'whatsapp' : type === 'EMAIL' ? 'email' : type === 'MEETING' ? 'meeting' : 'activity';
        return {
          kind: kindKey,
          at: a.created_at,
          title: `${a.activity_type || 'Activity'} Logged`,
          body: a.summary,
          sub: a.conducted_by_name || 'Sales Team',
          extra: a.customer_response ? `Customer: ${a.customer_response}` : null
        };
      }),
      ...detail.notes.map(n => ({
        kind: 'note',
        at: n.created_at,
        title: 'Internal Note',
        body: n.body,
        sub: n.created_by_name || 'Team member'
      })),
      ...detail.statusHistory.map(s => {
        // Strip duplicate generic automated remarks like "Stage advanced to X"
        const isGenericRemark = s.remarks && (
          s.remarks.toLowerCase().includes('stage advanced to') ||
          s.remarks.toLowerCase().includes('stage updated to')
        );
        return {
          kind: 'stage',
          at: s.created_at,
          title: 'Stage Updated',
          fromStage: s.previous_status || 'New',
          toStage: s.new_status,
          body: isGenericRemark ? null : s.remarks,
          sub: s.updated_by_name || 'Sales Team'
        };
      }),
      ...detail.assignmentHistory.map(a => ({
        kind: 'assign',
        at: a.created_at,
        title: 'Owner Reassigned',
        fromOwner: a.previous_assigned_to_name || 'Unassigned',
        toOwner: a.assigned_to_name,
        body: a.assignment_reason,
        sub: a.assigned_by_name ? `by ${a.assigned_by_name}` : 'System'
      })),
      ...detail.audit.filter(a => a.field !== 'owner').map(a => ({
        kind: 'audit',
        at: a.changed_at,
        title: `Updated ${a.field.replace(/_/g, ' ')}`,
        body: `${a.old_value ?? '—'} → ${a.new_value ?? '—'}`,
        sub: a.changed_by_name || 'System'
      })),
      ...detail.followups.map(f => ({
        kind: 'followup',
        at: f.created_at,
        title: `Follow-up (${f.followup_type || 'CALL'})`,
        status: f.status,
        body: f.notes,
        sub: `Scheduled for ${formatDate(f.scheduled_at, true)}${f.outcome ? ` · Outcome: ${f.outcome}` : ''}`
      }))
    ];

    const filterMap = {
      all: null,
      activity: ['activity', 'call', 'whatsapp', 'email', 'meeting'],
      note: ['note'],
      history: ['stage', 'assign', 'audit'],
      followup: ['followup']
    };
    const allowed = filterMap[tab];
    return items.filter(i => !allowed || allowed.includes(i.kind)).sort((a, b) => new Date(b.at) - new Date(a.at));
  }, [detail, tab]);

  const afterAction = (_lead, msg) => {
    lastLocalWrite.current = Date.now();
    setModal(null);
    if (msg) toast(msg);
    load();
  };

  const saveNote = async () => {
    if (!note.trim()) return;
    setSavingNote(true);
    try {
      await slApi.addNote(leadId, note.trim());
      lastLocalWrite.current = Date.now();
      setNote('');
      toast('Note added successfully!');
      load();
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      setSavingNote(false);
    }
  };

  const handleConvertToCustomer = async () => {
    setConvertingCustomer(true);
    try {
      const res = await slApi.convertToCustomer(leadId);
      lastLocalWrite.current = Date.now();
      toast(res.message || 'Converted to Customer successfully!');
      await load();
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      setConvertingCustomer(false);
    }
  };

  const handleCreateQuotation = () => {
    if (!l) return;
    try {
      const payload = {
        customer: l.company_name,
        companyName: l.company_name,
        customerName: l.contact_person || l.company_name,
        phone: l.phone || l.whatsapp || '',
        email: l.email || '',
        city: l.location || '',
        customerCode: l.converted_customer_code || l.customer_code || '',
        leadId: l.id,
        leadNumber: l.lead_number,
        estimatedKw: l.estimated_kw,
        productRequirement: l.product_requirement
      };
      sessionStorage.setItem('vrm_prefill_lead_for_quotation', JSON.stringify(payload));
      localStorage.setItem('vrm_prefill_lead_for_quotation', JSON.stringify(payload));
    } catch (_) {}
    if (onNavigateTab) {
      onNavigateTab('Quotations');
    } else {
      toast('Opening Quotations...', 'info');
    }
  };

  const handleConvertToPI = (quote) => {
    try {
      sessionStorage.setItem('vrm_prefill_quote_for_pi', JSON.stringify(quote));
    } catch (_) {}
    if (onNavigateTab) {
      onNavigateTab('Performa Invoice', quote);
    } else {
      toast('Opening Proforma Invoice...', 'info');
    }
  };

  const handleConvertToBOM = (pi) => {
    try {
      sessionStorage.setItem('vrm_prefill_pi_for_bom', JSON.stringify(pi));
    } catch (_) {}
    if (onNavigateTab) {
      onNavigateTab('BOM Orders', pi);
    } else {
      toast('Opening BOM Orders...', 'info');
    }
  };

  if (error) {
    return (
      <div>
        <button className="sl-back" onClick={onBack}><ArrowLeft size={14} /> All leads</button>
        <div className="sl-alert sl-alert-error">{error}</div>
      </div>
    );
  }

  if (!detail) return <div className="sl-card"><SkeletonRows rows={8} /></div>;

  const l = detail.lead;
  const stages = meta?.stages || [];
  const curIdx = stages.indexOf(l.pipeline_stage);
  const lostReason = (meta?.lostReasons || []).find(r => r.id === l.lost_reason_id);
  const waNumber = String(l.whatsapp || l.phone || '').replace(/\D/g, '').replace(/^(\d{10})$/, '91$1');
  const prob = meta?.stageProbabilities?.[l.pipeline_stage];

  const tabsList = [
    { key: 'all', label: 'All Activity' },
    { key: 'activity', label: 'Calls & Messages' },
    { key: 'note', label: 'Notes' },
    { key: 'followup', label: 'Follow-ups' },
    { key: 'history', label: 'History & Audit' }
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      {!isModal && (
        <button className="sl-back" onClick={onBack} style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '13px', fontWeight: 600, color: '#64748B', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
          <ArrowLeft size={14} /> Back to Leads
        </button>
      )}

      {/* Header Profile Card */}
      <div className="sl-card sl-card-pad">
        <div className="sl-profile-head">
          <div style={{ minWidth: 0 }}>
            <h2 className="sl-profile-name">{l.company_name}</h2>
            <div className="sl-muted" style={{ marginTop: '4px' }}>
              <span style={{ color: '#0E7490', fontWeight: 700 }}>{l.lead_number}</span>
              <span> · {l.contact_person || 'No contact'}{l.designation ? ` (${l.designation})` : ''}</span>
              <span> · {l.location || 'No location'}</span>
            </div>
            <div style={{ display: 'flex', gap: 6, marginTop: 8, flexWrap: 'wrap' }}>
              <StageBadge stage={l.pipeline_stage} />
              <TempBadge temperature={l.temperature} score={l.score} />
              <span className="sl-badge">{l.source || 'Manual'}</span>
              <span className="sl-badge">Owner: {l.assigned_to_name || 'Unassigned'}</span>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {/* Convert to Customer / View Customer */}
            {!l.is_converted && !detail.customerMaster ? (
              <button
                className="sl-btn sl-btn-accent"
                onClick={handleConvertToCustomer}
                disabled={convertingCustomer}
                style={{
                  backgroundColor: '#ECFEFF',
                  color: '#0E7490',
                  borderColor: '#A5F3FC',
                  fontWeight: 700
                }}
                title="Convert this lead to an official Customer Master record"
              >
                <UserPlus size={14} /> {convertingCustomer ? 'Converting…' : 'Convert to Customer'}
              </button>
            ) : (
              <button
                className="sl-btn"
                onClick={() => onNavigateTab && onNavigateTab('Customers')}
                style={{ backgroundColor: '#F0FDF4', color: '#16A34A', borderColor: '#BBF7D0', fontWeight: 700 }}
                title="View Customer in Customer Master"
              >
                <Building2 size={14} /> Customer: {l.converted_customer_code || detail.customerMaster?.customer_code || 'Master'}
              </button>
            )}

            {/* Create Quotation Button */}
            <button
              className="sl-btn"
              onClick={handleCreateQuotation}
              style={{ fontWeight: 700, color: '#0F172A', borderColor: '#CBD5E1' }}
              title="Create a new Quotation for this deal"
            >
              <FileText size={14} color="#0E7490" /> + Create Quote
            </button>

            {l.phone && <a className="sl-btn" href={`tel:${l.phone}`}><Phone size={14} /> Call</a>}
            {waNumber && <a className="sl-btn" href={`https://wa.me/${waNumber}`} target="_blank" rel="noreferrer"><MessageCircle size={14} /> WhatsApp</a>}
            {l.email && <a className="sl-btn" href={`mailto:${l.email}`}><Mail size={14} /> Email</a>}
            <button className="sl-btn" onClick={() => setModal({ type: 'followup' })}><CalendarClock size={14} /> Schedule follow-up</button>
            <button className="sl-btn" onClick={() => setModal({ type: 'edit' })}><Pencil size={14} /> Edit</button>
            {meta?.me?.isManager && <button className="sl-btn" onClick={() => setModal({ type: 'assign' })}><UserCheck size={14} /> Assign</button>}
            <button className="sl-btn sl-btn-primary" onClick={() => setModal({ type: 'activity' })}><PhoneCall size={14} /> Log activity</button>
          </div>
        </div>

        {/* Pipeline Stage Stepper */}
        <div className="sl-stepper" role="list" aria-label="Pipeline stage" style={{ marginTop: '16px' }}>
          {stages.map((s, i) => {
            let cls = '';
            if (s === l.pipeline_stage) cls = s === 'Won' ? 'won' : s === 'Lost' ? 'lost' : 'current';
            else if (curIdx >= 0 && i < curIdx && !['Won', 'Lost'].includes(s) && l.pipeline_stage !== 'Lost') cls = 'done';
            return (
              <button
                key={s}
                role="listitem"
                className={`sl-step ${cls}`}
                onClick={() => s !== l.pipeline_stage && setModal({ type: 'stage', initialStage: s })}
                title={`Move to ${s}`}
              >
                {cls === 'done' && <Check size={12} strokeWidth={2.5} style={{ flexShrink: 0 }} />}
                {s}
              </button>
            );
          })}
        </div>

        {l.pipeline_stage === 'Lost' && (
          <div className="sl-alert sl-alert-error" style={{ marginTop: 10, marginBottom: 0 }}>
            Lost: {lostReason?.label || 'Reason not recorded'}{l.lost_remarks ? ` — ${l.lost_remarks}` : ''}
          </div>
        )}
        {!['Won', 'Lost'].includes(l.pipeline_stage) && !l.next_action_due_at && !l.next_action_exception && (
          <div className="sl-alert sl-alert-warn" style={{ marginTop: 10, marginBottom: 0 }}>
            This active lead has no next action. Schedule a follow-up or record an exception in Edit.
          </div>
        )}
      </div>

      {/* Main Content Layout */}
      <div className="sl-grid-2">
        {/* Left Column: Timeline & Notes */}
        <div style={{ minWidth: 0, display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {/* Quick Note Input Box */}
          <div className="sl-card sl-card-pad" style={{ background: '#FFFFFF' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <textarea
                value={note}
                onChange={e => setNote(e.target.value)}
                placeholder="Write an internal note or update about this lead..."
                style={{
                  width: '100%',
                  minHeight: '60px',
                  padding: '10px 12px',
                  borderRadius: '8px',
                  border: '1px solid #CBD5E1',
                  fontSize: '13px',
                  color: '#1E293B',
                  resize: 'vertical',
                  boxSizing: 'border-box'
                }}
                aria-label="New note"
              />
              <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                <button
                  className="sl-btn sl-btn-primary"
                  disabled={savingNote || !note.trim()}
                  onClick={saveNote}
                  style={{ height: '34px', padding: '0 16px', fontSize: '12px' }}
                >
                  {savingNote ? 'Adding...' : 'Add Note'}
                </button>
              </div>
            </div>
          </div>

          {/* Activity Feed Section */}
          <div className="sl-card sl-card-pad" style={{ background: '#FFFFFF' }}>
            {/* Filter Tabs Row */}
            <div style={{
              display: 'flex',
              gap: '6px',
              borderBottom: '1px solid #E2E8F0',
              paddingBottom: '12px',
              marginBottom: '16px',
              overflowX: 'auto'
            }}>
              {tabsList.map(t => {
                const isActive = tab === t.key;
                return (
                  <button
                    key={t.key}
                    onClick={() => setTab(t.key)}
                    style={{
                      border: isActive ? '1px solid #0E7490' : '1px solid #E2E8F0',
                      background: isActive ? '#ECFEFF' : '#FFFFFF',
                      color: isActive ? '#0E7490' : '#64748B',
                      fontWeight: isActive ? '700' : '600',
                      fontSize: '12px',
                      padding: '6px 14px',
                      borderRadius: '8px',
                      cursor: 'pointer',
                      whiteSpace: 'nowrap',
                      transition: 'all 0.15s ease'
                    }}
                  >
                    {t.label}
                  </button>
                );
              })}
            </div>

            {tab === 'followup' && (
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '14px',
                padding: '10px 14px',
                background: '#F8FAFC',
                borderRadius: '8px',
                border: '1px solid #E2E8F0',
                flexWrap: 'wrap',
                gap: '8px'
              }}>
                <span style={{ fontSize: '12px', fontWeight: '600', color: '#475569' }}>
                  Scheduled interactions, calls, emails & client meetings
                </span>
                <button
                  type="button"
                  className="sl-btn sl-btn-primary"
                  onClick={() => setModal({ type: 'followup' })}
                  style={{ height: '32px', padding: '0 12px', fontSize: '12px' }}
                >
                  <CalendarClock size={13} /> + Schedule Follow-up
                </button>
              </div>
            )}

            {/* Timeline Stream */}
            {timeline.length === 0 ? (
              <EmptyState title="No activity recorded yet" text="Log a call, WhatsApp message, or note to track communication history." />
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {timeline.map((item, i) => {
                  const config = EVENT_CONFIG[item.kind] || EVENT_CONFIG.activity;
                  const Icon = config.icon;

                  return (
                    <div
                      key={`${item.kind}-${i}`}
                      style={{
                        display: 'flex',
                        gap: '12px',
                        padding: '12px 14px',
                        background: '#FFFFFF',
                        border: '1px solid #E2E8F0',
                        borderRadius: '10px',
                        transition: 'background-color 0.15s ease'
                      }}
                    >
                      {/* Icon */}
                      <div style={{
                        width: '34px',
                        height: '34px',
                        borderRadius: '8px',
                        backgroundColor: config.bg,
                        color: config.color,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0
                      }}>
                        <Icon size={16} />
                      </div>

                      {/* Content Body */}
                      <div style={{ minWidth: 0, flex: 1 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px' }}>
                          {/* Title / Stage Transition */}
                          {item.kind === 'stage' ? (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                              <span style={{ fontSize: '13px', fontWeight: 700, color: '#0F172A' }}>Stage:</span>
                              <span style={{ fontSize: '11px', fontWeight: 700, padding: '2px 8px', borderRadius: '12px', background: '#F1F5F9', color: '#475569' }}>
                                {item.fromStage}
                              </span>
                              <ArrowRight size={12} color="#94A3B8" />
                              <span style={{ fontSize: '11px', fontWeight: 700, padding: '2px 8px', borderRadius: '12px', background: '#ECFEFF', color: '#0E7490' }}>
                                {item.toStage}
                              </span>
                            </div>
                          ) : item.kind === 'assign' ? (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                              <span style={{ fontSize: '13px', fontWeight: 700, color: '#0F172A' }}>Reassigned:</span>
                              <span style={{ fontSize: '11px', color: '#64748B' }}>{item.fromOwner}</span>
                              <ArrowRight size={12} color="#94A3B8" />
                              <span style={{ fontSize: '11px', fontWeight: 700, color: '#0E7490' }}>{item.toOwner}</span>
                            </div>
                          ) : (
                            <span style={{ fontSize: '13px', fontWeight: 700, color: '#0F172A' }}>
                              {item.title}
                            </span>
                          )}

                          {/* Timestamp */}
                          <span style={{ fontSize: '11px', color: '#94A3B8', display: 'inline-flex', alignItems: 'center', gap: '4px', whiteSpace: 'nowrap' }}>
                            <Clock size={11} color="#94A3B8" /> {formatDate(item.at, true)}
                          </span>
                        </div>

                        {/* Note / Remarks / Body */}
                        {item.body && (
                          <div style={{
                            fontSize: '12.5px',
                            color: '#334155',
                            background: item.kind === 'note' ? '#FFFBEB' : '#F8FAFC',
                            border: item.kind === 'note' ? '1px solid #FDE68A' : '1px solid #E2E8F0',
                            borderRadius: '6px',
                            padding: '6px 10px',
                            marginTop: '6px',
                            lineHeight: 1.4,
                            whiteSpace: 'pre-wrap',
                            overflowWrap: 'anywhere'
                          }}>
                            {item.body}
                          </div>
                        )}

                        {/* Customer Response or Extra */}
                        {item.extra && (
                          <div style={{ fontSize: '12px', color: '#059669', marginTop: '4px', fontWeight: 500 }}>
                            {item.extra}
                          </div>
                        )}

                        {/* Author Subtext */}
                        {item.sub && (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginTop: '6px', fontSize: '11px', color: '#94A3B8' }}>
                            <User size={11} color="#94A3B8" />
                            <span>{item.sub}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Metadata Panels */}
        <div style={{ minWidth: 0, display: 'grid', gap: 16, alignContent: 'start' }}>
          {/* Details Card */}
          <div className="sl-card sl-card-pad">
            <h4 className="sl-section-title">Details</h4>
            <dl className="sl-dl">
              <dt>Phone</dt><dd>{l.phone || '—'}</dd>
              <dt>WhatsApp</dt><dd>{l.whatsapp || '—'}</dd>
              <dt>Email</dt><dd>{l.email || '—'}</dd>
              <dt>Category</dt><dd>{l.category || '—'}</dd>
              <dt>Territory</dt><dd>{l.territory || '—'}</dd>
              <dt>Capacity</dt><dd>{l.estimated_kw ? `${l.estimated_kw} kW` : '—'}</dd>
              <dt>Est. value</dt><dd>{l.estimated_value ? formatINR(l.estimated_value) : '—'}</dd>
              <dt>Win probability</dt><dd>{prob != null ? `${prob}% (stage setting, not actual)` : '—'}</dd>
              <dt>Next action</dt><dd className={isOverdue(l.next_action_due_at) ? 'sl-overdue' : ''}>{l.next_action_due_at ? `${formatDate(l.next_action_due_at, true)} · ${l.next_action || ''}` : (l.next_action_exception ? `Exception: ${l.next_action_exception}` : '—')}</dd>
              <dt>Last activity</dt><dd>{l.last_activity_at ? `${formatDate(l.last_activity_at, true)} · ${l.last_activity_type || ''}` : '—'}</dd>
              <dt>Created</dt><dd>{formatDate(l.created_at, true)}{l.lead_created_by_name ? ` by ${l.lead_created_by_name}` : ''}</dd>
              <dt>Requirement</dt><dd style={{ whiteSpace: 'pre-wrap' }}>{l.product_requirement || '—'}</dd>
            </dl>
          </div>

          {/* Lead Score Card */}
          <div className="sl-card sl-card-pad">
            <h4 className="sl-section-title">Lead score · {l.score ?? '—'} / 100</h4>
            {(l.score_breakdown || []).length === 0 ? <div className="sl-faint">No scoring signals yet.</div> :
              l.score_breakdown.map((b, i) => (
                <div key={i} className="sl-score-row"><span>{b.label}</span><span style={{ color: b.points < 0 ? '#B91C1C' : '#111827', fontWeight: 600 }}>{b.points > 0 ? '+' : ''}{b.points}</span></div>
              ))}
            <div className="sl-faint" style={{ marginTop: 6 }}>Rule-based score. Hot ≥ {meta?.scoring?.hotMin ?? 70}, Warm ≥ {meta?.scoring?.warmMin ?? 40}.</div>
          </div>

          {/* Customer 360 Card */}
          <div className="sl-card sl-card-pad">
            <h4 className="sl-section-title">Customer 360°</h4>
            {detail.customerMaster ? (
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                  <span className="sl-strong">{detail.customerMaster.customer_code}</span>
                  <span className="sl-badge" style={{ background: '#ECFDF5', color: '#047857' }}>Registered Master</span>
                </div>
                <dl className="sl-dl">
                  <dt>Customer</dt><dd>{detail.customerMaster.customer_name || detail.customerMaster.company_name}</dd>
                  <dt>GSTIN</dt><dd>{detail.customerMaster.gst_number || '—'}</dd>
                  <dt>Location</dt><dd>{[detail.customerMaster.city, detail.customerMaster.state].filter(Boolean).join(', ') || '—'}</dd>
                  <dt>Credit Status</dt><dd>{detail.customerMaster.credit_approved ? `Approved (₹${Number(detail.customerMaster.credit_limit || 0).toLocaleString('en-IN')})` : 'Not Enrolled'}</dd>
                </dl>
              </div>
            ) : (
              <div className="sl-faint">No existing customer master record. Will be created on Won / Quotation conversion.</div>
            )}

            {detail.relatedLeads && detail.relatedLeads.length > 0 && (
              <div style={{ marginTop: 12, paddingTop: 10, borderTop: '1px solid #F1F1F3' }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: '#0E7490', marginBottom: 6 }}>
                  Repeat Enquiry ({detail.relatedLeads.length} other lead{detail.relatedLeads.length > 1 ? 's' : ''})
                </div>
                {detail.relatedLeads.map(rl => (
                  <div key={rl.id} className="sl-score-row" style={{ alignItems: 'center' }}>
                    <span className="sl-muted">{rl.lead_number} · {formatDate(rl.created_at)}</span>
                    <StageBadge stage={rl.pipeline_stage} />
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Quotations & Orders Card */}
          <div className="sl-card sl-card-pad">
            <h4 className="sl-section-title">Sales Documents & Lifecycle</h4>
            
            {/* Customer Master Status Banner */}
            <div style={{
              marginBottom: 14,
              padding: '10px 12px',
              borderRadius: '8px',
              backgroundColor: (l.is_converted || detail.customerMaster) ? '#F0FDF4' : '#F8FAFC',
              border: `1px solid ${(l.is_converted || detail.customerMaster) ? '#BBF7D0' : '#E2E8F0'}`
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ fontSize: 11, fontWeight: 700, color: (l.is_converted || detail.customerMaster) ? '#166534' : '#64748B', textTransform: 'uppercase' }}>
                    Customer Master
                  </div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: '#0F172A', marginTop: 2 }}>
                    {(l.is_converted || detail.customerMaster)
                      ? (l.converted_customer_code || detail.customerMaster?.customer_code || detail.customerMaster?.company_name || 'Enrolled')
                      : 'Not Enrolled in Customer Master'}
                  </div>
                </div>
                {(!l.is_converted && !detail.customerMaster) ? (
                  <button
                    className="sl-btn sl-btn-sm"
                    onClick={handleConvertToCustomer}
                    disabled={convertingCustomer}
                    style={{ backgroundColor: '#0E7490', color: '#FFFFFF', border: 'none', fontWeight: 700, padding: '4px 10px', fontSize: 11 }}
                  >
                    <UserPlus size={12} /> {convertingCustomer ? 'Converting…' : 'Convert Now'}
                  </button>
                ) : (
                  <button
                    className="sl-btn sl-btn-sm"
                    onClick={() => onNavigateTab && onNavigateTab('Customers')}
                    style={{ backgroundColor: '#FFFFFF', color: '#166534', border: '1px solid #BBF7D0', fontWeight: 700, padding: '4px 10px', fontSize: 11 }}
                  >
                    View Record ›
                  </button>
                )}
              </div>
            </div>

            {/* Quotations */}
            <div style={{ marginBottom: 12 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: '#64748B', textTransform: 'uppercase' }}>
                  Quotations ({(detail.quotations || []).length})
                </div>
                <button
                  className="sl-btn sl-btn-sm"
                  onClick={handleCreateQuotation}
                  style={{ fontSize: 11, padding: '2px 8px', fontWeight: 700, color: '#0E7490', borderColor: '#A5F3FC', backgroundColor: '#ECFEFF' }}
                >
                  <Plus size={11} /> New Quote
                </button>
              </div>
              {(!detail.quotations || detail.quotations.length === 0) ? (
                <div className="sl-faint" style={{ fontSize: 12 }}>No quotation created yet. Click "+ New Quote" to prepare proposal.</div>
              ) : (
                detail.quotations.map(q => (
                  <div key={q.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 0', borderBottom: '1px solid #F1F5F9', fontSize: 12.5 }}>
                    <div>
                      <div style={{ fontWeight: 700, color: '#0F172A' }}>{q.quote_number}</div>
                      <div className="sl-muted" style={{ fontSize: 11 }}>
                        {q.status}{q.converted_pi_no ? ` → PI ${q.converted_pi_no}` : ''}
                      </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span className="sl-strong">{formatINR(q.grand_total)}</span>
                      {!q.converted_pi_no && (
                        <button
                          className="sl-btn sl-btn-sm"
                          onClick={() => handleConvertToPI(q)}
                          style={{ fontSize: 11, padding: '2px 8px', color: '#0E7490', borderColor: '#0E7490', fontWeight: 700 }}
                          title="Convert this quote into an official Proforma Invoice (PI)"
                        >
                          Convert to PI →
                        </button>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Proforma Invoices (PI) */}
            <div style={{ marginBottom: 12, paddingTop: 8, borderTop: '1px solid #F1F5F9' }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#64748B', textTransform: 'uppercase', marginBottom: 6 }}>
                Proforma Invoices ({detail.proformaInvoices?.length || 0})
              </div>
              {(!detail.proformaInvoices || detail.proformaInvoices.length === 0) ? (
                <div className="sl-faint" style={{ fontSize: 12 }}>No Proforma Invoice issued yet. Convert an approved quotation to PI.</div>
              ) : (
                detail.proformaInvoices.map(pi => (
                  <div key={pi.id || pi.pi_no} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 0', borderBottom: '1px solid #F1F5F9', fontSize: 12.5 }}>
                    <div>
                      <div style={{ fontWeight: 700, color: '#0F172A' }}>{pi.pi_no}</div>
                      <div className="sl-muted" style={{ fontSize: 11 }}>{pi.status || 'Confirmed'}</div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span className="sl-strong">{formatINR(pi.grand_total || pi.total_amount)}</span>
                      <button
                        className="sl-btn sl-btn-sm"
                        onClick={() => handleConvertToBOM(pi)}
                        style={{ fontSize: 11, padding: '2px 8px', color: '#7C3AED', borderColor: '#DDD6FE', backgroundColor: '#F5F3FF', fontWeight: 700 }}
                        title="Convert this PI into a Bill of Materials (BOM) production order"
                      >
                        Convert to BOM →
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* BOM Production Orders */}
            <div style={{ marginBottom: 12, paddingTop: 8, borderTop: '1px solid #F1F5F9' }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#64748B', textTransform: 'uppercase', marginBottom: 6 }}>
                BOM Production Orders ({detail.bomOrders?.length || 0})
              </div>
              {(!detail.bomOrders || detail.bomOrders.length === 0) ? (
                <div className="sl-faint" style={{ fontSize: 12 }}>No BOM order created yet. Convert a confirmed PI to BOM.</div>
              ) : (
                detail.bomOrders.map(b => (
                  <div key={b.id || b.bom_code} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 0', borderBottom: '1px solid #F1F5F9', fontSize: 12.5 }}>
                    <div>
                      <div style={{ fontWeight: 700, color: '#0F172A' }}>{b.bom_code}</div>
                      <div className="sl-muted" style={{ fontSize: 11 }}>{b.status || 'Active Production'}</div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span className="sl-strong">{formatINR(b.grand_total)}</span>
                      <button
                        className="sl-btn sl-btn-sm"
                        onClick={() => onNavigateTab && onNavigateTab('BOM Orders', null, b.bom_code)}
                        style={{ fontSize: 11, padding: '2px 8px', color: '#475569', fontWeight: 600 }}
                      >
                        View BOM ›
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Final Tax Invoices */}
            {(detail.invoices && detail.invoices.length > 0) && (
              <div style={{ marginBottom: 12, paddingTop: 8, borderTop: '1px solid #F1F5F9' }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: '#64748B', textTransform: 'uppercase', marginBottom: 4 }}>
                  Tax Invoices ({detail.invoices.length})
                </div>
                {detail.invoices.map(inv => (
                  <div key={inv.id || inv.inv_no} className="sl-score-row" style={{ fontSize: 12.5 }}>
                    <span>{inv.inv_no} · <span className="sl-muted">{inv.status || 'Generated'}</span></span>
                    <span className="sl-strong">{formatINR(inv.inv_amt)}</span>
                  </div>
                ))}
              </div>
            )}

            {l.is_converted && <div className="sl-muted" style={{ marginTop: 6, fontSize: 11 }}>Converted customer: {l.converted_customer_code || l.converted_customer_id}</div>}
          </div>
        </div>
      </div>

      {modal?.type === 'edit' && <LeadFormModal meta={meta} lead={l} onClose={() => setModal(null)} onSaved={afterAction} />}
      {modal?.type === 'followup' && <ScheduleFollowupModal lead={l} onClose={() => setModal(null)} onDone={afterAction} />}
      {modal?.type === 'assign' && <AssignModal meta={meta} leads={[l]} onClose={() => setModal(null)} onDone={afterAction} />}
      {modal?.type === 'activity' && <ActivityModal lead={l} onClose={() => setModal(null)} onDone={afterAction} />}
      {modal?.type === 'stage' && <StageModal meta={meta} lead={l} initialStage={modal.initialStage} onClose={() => setModal(null)} onDone={afterAction} />}
    </div>
  );
}

export function LeadProfileModal({ meta, leadId, onClose, toast, onNavigateTab }) {
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  if (!leadId) return null;

  return (
    <div
      className="sl-overlay"
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(15, 23, 42, 0.65)',
        backdropFilter: 'blur(3px)',
        zIndex: 9990,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '20px 16px'
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="sl-modal"
        style={{
          width: '100%',
          maxWidth: '1160px',
          maxHeight: '92vh',
          backgroundColor: '#FFFFFF',
          borderRadius: '16px',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          style={{
            padding: '14px 20px',
            borderBottom: '1px solid #E2E8F0',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            backgroundColor: '#F8FAFC'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '15px', fontWeight: '700', color: '#0F172A' }}>
              Lead Profile & 360° Intelligence
            </span>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              color: '#64748B',
              padding: '6px',
              borderRadius: '6px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'background 0.15s'
            }}
            onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#E2E8F0'; }}
            onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; }}
            title="Close (Esc)"
          >
            <X size={20} />
          </button>
        </div>
        <div style={{ flex: 1, overflowY: 'auto', padding: '18px 20px', backgroundColor: '#F8FAFC' }}>
          <LeadProfileView meta={meta} leadId={leadId} onBack={onClose} toast={toast} isModal={true} onNavigateTab={onNavigateTab} />
        </div>
      </div>
    </div>
  );
}
