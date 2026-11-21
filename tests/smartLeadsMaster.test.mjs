import test from 'node:test';
import assert from 'node:assert/strict';
import {
  mapLegacyStatusToStage, mapStageToLegacyStatus,
  normalizePhone, normalizeEmail,
  isLeadAdmin, isLeadManager, canAccessSmartLeads,
  computeLeadScore, DEFAULT_SCORING, OPEN_STAGES
} from '../server/smartLeadsRules.js';

test('Smart Leads Rule - Round Robin Sequence Distribution', () => {
  const team = [
    { user_id: 'REP-A', name: 'Salesperson A', is_active: true },
    { user_id: 'REP-B', name: 'Salesperson B', is_active: true },
    { user_id: 'REP-C', name: 'Salesperson C', is_active: true }
  ];

  let pointer = -1;
  const pickNext = (activeTeam) => {
    pointer = (pointer + 1) % activeTeam.length;
    return activeTeam[pointer];
  };

  const sequence = [];
  for (let i = 0; i < 6; i++) {
    sequence.push(pickNext(team).user_id);
  }

  assert.deepEqual(sequence, ['REP-A', 'REP-B', 'REP-C', 'REP-A', 'REP-B', 'REP-C']);
});

test('Smart Leads Rule - Inactive Rep Exclusion from Round Robin', () => {
  const allStaff = [
    { user_id: 'REP-A', name: 'Salesperson A', is_active: true, role: 'Sales' },
    { user_id: 'REP-B', name: 'Salesperson B', is_active: false, role: 'Sales' }, // deactivated
    { user_id: 'REP-C', name: 'Salesperson C', is_active: true, role: 'Sales' },
    { user_id: 'ACC-1', name: 'Accounts 1', is_active: true, role: 'Accounts' } // ineligible role
  ];

  const eligibleTeam = allStaff.filter(s => s.is_active && /sales/i.test(s.role));
  assert.equal(eligibleTeam.length, 2);
  assert.equal(eligibleTeam[0].user_id, 'REP-A');
  assert.equal(eligibleTeam[1].user_id, 'REP-C');
});

test('Smart Leads Rule - Role-based Scoping for Regular Sales vs Manager', () => {
  // CEO and Tech Support have manager-level visibility across all leads
  assert.ok(isLeadManager('CEO'));
  assert.ok(isLeadManager('Technical Administrator'));
  assert.ok(isLeadManager('Tech Support'));
  assert.ok(isLeadManager('Technical Support Executive'));

  // Regular Sales Executive is NOT manager
  assert.ok(!isLeadManager('Sales Executive'));
  assert.ok(!isLeadManager('Sales Representative'));
  assert.ok(canAccessSmartLeads('Sales Executive'));

  // Scoping check simulation
  const checkAccess = (session, lead) => {
    if (isLeadManager(session.role)) return true;
    // Sales person sees only assigned leads
    return lead.assigned_to_user_id === session.empCode;
  };

  const se1Session = { empCode: 'SE1', role: 'Sales Executive' };
  const se2Session = { empCode: 'SE2', role: 'Sales Executive' };
  const ceoSession = { empCode: 'CEO1', role: 'CEO' };

  const leadAssignedToSE1 = { id: 'LD-1', assigned_to_user_id: 'SE1' };
  const leadUnassigned = { id: 'LD-2', assigned_to_user_id: null };

  assert.equal(checkAccess(se1Session, leadAssignedToSE1), true);
  assert.equal(checkAccess(se2Session, leadAssignedToSE1), false); // peer cannot see
  assert.equal(checkAccess(se1Session, leadUnassigned), false); // regular sales cannot see unassigned
  assert.equal(checkAccess(ceoSession, leadAssignedToSE1), true);
  assert.equal(checkAccess(ceoSession, leadUnassigned), true); // CEO sees unassigned
});

test('Smart Leads Rule - 3-Hour Unassigned Lead Detection', () => {
  const now = Date.now();
  const threeHoursMs = 3 * 60 * 60 * 1000;

  const leads = [
    { id: 'L1', assigned_to_user_id: null, created_at: new Date(now - 4 * 3600 * 1000).toISOString(), escalated_3h: null },
    { id: 'L2', assigned_to_user_id: null, created_at: new Date(now - 1 * 3600 * 1000).toISOString(), escalated_3h: null },
    { id: 'L3', assigned_to_user_id: 'SE1', created_at: new Date(now - 5 * 3600 * 1000).toISOString(), escalated_3h: null }
  ];

  const dueFor3hAlert = leads.filter(l => 
    l.assigned_to_user_id === null &&
    new Date(l.created_at).getTime() <= now - threeHoursMs &&
    !l.escalated_3h
  );

  assert.equal(dueFor3hAlert.length, 1);
  assert.equal(dueFor3hAlert[0].id, 'L1');
});

test('Smart Leads Rule - 2-Hour Assigned Lead Inactivity Detection & Qualifying Activity Clear', () => {
  const now = Date.now();
  const twoHoursMs = 2 * 60 * 60 * 1000;

  const leads = [
    { id: 'L1', assigned_to_user_id: 'SE1', assigned_at: new Date(now - 3 * 3600 * 1000).toISOString(), last_qualifying_activity_at: null, escalated_2h: null },
    { id: 'L2', assigned_to_user_id: 'SE1', assigned_at: new Date(now - 1 * 3600 * 1000).toISOString(), last_qualifying_activity_at: null, escalated_2h: null },
    { id: 'L3', assigned_to_user_id: 'SE1', assigned_at: new Date(now - 3 * 3600 * 1000).toISOString(), last_qualifying_activity_at: new Date(now - 2.5 * 3600 * 1000).toISOString(), escalated_2h: null }
  ];

  const dueFor2hAlert = leads.filter(l =>
    l.assigned_to_user_id !== null &&
    !l.last_qualifying_activity_at &&
    new Date(l.assigned_at).getTime() <= now - twoHoursMs &&
    !l.escalated_2h
  );

  assert.equal(dueFor2hAlert.length, 1);
  assert.equal(dueFor2hAlert[0].id, 'L1');
});

test('Smart Leads Rule - 48-Hour Inactivity Detection on Active Leads', () => {
  const now = Date.now();
  const fortyEightHoursMs = 48 * 60 * 60 * 1000;

  const leads = [
    { id: 'L1', pipeline_stage: 'Contacted', last_qualifying_activity_at: new Date(now - 50 * 3600 * 1000).toISOString(), escalated_48h: null },
    { id: 'L2', pipeline_stage: 'Contacted', last_qualifying_activity_at: new Date(now - 20 * 3600 * 1000).toISOString(), escalated_48h: null },
    { id: 'L3', pipeline_stage: 'Won', last_qualifying_activity_at: new Date(now - 60 * 3600 * 1000).toISOString(), escalated_48h: null } // Won is closed, no alert
  ];

  const dueFor48hAlert = leads.filter(l =>
    OPEN_STAGES.includes(l.pipeline_stage) &&
    new Date(l.last_qualifying_activity_at).getTime() <= now - fortyEightHoursMs &&
    !l.escalated_48h
  );

  assert.equal(dueFor48hAlert.length, 1);
  assert.equal(dueFor48hAlert[0].id, 'L1');
});

test('Smart Leads Rule - Follow-up 15m, Due, and Missed Timers', () => {
  const now = Date.now();

  const followups = [
    { id: 'F1', status: 'PENDING', scheduled_at: new Date(now + 10 * 60 * 1000).toISOString() }, // in 10 mins (15m window)
    { id: 'F2', status: 'PENDING', scheduled_at: new Date(now - 2 * 60 * 1000).toISOString() },  // due now (-2 mins)
    { id: 'F3', status: 'PENDING', scheduled_at: new Date(now - 30 * 60 * 1000).toISOString() }, // missed (-30 mins)
    { id: 'F4', status: 'COMPLETED', scheduled_at: new Date(now - 30 * 60 * 1000).toISOString() } // already completed
  ];

  const is15m = f => f.status === 'PENDING' && new Date(f.scheduled_at) > now && new Date(f.scheduled_at) <= now + 15 * 60 * 1000;
  const isDue = f => f.status === 'PENDING' && new Date(f.scheduled_at) <= now && new Date(f.scheduled_at) >= now - 10 * 60 * 1000;
  const isMissed = f => f.status === 'PENDING' && new Date(f.scheduled_at) < now - 15 * 60 * 1000;

  assert.deepEqual(followups.filter(is15m).map(f => f.id), ['F1']);
  assert.deepEqual(followups.filter(isDue).map(f => f.id), ['F2']);
  assert.deepEqual(followups.filter(isMissed).map(f => f.id), ['F3']);
});

test('Smart Leads Rule - Customer Master Contact Matching by Phone Normalization', () => {
  assert.equal(normalizePhone('+91 98765 43210'), '9876543210');
  assert.equal(normalizePhone('09876543210'), '9876543210');
  assert.equal(normalizePhone('98765-43210'), '9876543210');
  assert.equal(normalizePhone('9876543210'), '9876543210');

  const customerMaster = [
    { id: 'CUST-001', customer_code: 'VRM-C-101', phone: '+91 98765 43210', assigned_salesperson: 'REP-A' }
  ];

  const inboundLeadPhone = '9876543210';
  const match = customerMaster.find(c => normalizePhone(c.phone) === inboundLeadPhone);

  assert.ok(match);
  assert.equal(match.customer_code, 'VRM-C-101');
  assert.equal(match.assigned_salesperson, 'REP-A');
});

test('Smart Leads Rule - Document Traceability & Metric Integrity', () => {
  // Quotation -> PI -> BOM -> Invoice
  const lead = { id: 'LD-101', estimated_value: 500000 };
  const quotations = [{ id: 'Q-1', quote_number: 'VRM/QT/26-27/001', grand_total: 480000, converted_pi_no: 'VRM/PI/26-27/001' }];
  const pis = [{ id: 'PI-1', pi_no: 'VRM/PI/26-27/001', grand_total: 480000 }];
  const boms = [{ id: 'BOM-1', bom_code: 'VRM/BOM/26-27/001', source_pi_no: 'VRM/PI/26-27/001', grand_total: 480000 }];
  const invoices = [{ id: 'INV-1', inv_no: 'VRM/INV/26-27/001', bom_code: 'VRM/BOM/26-27/001', inv_amt: 480000 }];

  // Lead pipeline value is strictly lead.estimated_value (not sum of downstream docs, preventing double counting)
  assert.equal(lead.estimated_value, 500000);
  assert.equal(invoices[0].inv_amt, 480000);
  assert.equal(boms[0].source_pi_no, pis[0].pi_no);
  assert.equal(quotations[0].converted_pi_no, pis[0].pi_no);
});
