import React, { useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import { Modal } from './SlShared';
import { slApi } from './smartLeadsApi';

const SOURCES = ['Manual', 'Referral', 'Website', 'IndiaMART', 'WhatsApp', 'Meta Lead Ads', 'Direct Call'];
const PRIORITIES = ['HIGH', 'MEDIUM', 'LOW'];

export default function LeadFormModal({ meta, lead, onClose, onSaved }) {
  const isEdit = !!lead;
  const [form, setForm] = useState(() => ({
    company_name: lead?.company_name || '', contact_person: lead?.contact_person || '', designation: lead?.designation || '',
    phone: lead?.phone || '', whatsapp: lead?.whatsapp || '', email: lead?.email || '', source: lead?.source || 'Manual',
    category: lead?.category || '', location: lead?.location || '', territory: lead?.territory || '',
    product_requirement: lead?.product_requirement || '', estimated_kw: lead?.estimated_kw ?? '', estimated_value: lead?.estimated_value ?? '',
    priority: lead?.priority || 'MEDIUM', next_action_exception: lead?.next_action_exception || '', assigned_to_user_id: ''
  }));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [duplicates, setDuplicates] = useState([]);
  const set = (k) => (e) => setForm(f => ({ ...f, [k]: e.target.value }));

  const submit = async (force = false) => {
    setError('');
    if (!form.company_name.trim()) return setError('Company name is required.');
    if (form.phone.replace(/\D/g, '').length < 10 && !form.email.trim()) return setError('Enter a phone number (10+ digits) or an email.');
    setSaving(true);
    try {
      let res;
      if (isEdit) {
        const { assigned_to_user_id, ...fields } = form;
        res = await slApi.updateLead(lead.id, { ...fields, expected_updated_at: lead.updated_at });
      } else {
        const { next_action_exception, ...fields } = form;
        res = await slApi.createLead({ ...fields, assigned_to_user_id: form.assigned_to_user_id || undefined, force });
      }
      onSaved(res.lead, isEdit ? 'Lead updated' : `Lead ${res.lead.lead_number} created`);
    } catch (err) {
      if (err.status === 409 && err.data?.duplicates) setDuplicates(err.data.duplicates);
      else setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const footer = duplicates.length ? (
    <>
      <button className="sl-btn" onClick={() => setDuplicates([])}>Back to form</button>
      <button className="sl-btn sl-btn-primary" disabled={saving} onClick={() => submit(true)}>Create anyway</button>
    </>
  ) : (
    <>
      <button className="sl-btn" onClick={onClose}>Cancel</button>
      <button className="sl-btn sl-btn-primary" disabled={saving} onClick={() => submit(false)}>{saving ? 'Saving…' : isEdit ? 'Save changes' : 'Create lead'}</button>
    </>
  );

  return (
    <Modal title={isEdit ? `Edit ${lead.lead_number}` : 'New lead'} onClose={onClose} footer={footer}>
      {error && <div className="sl-alert sl-alert-error">{error}</div>}
      {duplicates.length > 0 ? (
        <div>
          <div className="sl-alert sl-alert-warn" style={{ display: 'flex', gap: 8 }}>
            <AlertTriangle size={16} /> <span>{duplicates.length} existing lead(s) look similar. Open the existing lead instead, or create anyway.</span>
          </div>
          {duplicates.map(d => (
            <div key={d.id} className="sl-card sl-card-pad" style={{ marginBottom: 8 }}>
              <div className="sl-strong">{d.company_name} <span className="sl-faint">· {d.lead_number}</span></div>
              <div className="sl-muted">{d.contact_person || '—'} · {d.phone || d.email || '—'} · {d.pipeline_stage} · Owner: {d.assigned_to_name || 'Unassigned'}</div>
              <div className="sl-faint">Matched on {d.match_on}</div>
            </div>
          ))}
        </div>
      ) : (
        <>
          <div className="sl-form-grid">
            <div className="sl-field" style={{ gridColumn: '1 / -1' }}>
              <label className="sl-label" htmlFor="sl-company">Company name *</label>
              <input id="sl-company" className="sl-input" value={form.company_name} onChange={set('company_name')} autoFocus />
            </div>
            <div className="sl-field"><label className="sl-label" htmlFor="sl-contact">Contact person</label><input id="sl-contact" className="sl-input" value={form.contact_person} onChange={set('contact_person')} /></div>
            <div className="sl-field"><label className="sl-label" htmlFor="sl-desig">Designation</label><input id="sl-desig" className="sl-input" value={form.designation} onChange={set('designation')} /></div>
            <div className="sl-field"><label className="sl-label" htmlFor="sl-phone">Phone</label><input id="sl-phone" className="sl-input" inputMode="tel" value={form.phone} onChange={set('phone')} /></div>
            <div className="sl-field"><label className="sl-label" htmlFor="sl-wa">WhatsApp</label><input id="sl-wa" className="sl-input" inputMode="tel" value={form.whatsapp} onChange={set('whatsapp')} /></div>
            <div className="sl-field"><label className="sl-label" htmlFor="sl-email">Email</label><input id="sl-email" className="sl-input" type="email" value={form.email} onChange={set('email')} /></div>
            <div className="sl-field"><label className="sl-label" htmlFor="sl-source">Source</label>
              <select id="sl-source" className="sl-select" value={form.source} onChange={set('source')}>
                {[...new Set([form.source, ...SOURCES])].map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div className="sl-field"><label className="sl-label" htmlFor="sl-loc">Location</label><input id="sl-loc" className="sl-input" value={form.location} onChange={set('location')} /></div>
            <div className="sl-field"><label className="sl-label" htmlFor="sl-terr">Territory</label><input id="sl-terr" className="sl-input" value={form.territory} onChange={set('territory')} /></div>
            <div className="sl-field"><label className="sl-label" htmlFor="sl-cat">Category</label><input id="sl-cat" className="sl-input" value={form.category} onChange={set('category')} placeholder="e.g. HDG Structure" /></div>
            <div className="sl-field"><label className="sl-label" htmlFor="sl-prio">Priority</label>
              <select id="sl-prio" className="sl-select" value={form.priority} onChange={set('priority')}>{PRIORITIES.map(p => <option key={p}>{p}</option>)}</select>
            </div>
            <div className="sl-field"><label className="sl-label" htmlFor="sl-kw">Estimated capacity (kW)</label><input id="sl-kw" className="sl-input" inputMode="decimal" value={form.estimated_kw} onChange={set('estimated_kw')} /></div>
            <div className="sl-field"><label className="sl-label" htmlFor="sl-val">Estimated value (₹)</label><input id="sl-val" className="sl-input" inputMode="decimal" value={form.estimated_value} onChange={set('estimated_value')} /></div>
            {!isEdit && meta?.me?.isManager && (
              <div className="sl-field" style={{ gridColumn: '1 / -1' }}>
                <label className="sl-label" htmlFor="sl-owner">Assign to</label>
                <select id="sl-owner" className="sl-select" value={form.assigned_to_user_id} onChange={set('assigned_to_user_id')}>
                  <option value="">Leave unassigned</option>
                  {(meta?.team || []).map(t => <option key={t.user_id} value={t.user_id}>{t.name} · {t.role}</option>)}
                </select>
              </div>
            )}
            {isEdit && (
              <div className="sl-field" style={{ gridColumn: '1 / -1' }}>
                <label className="sl-label" htmlFor="sl-exc">No-next-action exception (optional)</label>
                <input id="sl-exc" className="sl-input" value={form.next_action_exception} onChange={set('next_action_exception')} placeholder="e.g. Customer travelling until 5 Dec" />
              </div>
            )}
            <div className="sl-field" style={{ gridColumn: '1 / -1' }}>
              <label className="sl-label" htmlFor="sl-req">Product requirement</label>
              <textarea id="sl-req" className="sl-textarea" value={form.product_requirement} onChange={set('product_requirement')} />
            </div>
          </div>
        </>
      )}
    </Modal>
  );
}
