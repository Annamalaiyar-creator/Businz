import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, Phone, MessageCircle, Mail, PhoneCall, StickyNote, ArrowRightLeft, UserCheck, Pencil, CalendarClock, FileText } from 'lucide-react';
import { slApi, onSmartLeadChange, formatINR, formatDate, isOverdue } from './smartLeadsApi';
import { StageBadge, TempBadge, EmptyState, SkeletonRows } from './SlShared';
import LeadFormModal from './LeadFormModal';
import { StageModal, AssignModal, ActivityModal } from './LeadActions';

const ICONS = { activity: PhoneCall, note: StickyNote, stage: ArrowRightLeft, assign: UserCheck, audit: Pencil, followup: CalendarClock };

export default function LeadProfileView({ meta, leadId, onBack, toast }) {
  const [detail, setDetail] = useState(null);
  const [error, setError] = useState('');
  const [modal, setModal] = useState(null);
  const [tab, setTab] = useState('all');
  const [note, setNote] = useState('');
  const [savingNote, setSavingNote] = useState(false);
  const lastLocalWrite = useRef(0); // skip the SSE echo of our own write (we already reload once)

  const load = useCallback(async () => {
    try { setError(''); setDetail(await slApi.getLead(leadId)); }
    catch (err) { setError(err.message); }
  }, [leadId]);
  useEffect(() => { load(); }, [load]);
  useEffect(() => onSmartLeadChange(({ leadId: changed, action }) => {
    if (changed !== leadId || Date.now() - lastLocalWrite.current < 3000) return;
    if (action === 'delete') { toast('This lead was removed or merged'); onBack(); } else load();
  }), [leadId, load, onBack, toast]);

  const timeline = useMemo(() => {
    if (!detail) return [];
    const items = [
      ...detail.activities.map(a => ({ kind: 'activity', at: a.created_at, title: `${a.activity_type} · ${a.conducted_by_name || ''}`, body: a.summary, sub: a.customer_response ? `Customer: ${a.customer_response}` : '' })),
      ...detail.notes.map(n => ({ kind: 'note', at: n.created_at, title: `Note · ${n.created_by_name || ''}`, body: n.body })),
      ...detail.statusHistory.map(s => ({ kind: 'stage', at: s.created_at, title: `Stage: ${s.previous_status || '—'} → ${s.new_status}`, body: s.remarks, sub: s.updated_by_name })),
      ...detail.assignmentHistory.map(a => ({ kind: 'assign', at: a.created_at, title: `Owner: ${a.previous_assigned_to_name || 'Unassigned'} → ${a.assigned_to_name}`, body: a.assignment_reason, sub: `by ${a.assigned_by_name || '—'}` })),
      ...detail.audit.filter(a => a.field !== 'owner').map(a => ({ kind: 'audit', at: a.changed_at, title: `Edited ${a.field.replace(/_/g, ' ')}`, body: `${a.old_value ?? '—'} → ${a.new_value ?? '—'}`, sub: a.changed_by_name })),
      ...detail.followups.map(f => ({ kind: 'followup', at: f.created_at, title: `Follow-up (${f.followup_type || 'CALL'}) · ${f.status}`, body: f.notes, sub: `Due ${formatDate(f.scheduled_at, true)}${f.outcome ? ` · Outcome: ${f.outcome}` : ''}` }))
    ];
    const filterMap = { all: null, activity: ['activity'], note: ['note'], history: ['stage', 'assign', 'audit'], followup: ['followup'] };
    const allowed = filterMap[tab];
    return items.filter(i => !allowed || allowed.includes(i.kind)).sort((a, b) => new Date(b.at) - new Date(a.at));
  }, [detail, tab]);

  const afterAction = (_lead, msg) => { lastLocalWrite.current = Date.now(); setModal(null); if (msg) toast(msg); load(); };

  const saveNote = async () => {
    if (!note.trim()) return;
    setSavingNote(true);
    try { await slApi.addNote(leadId, note.trim()); lastLocalWrite.current = Date.now(); setNote(''); toast('Note added'); load(); }
    catch (err) { toast(err.message, 'error'); } finally { setSavingNote(false); }
  };

  if (error) return (<div><button className="sl-back" onClick={onBack}><ArrowLeft size={14} /> All leads</button><div className="sl-alert sl-alert-error">{error}</div></div>);
  if (!detail) return <div className="sl-card"><SkeletonRows rows={8} /></div>;

  const l = detail.lead;
  const stages = meta?.stages || [];
  const curIdx = stages.indexOf(l.pipeline_stage);
  const lostReason = (meta?.lostReasons || []).find(r => r.id === l.lost_reason_id);
  const waNumber = String(l.whatsapp || l.phone || '').replace(/\D/g, '').replace(/^(\d{10})$/, '91$1');
  const prob = meta?.stageProbabilities?.[l.pipeline_stage];

  return (
    <div>
      <button className="sl-back" onClick={onBack}><ArrowLeft size={14} style={{ verticalAlign: -2 }} /> All leads</button>

      <div className="sl-card sl-card-pad" style={{ marginBottom: 16 }}>
        <div className="sl-profile-head">
          <div style={{ minWidth: 0 }}>
            <h2 className="sl-profile-name">{l.company_name}</h2>
            <div className="sl-muted">{l.lead_number} · {l.contact_person || 'No contact'}{l.designation ? ` (${l.designation})` : ''} · {l.location || 'No location'}</div>
            <div style={{ display: 'flex', gap: 6, marginTop: 8, flexWrap: 'wrap' }}>
              <StageBadge stage={l.pipeline_stage} />
              <TempBadge temperature={l.temperature} score={l.score} />
              <span className="sl-badge">{l.source || 'Manual'}</span>
              <span className="sl-badge">Owner: {l.assigned_to_name || 'Unassigned'}</span>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {l.phone && <a className="sl-btn" href={`tel:${l.phone}`}><Phone size={14} /> Call</a>}
            {waNumber && <a className="sl-btn" href={`https://wa.me/${waNumber}`} target="_blank" rel="noreferrer"><MessageCircle size={14} /> WhatsApp</a>}
            {l.email && <a className="sl-btn" href={`mailto:${l.email}`}><Mail size={14} /> Email</a>}
            <button className="sl-btn" onClick={() => setModal({ type: 'edit' })}><Pencil size={14} /> Edit</button>
            {meta?.me?.isManager && <button className="sl-btn" onClick={() => setModal({ type: 'assign' })}><UserCheck size={14} /> Assign</button>}
            <button className="sl-btn sl-btn-primary" onClick={() => setModal({ type: 'activity' })}><PhoneCall size={14} /> Log activity</button>
          </div>
        </div>

        <div className="sl-stepper" role="list" aria-label="Pipeline stage">
          {stages.map((s, i) => {
            let cls = '';
            if (s === l.pipeline_stage) cls = s === 'Won' ? 'won' : s === 'Lost' ? 'lost' : 'current';
            else if (curIdx >= 0 && i < curIdx && !['Won', 'Lost'].includes(s) && l.pipeline_stage !== 'Lost') cls = 'done';
            return <button key={s} role="listitem" className={`sl-step ${cls}`} onClick={() => s !== l.pipeline_stage && setModal({ type: 'stage', initialStage: s })} title={`Move to ${s}`}>{s}</button>;
          })}
        </div>
        {l.pipeline_stage === 'Lost' && <div className="sl-alert sl-alert-error" style={{ marginTop: 10, marginBottom: 0 }}>Lost: {lostReason?.label || 'Reason not recorded'}{l.lost_remarks ? ` — ${l.lost_remarks}` : ''}</div>}
        {!['Won', 'Lost'].includes(l.pipeline_stage) && !l.next_action_due_at && !l.next_action_exception && (
          <div className="sl-alert sl-alert-warn" style={{ marginTop: 10, marginBottom: 0 }}>This active lead has no next action. Schedule a follow-up (Follow-ups, phase 2) or record an exception in Edit.</div>
        )}
      </div>

      <div className="sl-grid-2">
        <div style={{ minWidth: 0 }}>
          <div className="sl-card sl-card-pad" style={{ marginBottom: 16 }}>
            <div style={{ display: 'flex', gap: 8 }}>
              <textarea className="sl-textarea" style={{ minHeight: 44 }} placeholder="Add a note…" value={note} onChange={e => setNote(e.target.value)} aria-label="New note" />
              <button className="sl-btn sl-btn-primary" disabled={savingNote || !note.trim()} onClick={saveNote}>Add</button>
            </div>
          </div>
          <div className="sl-card sl-card-pad">
            <div className="sl-tabs-inline" role="tablist">
              {[['all', 'All activity'], ['activity', 'Calls & messages'], ['note', 'Notes'], ['followup', 'Follow-ups'], ['history', 'History & audit']].map(([k, label]) => (
                <button key={k} role="tab" aria-selected={tab === k} className={tab === k ? 'active' : ''} onClick={() => setTab(k)}>{label}</button>
              ))}
            </div>
            {timeline.length === 0 ? <EmptyState title="Nothing here yet" text="Log a call, WhatsApp or meeting to start the timeline." /> : (
              <ul className="sl-timeline">
                {timeline.map((t, i) => {
                  const Icon = ICONS[t.kind] || FileText;
                  return (
                    <li key={`${t.kind}-${i}`}>
                      <span className="sl-tl-icon"><Icon size={14} /></span>
                      <div style={{ minWidth: 0, flex: 1 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                          <span className="sl-strong" style={{ fontSize: 13 }}>{t.title}</span>
                          <span className="sl-faint" style={{ whiteSpace: 'nowrap' }}>{formatDate(t.at, true)}</span>
                        </div>
                        {t.body && <div style={{ fontSize: 13, whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{t.body}</div>}
                        {t.sub && <div className="sl-faint">{t.sub}</div>}
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>

        <div style={{ minWidth: 0, display: 'grid', gap: 16, alignContent: 'start' }}>
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

          <div className="sl-card sl-card-pad">
            <h4 className="sl-section-title">Lead score · {l.score ?? '—'} / 100</h4>
            {(l.score_breakdown || []).length === 0 ? <div className="sl-faint">No scoring signals yet.</div> :
              l.score_breakdown.map((b, i) => (
                <div key={i} className="sl-score-row"><span>{b.label}</span><span style={{ color: b.points < 0 ? '#B91C1C' : '#111827', fontWeight: 600 }}>{b.points > 0 ? '+' : ''}{b.points}</span></div>
              ))}
            <div className="sl-faint" style={{ marginTop: 6 }}>Rule-based score. Hot ≥ {meta?.scoring?.hotMin ?? 70}, Warm ≥ {meta?.scoring?.warmMin ?? 40}.</div>
          </div>

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

          <div className="sl-card sl-card-pad">
            <h4 className="sl-section-title">Quotations & orders</h4>
            {detail.quotations.length === 0 ? <div className="sl-faint">No quotation linked to this lead yet.</div> :
              detail.quotations.map(q => (
                <div key={q.id} className="sl-score-row">
                  <span>{q.quote_number} · {q.status}{q.converted_pi_no ? ` → PI ${q.converted_pi_no}` : ''}</span>
                  <span className="sl-strong">{formatINR(q.grand_total)}</span>
                </div>
              ))}
            {l.is_converted && <div className="sl-muted" style={{ marginTop: 6 }}>Converted customer: {l.converted_customer_code || l.converted_customer_id}</div>}
          </div>
        </div>
      </div>

      {modal?.type === 'edit' && <LeadFormModal meta={meta} lead={l} onClose={() => setModal(null)} onSaved={afterAction} />}
      {modal?.type === 'assign' && <AssignModal meta={meta} leads={[l]} onClose={() => setModal(null)} onDone={afterAction} />}
      {modal?.type === 'activity' && <ActivityModal lead={l} onClose={() => setModal(null)} onDone={afterAction} />}
      {modal?.type === 'stage' && <StageModal meta={meta} lead={l} initialStage={modal.initialStage} onClose={() => setModal(null)} onDone={afterAction} />}
    </div>
  );
}
