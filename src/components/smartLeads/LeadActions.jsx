import React, { useState } from 'react';
import { Modal } from './SlShared';
import { slApi } from './smartLeadsApi';

export function StageModal({ meta, lead, bulkIds, initialStage, onClose, onDone }) {
  const [stage, setStage] = useState(initialStage || '');
  const [lostReasonId, setLostReasonId] = useState('');
  const [remarks, setRemarks] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const reasons = (meta?.lostReasons || []).filter(r => r.is_active);
  const submit = async () => {
    setError('');
    if (!stage) return setError('Choose a stage.');
    if (stage === 'Lost' && !lostReasonId) return setError('Choose a lost reason.');
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
          {(meta?.stages || []).filter(s => s !== lead.pipeline_stage).map(s => <option key={s}>{s}</option>)}
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
        <label className="sl-label" htmlFor="sl-remarks">Remarks</label>
        <textarea id="sl-remarks" className="sl-textarea" value={remarks} onChange={e => setRemarks(e.target.value)} />
      </div>
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
