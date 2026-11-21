// BUSINZ Smart Leads — API client. The global fetch interceptor (src/main.jsx) attaches x-session-id.
export const SMART_LEADS_ENABLED = import.meta.env.VITE_ENABLE_SMART_LEADS !== 'false';

async function request(method, path, body) {
  const res = await fetch(`/api/smart-leads${path}`, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined
  });
  let data = {};
  try { data = await res.json(); } catch (_) { /* non-JSON */ }
  if (!res.ok || data.success === false) {
    const err = new Error(data.error || `Request failed (${res.status})`);
    err.status = res.status;
    err.data = data;
    throw err;
  }
  return data;
}

const qs = (params) => {
  const s = new URLSearchParams();
  Object.entries(params || {}).forEach(([k, v]) => { if (v !== undefined && v !== null && v !== '') s.set(k, v); });
  const str = s.toString();
  return str ? `?${str}` : '';
};

export const slApi = {
  meta: () => request('GET', '/meta'),
  listLeads: (params) => request('GET', `/leads${qs(params)}`),
  pipeline: (params) => request('GET', `/pipeline${qs(params)}`),
  getLead: (id) => request('GET', `/leads/${encodeURIComponent(id)}`),
  leadSummary: (id) => request('GET', `/leads/${encodeURIComponent(id)}/summary`),
  createLead: (body) => request('POST', '/leads', body),
  updateLead: (id, body) => request('PATCH', `/leads/${encodeURIComponent(id)}`, body),
  changeStage: (id, body) => request('POST', `/leads/${encodeURIComponent(id)}/stage`, body),
  assign: (id, body) => request('POST', `/leads/${encodeURIComponent(id)}/assign`, body),
  bulk: (body) => request('POST', '/leads/bulk', body),
  remove: (id) => request('DELETE', `/leads/${encodeURIComponent(id)}`),
  merge: (id, targetId) => request('POST', `/leads/${encodeURIComponent(id)}/merge`, { targetId }),
  addNote: (id, body) => request('POST', `/leads/${encodeURIComponent(id)}/notes`, { body }),
  addActivity: (id, body) => request('POST', `/leads/${encodeURIComponent(id)}/activities`, body),
  checkDuplicates: (body) => request('POST', '/duplicates/check', body),
  saveSetting: (key, value) => request('PUT', `/settings/${key}`, { value }),
  addLostReason: (label) => request('POST', '/lost-reasons', { label }),
  toggleLostReason: (id, is_active) => request('PATCH', `/lost-reasons/${encodeURIComponent(id)}`, { is_active }),
  listFollowups: (params) => request('GET', `/followups${qs(params)}`),
  scheduleFollowup: (id, body) => request('POST', `/leads/${encodeURIComponent(id)}/followups`, body),
  completeFollowup: (id, body) => request('POST', `/followups/${encodeURIComponent(id)}/complete`, body),
  rescheduleFollowup: (id, body) => request('POST', `/followups/${encodeURIComponent(id)}/reschedule`, body),
  overview: (params) => request('GET', `/overview${qs(params)}`),
  team: () => request('GET', '/team'),
  reassignTeam: (body) => request('POST', '/team/reassign', body),
  reports: (params) => request('GET', `/reports${qs(params)}`),
  automation: () => request('GET', '/automation'),
  saveAutomation: (body) => request('PUT', '/automation', body),
  testWebhook: (body) => request('POST', '/automation/test-webhook', body)
};

// Realtime: subscribe to single-row Smart Leads changes broadcast over the existing SSE channel.
export function onSmartLeadChange(handler) {
  const listener = (e) => {
    const d = e.detail || {};
    if (d.type === 'smart_lead_changed') handler(d.payload || {});
  };
  window.addEventListener('controlroom_realtime_event', listener);
  return () => window.removeEventListener('controlroom_realtime_event', listener);
}

export const formatINR = (n) => {
  const v = Number(n) || 0;
  if (v >= 10000000) return `₹${(v / 10000000).toFixed(2)} Cr`;
  if (v >= 100000) return `₹${(v / 100000).toFixed(2)} L`;
  return `₹${v.toLocaleString('en-IN')}`;
};

export const formatDate = (d, withTime = false) => {
  if (!d) return '—';
  const dt = new Date(d);
  if (Number.isNaN(dt.getTime())) return '—';
  return dt.toLocaleString('en-IN', withTime
    ? { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }
    : { day: '2-digit', month: 'short', year: 'numeric' });
};

export const isOverdue = (d) => d && new Date(d).getTime() < Date.now();
