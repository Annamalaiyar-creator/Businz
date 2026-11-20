import React, { useState } from 'react';
import { slApi } from './smartLeadsApi';

export default function LeadSettingsView({ meta, onMetaChange, toast }) {
  const isAdmin = !!meta?.me?.isAdmin;
  const [probs, setProbs] = useState(() => ({ ...meta.stageProbabilities }));
  const [sla, setSla] = useState(() => ({ ...meta.sla }));
  const [newReason, setNewReason] = useState('');
  const [busy, setBusy] = useState('');

  const save = async (key, value, label) => {
    setBusy(key);
    try { await slApi.saveSetting(key, value); toast(`${label} saved`); onMetaChange(); }
    catch (err) { toast(err.message, 'error'); } finally { setBusy(''); }
  };
  const addReason = async () => {
    if (!newReason.trim()) return;
    setBusy('reason');
    try { await slApi.addLostReason(newReason.trim()); setNewReason(''); toast('Reason added'); onMetaChange(); }
    catch (err) { toast(err.message, 'error'); } finally { setBusy(''); }
  };
  const toggleReason = async (r) => {
    try { await slApi.toggleLostReason(r.id, !r.is_active); onMetaChange(); }
    catch (err) { toast(err.message, 'error'); }
  };

  const SLA_LABELS = { firstResponseHours: 'First response SLA (hours)', followupEscalateAfterHours: 'Escalate overdue follow-up after (hours)', inactivityDays: 'Flag lead inactive after (days)' };

  return (
    <div style={{ display: 'grid', gap: 16, maxWidth: 860 }}>
      {!isAdmin && <div className="sl-alert sl-alert-warn">Read-only. Only CEO / MD / Technical Administrator can change Smart Leads settings.</div>}

      <div className="sl-card sl-card-pad">
        <h4 className="sl-section-title">Pipeline stages & win probability</h4>
        <p className="sl-faint" style={{ marginTop: 0 }}>Used only for the weighted forecast. These are estimates, not actual sales.</p>
        <div className="sl-form-grid">
          {meta.stages.map(s => (
            <div className="sl-field" key={s}>
              <label className="sl-label" htmlFor={`sl-p-${s}`}>{s} (%)</label>
              <input id={`sl-p-${s}`} className="sl-input" inputMode="numeric" disabled={!isAdmin} value={probs[s] ?? ''} onChange={e => setProbs(p => ({ ...p, [s]: e.target.value.replace(/[^\d]/g, '') }))} />
            </div>
          ))}
        </div>
        {isAdmin && <button className="sl-btn sl-btn-primary" disabled={busy === 'stageProbabilities'} onClick={() => save('stageProbabilities', Object.fromEntries(Object.entries(probs).map(([k, v]) => [k, Number(v)])), 'Probabilities')}>Save probabilities</button>}
      </div>

      <div className="sl-card sl-card-pad">
        <h4 className="sl-section-title">Follow-up SLA</h4>
        <div className="sl-form-grid">
          {Object.keys(SLA_LABELS).map(k => (
            <div className="sl-field" key={k}>
              <label className="sl-label" htmlFor={`sl-sla-${k}`}>{SLA_LABELS[k]}</label>
              <input id={`sl-sla-${k}`} className="sl-input" inputMode="decimal" disabled={!isAdmin} value={sla[k] ?? ''} onChange={e => setSla(p => ({ ...p, [k]: e.target.value.replace(/[^\d.]/g, '') }))} />
            </div>
          ))}
        </div>
        {isAdmin && <button className="sl-btn sl-btn-primary" disabled={busy === 'sla'} onClick={() => save('sla', Object.fromEntries(Object.entries(sla).map(([k, v]) => [k, Number(v)])), 'SLA')}>Save SLA</button>}
      </div>

      <div className="sl-card sl-card-pad">
        <h4 className="sl-section-title">Lost reasons</h4>
        {isAdmin && (
          <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
            <input className="sl-input" placeholder="New reason" value={newReason} maxLength={80} onChange={e => setNewReason(e.target.value)} onKeyDown={e => e.key === 'Enter' && addReason()} aria-label="New lost reason" />
            <button className="sl-btn sl-btn-primary" disabled={busy === 'reason'} onClick={addReason}>Add</button>
          </div>
        )}
        {meta.lostReasons.map(r => (
          <div key={r.id} className="sl-score-row" style={{ padding: '8px 0', borderBottom: '1px solid #F1F1F3' }}>
            <span style={{ color: r.is_active ? '#111827' : '#9CA3AF' }}>{r.label}{!r.is_active && ' (disabled)'}</span>
            {isAdmin && <button className="sl-btn sl-btn-sm" onClick={() => toggleReason(r)}>{r.is_active ? 'Disable' : 'Enable'}</button>}
          </div>
        ))}
      </div>

      <div className="sl-card sl-card-pad">
        <h4 className="sl-section-title">Lead scoring rules</h4>
        <p className="sl-faint" style={{ marginTop: 0 }}>Explainable, rule-based. Every lead shows exactly which rules added or removed points.</p>
        <div className="sl-score-row"><span>Hot / Warm thresholds</span><span>≥ {meta.scoring.hotMin} / ≥ {meta.scoring.warmMin}</span></div>
        {Object.entries(meta.scoring.sourcePoints || {}).map(([k, v]) => <div key={k} className="sl-score-row"><span>Source: {k}</span><span>+{v}</span></div>)}
        {Object.entries(meta.scoring.stagePoints || {}).map(([k, v]) => <div key={k} className="sl-score-row"><span>Stage: {k}</span><span>+{v}</span></div>)}
        <div className="sl-score-row"><span>Activity in last {meta.scoring.recentActivityDays} days</span><span>+{meta.scoring.recentActivityPoints}</span></div>
        <div className="sl-score-row"><span>No activity for {meta.scoring.staleDays}+ days</span><span>{meta.scoring.stalePenalty}</span></div>
      </div>
    </div>
  );
}
