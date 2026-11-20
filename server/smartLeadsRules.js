// BUSINZ Smart Leads — pure business rules (no DB access). Unit-tested in tests/smartLeadsRules.test.mjs

export const PIPELINE_STAGES = ['New', 'Contacted', 'Qualified', 'Quotation Sent', 'Negotiation', 'Won', 'Lost'];
export const OPEN_STAGES = ['New', 'Contacted', 'Qualified', 'Quotation Sent', 'Negotiation'];
export const CLOSED_STAGES = ['Won', 'Lost'];

// Legacy `leads.status` → new `pipeline_stage` (non-destructive mapping; legacy status is kept)
const LEGACY_STATUS_TO_STAGE = {
  'new': 'New',
  'assigned': 'New',
  'contacted': 'Contacted',
  'in progress': 'Contacted',
  'process': 'Contacted',
  'qualified': 'Qualified',
  'opportunity': 'Qualified',
  'proposal sent': 'Quotation Sent',
  'quotation sent': 'Quotation Sent',
  'negotiating': 'Negotiation',
  'negotiation': 'Negotiation',
  'converted': 'Won',
  'won': 'Won',
  'customer': 'Won',
  'dropped': 'Lost',
  'rejected': 'Lost',
  'lost': 'Lost',
  'disqualified': 'Lost'
};

// New stage → legacy status, so the existing CRM screens stay consistent with Smart Leads changes
const STAGE_TO_LEGACY_STATUS = {
  'New': 'New',
  'Contacted': 'Contacted',
  'Qualified': 'Opportunity',
  'Quotation Sent': 'Proposal Sent',
  'Negotiation': 'Negotiating',
  'Won': 'Converted',
  'Lost': 'Dropped'
};

export function mapLegacyStatusToStage(status) {
  return LEGACY_STATUS_TO_STAGE[String(status || '').toLowerCase().trim()] || 'New';
}

export function mapStageToLegacyStatus(stage, isAssigned = false) {
  if (stage === 'New' && isAssigned) return 'Assigned';
  return STAGE_TO_LEGACY_STATUS[stage] || 'New';
}

export function isValidStage(stage) {
  return PIPELINE_STAGES.includes(stage);
}

/**
 * Validate a stage transition. Open stages can move freely (forward or back).
 * Leaving a closed stage (reopen) requires a manager. Lost requires a reason.
 */
export function validateStageTransition({ from, to, lostReasonId, isManager }) {
  if (!isValidStage(to)) return { ok: false, error: `Invalid stage "${to}"` };
  if (from === to) return { ok: false, error: 'Lead is already in this stage' };
  if (CLOSED_STAGES.includes(from) && !isManager) {
    return { ok: false, error: 'Only a sales manager can reopen a Won/Lost lead' };
  }
  if (to === 'Lost' && !lostReasonId) return { ok: false, error: 'A lost reason is required' };
  return { ok: true };
}

export function normalizePhone(phone) {
  const digits = String(phone || '').replace(/\D/g, '');
  return digits.length >= 10 ? digits.slice(-10) : '';
}

export function normalizeEmail(email) {
  return String(email || '').trim().toLowerCase();
}

// ---------- Roles (server-side permission source of truth for Smart Leads) ----------
const norm = (r) => String(r || '').toLowerCase().trim();
const EXEC = ['ceo', 'md', 'managing director', 'technical administrator', 'admin', 'super admin'];

export function isLeadAdmin(role) {
  const r = norm(role);
  return EXEC.some(k => r.includes(k));
}

export function isLeadManager(role) {
  const r = norm(role);
  return isLeadAdmin(r) || r.includes('sales head') || r.includes('tech support') || r.includes('technical support');
}

export function canAccessSmartLeads(role) {
  const r = norm(role);
  return isLeadManager(r) || r.includes('sales');
}

// ---------- Explainable rule-based scoring ----------
export const DEFAULT_SCORING = {
  sourcePoints: { 'Referral': 20, 'Website': 15, 'IndiaMART': 10, 'WhatsApp': 10, 'Meta Lead Ads': 10, 'Manual': 5 },
  valueBands: [{ min: 1000000, points: 25 }, { min: 300000, points: 15 }, { min: 100000, points: 8 }],
  kwBands: [{ min: 100, points: 15 }, { min: 25, points: 8 }],
  hasPhone: 5,
  hasEmail: 5,
  stagePoints: { 'Qualified': 10, 'Quotation Sent': 20, 'Negotiation': 30 },
  recentActivityDays: 3,
  recentActivityPoints: 15,
  staleDays: 14,
  stalePenalty: -15,
  hotMin: 70,
  warmMin: 40
};

export function canonicalSource(source) {
  const s = norm(source);
  if (s.includes('indiamart')) return 'IndiaMART';
  if (s.includes('whatsapp')) return 'WhatsApp';
  if (s.includes('website') || s.includes('web form')) return 'Website';
  if (s.includes('meta') || s.includes('facebook')) return 'Meta Lead Ads';
  if (s.includes('referral')) return 'Referral';
  return 'Manual';
}

export function computeLeadScore(lead, rules = DEFAULT_SCORING, now = Date.now()) {
  const breakdown = [];
  const add = (label, points) => { if (points) breakdown.push({ label, points }); };

  const src = canonicalSource(lead.source);
  add(`Source: ${src}`, rules.sourcePoints?.[src] || 0);

  const value = Number(lead.estimated_value) || 0;
  const vb = (rules.valueBands || []).find(b => value >= b.min);
  if (vb) add(`Estimated value ≥ ₹${vb.min.toLocaleString('en-IN')}`, vb.points);

  const kw = Number(lead.estimated_kw) || 0;
  const kb = (rules.kwBands || []).find(b => kw >= b.min);
  if (kb) add(`Capacity ≥ ${kb.min} kW`, kb.points);

  if (normalizePhone(lead.phone || lead.whatsapp)) add('Phone available', rules.hasPhone);
  if (normalizeEmail(lead.email)) add('Email available', rules.hasEmail);

  add(`Stage: ${lead.pipeline_stage}`, rules.stagePoints?.[lead.pipeline_stage] || 0);

  const last = lead.last_activity_at ? new Date(lead.last_activity_at).getTime() : null;
  if (last) {
    const days = (now - last) / 86400000;
    if (days <= rules.recentActivityDays) add(`Activity in last ${rules.recentActivityDays} days`, rules.recentActivityPoints);
    else if (days >= rules.staleDays) add(`No activity for ${rules.staleDays}+ days`, rules.stalePenalty);
  }

  const raw = breakdown.reduce((s, b) => s + b.points, 0);
  const score = Math.max(0, Math.min(100, raw));
  const temperature = score >= rules.hotMin ? 'Hot' : score >= rules.warmMin ? 'Warm' : 'Cold';
  return { score, temperature, breakdown };
}

export const DEFAULT_STAGE_PROBABILITIES = {
  'New': 5, 'Contacted': 10, 'Qualified': 25, 'Quotation Sent': 50, 'Negotiation': 75, 'Won': 100, 'Lost': 0
};

export const DEFAULT_SLA = {
  firstResponseHours: 2,
  followupEscalateAfterHours: 24,
  inactivityDays: 7
};

export const DEFAULT_LOST_REASONS = [
  'Price too high', 'Chose competitor', 'No budget', 'No response from customer',
  'Requirement cancelled', 'Out of service area', 'Duplicate / invalid enquiry', 'Legacy – not recorded'
];
