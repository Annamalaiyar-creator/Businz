// Integration tests: Smart Leads API against the LOCAL DEV database only.
// Creates rows prefixed "ZZTEST-SL-" and removes exactly those rows afterwards.
import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import { query, pool } from '../server/db.js';
import { ensureSmartLeadsSchema } from '../server/smartLeadsSchema.js';
import { createSmartLeadsRouter } from '../server/smartLeadsRouter.js';

if (process.env.APP_ENV !== 'development') {
  throw new Error('Refusing to run Smart Leads integration tests: APP_ENV is not "development".');
}

const PREFIX = 'ZZTEST-SL-';
const TEAM = [
  { user_id: 'ZZT-SE1', name: 'Test Exec One', role: 'Sales Executive' },
  { user_id: 'ZZT-SE2', name: 'Test Exec Two', role: 'Sales Executive' }
];
const USERS = {
  ceo: { empCode: 'ZZT-CEO', user: 'Test CEO', role: 'CEO' },
  head: { empCode: 'ZZT-SH', user: 'Test Head', role: 'Sales Head' },
  se1: { empCode: 'ZZT-SE1', user: 'Test Exec One', role: 'Sales Executive' },
  se2: { empCode: 'ZZT-SE2', user: 'Test Exec Two', role: 'Sales Executive' },
  dispatch: { empCode: 'ZZT-DSP', user: 'Test Dispatch', role: 'Dispatch' }
};
const events = [];
const notifications = [];
let server; let base;

function api(user, method, path, body) {
  const headers = { 'content-type': 'application/json' };
  if (user) headers['x-test-user'] = user;
  return fetch(`${base}${path}`, { method, headers, body: body ? JSON.stringify(body) : undefined })
    .then(async r => ({ status: r.status, body: await r.json() }));
}

before(async () => {
  await ensureSmartLeadsSchema();
  const app = express();
  app.use('/api/smart-leads', createSmartLeadsRouter({
    requireSession: (req, res, next) => {
      const u = USERS[req.headers['x-test-user']];
      if (!u) return res.status(401).json({ success: false, error: 'no session' });
      req.userSession = { valid: true, ...u };
      next();
    },
    broadcast: (type, payload) => events.push({ type, payload }),
    notify: async (p) => { notifications.push(p); },
    getTeam: async () => TEAM
  }));
  await new Promise(r => { server = app.listen(0, '127.0.0.1', r); });
  base = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
  const ids = (await query(`SELECT id FROM public.leads WHERE company_name LIKE $1`, [`${PREFIX}%`])).rows.map(r => r.id);
  if (ids.length) {
    for (const t of ['lead_activities', 'lead_status_history', 'lead_assignment_history', 'lead_followups', 'lead_notes', 'lead_field_audit']) {
      await query(`DELETE FROM public.${t} WHERE lead_id = ANY($1::text[])`, [ids]);
    }
    await query(`DELETE FROM public.leads WHERE id = ANY($1::text[])`, [ids]);
  }
  await query(`DELETE FROM public.lead_lost_reasons WHERE label LIKE $1`, [`${PREFIX}%`]);
  server?.close();
  await pool.end();
});

let leadA; let leadB;

test('no session → 401, non-sales role → 403', async () => {
  assert.equal((await api(null, 'GET', '/api/smart-leads/leads')).status, 401);
  assert.equal((await api('dispatch', 'GET', '/api/smart-leads/leads')).status, 403);
});

test('manager creates lead assigned to SE1 (1 row, history, notification, realtime event)', async () => {
  const r = await api('head', 'POST', '/api/smart-leads/leads', {
    company_name: `${PREFIX}Alpha Solar`, contact_person: 'Ravi', phone: '+91 90000 11111', source: 'Referral',
    estimated_value: 500000, assigned_to_user_id: 'ZZT-SE1'
  });
  assert.equal(r.status, 201, JSON.stringify(r.body));
  leadA = r.body.lead;
  assert.equal(leadA.pipeline_stage, 'New');
  assert.equal(leadA.status, 'Assigned');
  assert.equal(leadA.assigned_to_user_id, 'ZZT-SE1');
  assert.match(leadA.lead_number, /^VRM-LD-\d{4}-\d+$/);
  assert.ok(typeof leadA.score === 'number');
  assert.ok(notifications.some(n => n.recipientEmpCode === 'ZZT-SE1' && n.documentId === leadA.id));
  assert.ok(events.some(e => e.type === 'smart_lead_changed' && e.payload.action === 'create' && e.payload.leadId === leadA.id && !('lead' in e.payload)));
  const sum = await api('se1', 'GET', `/api/smart-leads/leads/${leadA.id}/summary`);
  assert.equal(sum.status, 200);
  assert.equal((await api('se2', 'GET', `/api/smart-leads/leads/${leadA.id}/summary`)).status, 404);
});

test('validation: missing company / contact rejected', async () => {
  assert.equal((await api('ceo', 'POST', '/api/smart-leads/leads', { phone: '9000011111' })).status, 400);
  assert.equal((await api('ceo', 'POST', '/api/smart-leads/leads', { company_name: `${PREFIX}X` })).status, 400);
});

test('duplicate detection by phone returns 409; force creates', async () => {
  const dup = await api('ceo', 'POST', '/api/smart-leads/leads', { company_name: `${PREFIX}Alpha Copy`, phone: '9000011111' });
  assert.equal(dup.status, 409);
  assert.ok(dup.body.duplicates.some(d => d.id === leadA.id && d.match_on === 'phone'));
  const forced = await api('ceo', 'POST', '/api/smart-leads/leads', { company_name: `${PREFIX}Alpha Copy`, phone: '9000011111', email: 'copy@zztest.in', force: true });
  assert.equal(forced.status, 201);
  leadB = forced.body.lead;
});

test('sales exec scope: SE2 cannot see or edit SE1 lead; SE1 can', async () => {
  const list2 = await api('se2', 'GET', `/api/smart-leads/leads?search=${encodeURIComponent(PREFIX)}`);
  assert.equal(list2.status, 200);
  assert.ok(!list2.body.data.some(l => l.id === leadA.id));
  assert.equal((await api('se2', 'GET', `/api/smart-leads/leads/${leadA.id}`)).status, 404);
  assert.equal((await api('se2', 'PATCH', `/api/smart-leads/leads/${leadA.id}`, { location: 'Hack' })).status, 403);
  const list1 = await api('se1', 'GET', `/api/smart-leads/leads?search=${encodeURIComponent(PREFIX)}`);
  assert.ok(list1.body.data.some(l => l.id === leadA.id));
  assert.equal((await api('se1', 'POST', `/api/smart-leads/leads/${leadA.id}/assign`, { userId: 'ZZT-SE2' })).status, 403);
});

test('list is paginated and returns summary columns only', async () => {
  const r = await api('ceo', 'GET', `/api/smart-leads/leads?search=${encodeURIComponent(PREFIX)}&pageSize=5&page=1`);
  assert.equal(r.status, 200);
  assert.equal(r.body.pageSize, 5);
  assert.ok(r.body.total >= 2);
  assert.ok(!('requirement_images' in r.body.data[0]));
  assert.ok(!('external_payload' in r.body.data[0]));
});

test('edit writes field audit; stale expected_updated_at → 409', async () => {
  const r = await api('se1', 'PATCH', `/api/smart-leads/leads/${leadA.id}`, { location: 'Coimbatore', estimated_kw: 120 });
  assert.equal(r.status, 200);
  assert.equal(r.body.lead.location, 'Coimbatore');
  const audit = await query(`SELECT field FROM public.lead_field_audit WHERE lead_id = $1`, [leadA.id]);
  assert.ok(audit.rows.some(a => a.field === 'location') && audit.rows.some(a => a.field === 'estimated_kw'));
  const stale = await api('se1', 'PATCH', `/api/smart-leads/leads/${leadA.id}`, { location: 'X', expected_updated_at: '2000-01-01T00:00:00Z' });
  assert.equal(stale.status, 409);
});

test('activity auto-moves New → Contacted; stage rules enforced', async () => {
  const act = await api('se1', 'POST', `/api/smart-leads/leads/${leadA.id}/activities`, { type: 'CALL', summary: 'Intro call done' });
  assert.equal(act.status, 201);
  assert.equal(act.body.lead.pipeline_stage, 'Contacted');
  assert.equal((await api('se1', 'POST', `/api/smart-leads/leads/${leadA.id}/stage`, { stage: 'Lost' })).status, 400);
  const q = await api('se1', 'POST', `/api/smart-leads/leads/${leadA.id}/stage`, { stage: 'Quotation Sent' });
  assert.equal(q.status, 200);
  assert.equal(q.body.lead.status, 'Proposal Sent');
  const won = await api('se1', 'POST', `/api/smart-leads/leads/${leadA.id}/stage`, { stage: 'Won' });
  assert.equal(won.body.lead.pipeline_stage, 'Won');
  assert.equal((await api('se1', 'POST', `/api/smart-leads/leads/${leadA.id}/stage`, { stage: 'Negotiation' })).status, 400);
  assert.equal((await api('head', 'POST', `/api/smart-leads/leads/${leadA.id}/stage`, { stage: 'Negotiation', remarks: 'Reopened' })).status, 200);
  const hist = await query(`SELECT new_status FROM public.lead_status_history WHERE lead_id = $1`, [leadA.id]);
  assert.ok(['New', 'Contacted', 'Quotation Sent', 'Won', 'Negotiation'].every(s => hist.rows.some(h => h.new_status === s)));
});

test('lost with configured reason; admin-only reason management', async () => {
  assert.equal((await api('head', 'POST', '/api/smart-leads/lost-reasons', { label: `${PREFIX}reason` })).status, 403);
  const rr = await api('ceo', 'POST', '/api/smart-leads/lost-reasons', { label: `${PREFIX}reason` });
  assert.equal(rr.status, 200);
  const lost = await api('ceo', 'POST', `/api/smart-leads/leads/${leadB.id}/stage`, { stage: 'Lost', lostReasonId: rr.body.reason.id, remarks: 'test' });
  assert.equal(lost.status, 200);
  assert.equal(lost.body.lead.lost_reason_id, rr.body.reason.id);
  assert.equal(lost.body.lead.status, 'Dropped');
});

test('reassignment: manager reassigns, history + owner audit recorded', async () => {
  const r = await api('head', 'POST', `/api/smart-leads/leads/${leadA.id}/assign`, { userId: 'ZZT-SE2', reason: 'Territory' });
  assert.equal(r.status, 200);
  assert.equal(r.body.lead.assigned_to_user_id, 'ZZT-SE2');
  const h = await query(`SELECT assignment_type FROM public.lead_assignment_history WHERE lead_id = $1 ORDER BY created_at DESC LIMIT 1`, [leadA.id]);
  assert.equal(h.rows[0].assignment_type, 'REASSIGNMENT');
  assert.equal((await api('head', 'POST', `/api/smart-leads/leads/${leadA.id}/assign`, { userId: 'NOT-A-USER' })).status, 400);
});

test('notes + detail (Customer 360) payload', async () => {
  assert.equal((await api('ceo', 'POST', `/api/smart-leads/leads/${leadA.id}/notes`, { body: 'Customer wants HDG structure' })).status, 201);
  const d = await api('ceo', 'GET', `/api/smart-leads/leads/${leadA.id}`);
  assert.equal(d.status, 200);
  for (const k of ['lead', 'notes', 'activities', 'statusHistory', 'assignmentHistory', 'audit', 'followups', 'quotations', 'customerMaster', 'relatedLeads']) {
    assert.ok(k in d.body, `missing key ${k}`);
  }
  assert.ok(d.body.notes.length >= 1);
  assert.ok(Array.isArray(d.body.lead.score_breakdown));
  assert.ok(Array.isArray(d.body.relatedLeads));
});

test('concurrent creates get unique lead numbers', async () => {
  const rs = await Promise.all([1, 2, 3, 4].map(i => api('ceo', 'POST', '/api/smart-leads/leads', {
    company_name: `${PREFIX}Concurrent ${i}`, email: `c${i}@zztest.in`, force: true
  })));
  rs.forEach(r => assert.equal(r.status, 201));
  const nums = rs.map(r => r.body.lead.lead_number);
  assert.equal(new Set(nums).size, 4);
});

test('merge moves history into target and soft-deletes source; bulk + delete permissions', async () => {
  assert.equal((await api('se1', 'POST', `/api/smart-leads/leads/${leadB.id}/merge`, { targetId: leadA.id })).status, 403);
  const m = await api('ceo', 'POST', `/api/smart-leads/leads/${leadB.id}/merge`, { targetId: leadA.id });
  assert.equal(m.status, 200);
  const src = await query(`SELECT deleted_at, merged_into_lead_id FROM public.leads WHERE id = $1`, [leadB.id]);
  assert.ok(src.rows[0].deleted_at);
  assert.equal(src.rows[0].merged_into_lead_id, leadA.id);
  assert.equal(m.body.lead.email, 'copy@zztest.in'); // filled from source
  const moved = await query(`SELECT COUNT(*)::int n FROM public.lead_status_history WHERE lead_id = $1`, [leadB.id]);
  assert.equal(moved.rows[0].n, 0);
  assert.equal((await api('head', 'DELETE', `/api/smart-leads/leads/${leadA.id}`)).status, 403);
  const bulk = await api('head', 'POST', '/api/smart-leads/leads/bulk', { ids: [leadA.id], action: 'assign', userId: 'ZZT-SE1' });
  assert.equal(bulk.status, 200);
  assert.equal((await api('head', 'POST', '/api/smart-leads/leads/bulk', { ids: [leadA.id], action: 'delete' })).status, 403);
});

test('pipeline returns all 7 stages with weighted values', async () => {
  const p = await api('ceo', 'GET', '/api/smart-leads/pipeline?perStage=5');
  assert.equal(p.status, 200);
  assert.deepEqual(p.body.columns.map(c => c.stage), ['New', 'Contacted', 'Qualified', 'Quotation Sent', 'Negotiation', 'Won', 'Lost']);
  p.body.columns.forEach(c => assert.ok(c.cards.length <= 5));
});
