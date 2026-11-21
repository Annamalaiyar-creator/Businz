import React, { useState, useEffect, useMemo } from 'react';
import { Phone, MessageCircle, Mail, Users } from 'lucide-react';
import { Modal } from './SlShared';
import { slApi } from './smartLeadsApi';

const OPEN_STAGES = ['New', 'Contacted', 'Qualified', 'Quotation Sent', 'Negotiation'];

export function StageModal({ meta, lead, bulkIds, initialStage, onClose, onDone }) {
  // Stages only move forward; moving back / reopening is for CEO, Technical Administrator or Tech Support with a reason
  const from = lead.pipeline_stage;
  const isBack = (to) => ['Won', 'Lost'].includes(from) || (OPEN_STAGES.includes(from) && OPEN_STAGES.includes(to) && OPEN_STAGES.indexOf(to) < OPEN_STAGES.indexOf(from));
  const isManager = Boolean(meta?.me?.isManager);
  const allowedStages = (meta?.stages || []).filter(s => s !== from && (isManager || !isBack(s)));
  const [stage, setStage] = useState(allowedStages.includes(initialStage) ? initialStage : '');
  const [lostReasonId, setLostReasonId] = useState('');
  const [remarks, setRemarks] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const reasons = (meta?.lostReasons || []).filter(r => r.is_active);
  const needsReason = Boolean(stage) && isBack(stage);
  const submit = async () => {
    setError('');
    if (!stage) return setError('Choose a stage.');
    if (stage === 'Lost' && !lostReasonId) return setError('Choose a lost reason.');
    if (needsReason && !remarks.trim()) return setError('Give a reason for moving this lead back.');
    setSaving(true);
    try {
      if (bulkIds) {
        await slApi.bulk({ ids: bulkIds, action: 'stage', stage, lostReasonId: lostReasonId || undefined, remarks });
        onDone(null, `${bulkIds.length} leads moved to ${stage}`);
      } else {
        const res = await slApi.changeStage(lead.id, { stage, lostReasonId: lostReasonId || undefined, remarks });
        onDone(res.lead, `Moved to ${stage}`);
      }
    } catch (err) { setError(err.message); } finally { setSaving(false); }
  };
  return (
    <Modal small title={`Change stage · ${lead.company_name}`} onClose={onClose}
      footer={<><button className="sl-btn" onClick={onClose}>Cancel</button><button className="sl-btn sl-btn-primary" disabled={saving} onClick={submit}>{saving ? 'Saving…' : 'Update stage'}</button></>}>
      {error && <div className="sl-alert sl-alert-error">{error}</div>}
      <div className="sl-field">
        <label className="sl-label" htmlFor="sl-stage">Stage</label>
        <select id="sl-stage" className="sl-select" value={stage} onChange={e => setStage(e.target.value)}>
          <option value="">Select…</option>
          {allowedStages.map(s => <option key={s}>{s}</option>)}
        </select>
      </div>
      {stage === 'Lost' && (
        <div className="sl-field">
          <label className="sl-label" htmlFor="sl-lost">Lost reason *</label>
          <select id="sl-lost" className="sl-select" value={lostReasonId} onChange={e => setLostReasonId(e.target.value)}>
            <option value="">Select…</option>
            {reasons.map(r => <option key={r.id} value={r.id}>{r.label}</option>)}
          </select>
        </div>
      )}
      <div className="sl-field">
        <label className="sl-label" htmlFor="sl-remarks">{needsReason ? 'Reason for moving back *' : 'Remarks'}</label>
        <textarea id="sl-remarks" className="sl-textarea" value={remarks} onChange={e => setRemarks(e.target.value)} />
      </div>
      {stage === 'Won' && <p className="sl-faint" style={{ margin: 0 }}>Won needs a quotation for this lead and the customer in the Customer master.</p>}
      {['Won', 'Lost'].includes(stage) && <p className="sl-faint" style={{ margin: 0 }}>Pending follow-ups for this lead will be closed automatically.</p>}
    </Modal>
  );
}

export function AssignModal({ meta, leads, onClose, onDone }) {
  const [userId, setUserId] = useState('');
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const submit = async () => {
    setError('');
    if (!userId) return setError('Choose a salesperson.');
    setSaving(true);
    try {
      if (leads.length === 1) {
        const res = await slApi.assign(leads[0].id, { userId, reason });
        onDone(res.lead, 'Owner updated');
      } else {
        await slApi.bulk({ ids: leads.map(l => l.id), action: 'assign', userId, reason });
        onDone(null, `${leads.length} leads reassigned`);
      }
    } catch (err) { setError(err.message); } finally { setSaving(false); }
  };
  return (
    <Modal small title={leads.length === 1 ? `Assign · ${leads[0].company_name}` : `Reassign ${leads.length} leads`} onClose={onClose}
      footer={<><button className="sl-btn" onClick={onClose}>Cancel</button><button className="sl-btn sl-btn-primary" disabled={saving} onClick={submit}>{saving ? 'Saving…' : 'Assign'}</button></>}>
      {error && <div className="sl-alert sl-alert-error">{error}</div>}
      {(meta?.team || []).length === 0 && <div className="sl-alert sl-alert-warn">No registered sales users found in BUSINZ.</div>}
      <div className="sl-field">
        <label className="sl-label" htmlFor="sl-assignee">Salesperson</label>
        <select id="sl-assignee" className="sl-select" value={userId} onChange={e => setUserId(e.target.value)}>
          <option value="">Select…</option>
          {(meta?.team || []).map(t => <option key={t.user_id} value={t.user_id}>{t.name} · {t.role}</option>)}
        </select>
      </div>
      <div className="sl-field">
        <label className="sl-label" htmlFor="sl-reason">Reason</label>
        <input id="sl-reason" className="sl-input" value={reason} onChange={e => setReason(e.target.value)} placeholder="e.g. Territory change" />
      </div>
    </Modal>
  );
}

export function ActivityModal({ lead, onClose, onDone }) {
  const [type, setType] = useState('CALL');
  const [summary, setSummary] = useState('');
  const [customerResponse, setCustomerResponse] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const submit = async () => {
    setError('');
    if (!summary.trim()) return setError('Summary is required.');
    setSaving(true);
    try {
      const res = await slApi.addActivity(lead.id, { type, summary, customerResponse });
      onDone(res.lead, 'Activity logged');
    } catch (err) { setError(err.message); } finally { setSaving(false); }
  };
  return (
    <Modal small title={`Log activity · ${lead.company_name}`} onClose={onClose}
      footer={<><button className="sl-btn" onClick={onClose}>Cancel</button><button className="sl-btn sl-btn-primary" disabled={saving} onClick={submit}>{saving ? 'Saving…' : 'Save'}</button></>}>
      {error && <div className="sl-alert sl-alert-error">{error}</div>}
      <div className="sl-chips">
        {['CALL', 'WHATSAPP', 'EMAIL', 'MEETING'].map(t => (
          <button key={t} className={`sl-chip ${type === t ? 'active' : ''}`} onClick={() => setType(t)}>{t[0] + t.slice(1).toLowerCase()}</button>
        ))}
      </div>
      <div className="sl-field">
        <label className="sl-label" htmlFor="sl-sum">What happened? *</label>
        <textarea id="sl-sum" className="sl-textarea" value={summary} onChange={e => setSummary(e.target.value)} />
      </div>
      <div className="sl-field">
        <label className="sl-label" htmlFor="sl-resp">Customer response</label>
        <input id="sl-resp" className="sl-input" value={customerResponse} onChange={e => setCustomerResponse(e.target.value)} />
      </div>
    </Modal>
  );
}

export function ScheduleFollowupModal({ lead, onClose, onDone }) {
  const [leadsList, setLeadsList] = useState(lead ? [lead] : []);
  const [selectedLeadId, setSelectedLeadId] = useState(lead?.id || '');
  const [type, setType] = useState('CALL');

  // Format local ISO for datetime-local default (tomorrow 10:00 AM)
  const defaultDateStr = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    d.setHours(10, 0, 0, 0);
    const pad = n => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }, []);

  const [scheduledAt, setScheduledAt] = useState(defaultDateStr);
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [loadingLeads, setLoadingLeads] = useState(!lead);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!lead) {
      setLoadingLeads(true);
      slApi.listLeads({ pageSize: 50, sort: 'newest' })
        .then(res => {
          const list = res.rows || [];
          setLeadsList(list);
          if (list.length > 0 && !selectedLeadId) {
            setSelectedLeadId(list[0].id);
          }
        })
        .catch(err => setError(err.message))
        .finally(() => setLoadingLeads(false));
    }
  }, [lead, selectedLeadId]);

  const setPreset = (daysOffset, hour = 10) => {
    const d = new Date();
    d.setDate(d.getDate() + daysOffset);
    d.setHours(hour, 0, 0, 0);
    const pad = n => String(n).padStart(2, '0');
    setScheduledAt(`${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`);
  };

  const submit = async () => {
    setError('');
    const targetId = lead?.id || selectedLeadId;
    if (!targetId) return setError('Please choose a lead.');
    if (!scheduledAt) return setError('Please choose date & time.');
    setSaving(true);
    try {
      const res = await slApi.scheduleFollowup(targetId, {
        followup_type: type,
        scheduled_at: new Date(scheduledAt).toISOString(),
        notes: notes.trim()
      });
      onDone(res.followup, 'Follow-up scheduled successfully!');
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const currentLead = lead || leadsList.find(l => l.id === selectedLeadId);

  return (
    <Modal
      small
      title={currentLead ? `Schedule Follow-up · ${currentLead.company_name}` : 'Schedule Follow-up'}
      onClose={onClose}
      footer={
        <>
          <button className="sl-btn" onClick={onClose}>Cancel</button>
          <button className="sl-btn sl-btn-primary" disabled={saving || (!lead && leadsList.length === 0)} onClick={submit}>
            {saving ? 'Scheduling…' : 'Schedule Follow-up'}
          </button>
        </>
      }
    >
      {error && <div className="sl-alert sl-alert-error">{error}</div>}

      {!lead && (
        <div className="sl-field">
          <label className="sl-label" htmlFor="sl-target-lead">Target Lead / Company *</label>
          {loadingLeads ? (
            <div className="sl-muted" style={{ fontSize: '12px' }}>Loading leads...</div>
          ) : leadsList.length === 0 ? (
            <div className="sl-alert sl-alert-warn" style={{ fontSize: '12px', margin: 0 }}>No active leads found to schedule a follow-up for.</div>
          ) : (
            <select
              id="sl-target-lead"
              className="sl-select"
              value={selectedLeadId}
              onChange={e => setSelectedLeadId(e.target.value)}
            >
              {leadsList.map(l => (
                <option key={l.id} value={l.id}>
                  {l.company_name} ({l.lead_number}) · {l.contact_person || 'No Contact'}
                </option>
              ))}
            </select>
          )}
        </div>
      )}

      <div className="sl-field">
        <label className="sl-label">Follow-up Channel</label>
        <div className="sl-chips">
          {[
            { key: 'CALL', label: 'Phone Call', icon: Phone },
            { key: 'WHATSAPP', label: 'WhatsApp', icon: MessageCircle },
            { key: 'EMAIL', label: 'Email', icon: Mail },
            { key: 'MEETING', label: 'Meeting', icon: Users }
          ].map(c => {
            const Icon = c.icon;
            return (
              <button
                type="button"
                key={c.key}
                className={`sl-chip ${type === c.key ? 'active' : ''}`}
                onClick={() => setType(c.key)}
                style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
              >
                <Icon size={13} />
                <span>{c.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="sl-field">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
          <label className="sl-label" htmlFor="sl-sched-time" style={{ margin: 0 }}>Scheduled Date & Time *</label>
          <div style={{ display: 'flex', gap: '4px' }}>
            <button
              type="button"
              className="sl-btn sl-btn-sm"
              style={{ fontSize: '11px', padding: '2px 6px', height: 'auto', minHeight: 'auto' }}
              onClick={() => setPreset(0, 16)}
            >
              Today 4 PM
            </button>
            <button
              type="button"
              className="sl-btn sl-btn-sm"
              style={{ fontSize: '11px', padding: '2px 6px', height: 'auto', minHeight: 'auto' }}
              onClick={() => setPreset(1, 10)}
            >
              Tomorrow 10 AM
            </button>
            <button
              type="button"
              className="sl-btn sl-btn-sm"
              style={{ fontSize: '11px', padding: '2px 6px', height: 'auto', minHeight: 'auto' }}
              onClick={() => setPreset(2, 11)}
            >
              In 2 Days
            </button>
          </div>
        </div>
        <input
          id="sl-sched-time"
          type="datetime-local"
          className="sl-input"
          value={scheduledAt}
          onChange={e => setScheduledAt(e.target.value)}
          required
        />
      </div>

      <div className="sl-field">
        <label className="sl-label" htmlFor="sl-sched-notes">Follow-up Agenda / Discussion Notes</label>
        <textarea
          id="sl-sched-notes"
          className="sl-textarea"
          rows={3}
          placeholder="e.g. Call to discuss quotation revision, confirm panel specifications, check site readiness..."
          value={notes}
          onChange={e => setNotes(e.target.value)}
        />
      </div>
    </Modal>
  );
}
