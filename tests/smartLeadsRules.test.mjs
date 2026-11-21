// Unit tests: Smart Leads business rules.  Run: npm run test:smart-leads
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  mapLegacyStatusToStage, mapStageToLegacyStatus, validateStageTransition, normalizePhone,
  computeLeadScore, canonicalSource, isLeadManager, isLeadAdmin, canAccessSmartLeads
} from '../server/smartLeadsRules.js';

test('legacy status maps to new pipeline stages without loss', () => {
  assert.equal(mapLegacyStatusToStage('Assigned'), 'New');
  assert.equal(mapLegacyStatusToStage('In Progress'), 'Contacted');
  assert.equal(mapLegacyStatusToStage('Opportunity'), 'Qualified');
  assert.equal(mapLegacyStatusToStage('Proposal Sent'), 'Quotation Sent');
  assert.equal(mapLegacyStatusToStage('Negotiating'), 'Negotiation');
  assert.equal(mapLegacyStatusToStage('Converted'), 'Won');
  assert.equal(mapLegacyStatusToStage('Dropped'), 'Lost');
  assert.equal(mapLegacyStatusToStage(''), 'New');
});

test('stage maps back to a legacy status the old CRM understands', () => {
  assert.equal(mapStageToLegacyStatus('New', true), 'Assigned');
  assert.equal(mapStageToLegacyStatus('Won'), 'Converted');
  assert.equal(mapStageToLegacyStatus('Lost'), 'Dropped');
  assert.equal(mapStageToLegacyStatus('Quotation Sent'), 'Proposal Sent');
  assert.equal(mapStageToLegacyStatus('Negotiation'), 'Proposal Sent'); // old screens have no "Negotiating"
});

test('stage transitions: lost needs reason, reopen needs manager, and minimum 50 words remarks', () => {
  const sample50Words = "The customer requested an in-depth revision of the commercial quotation and technical specification for the project. We conducted a comprehensive discovery call to understand their electrical capacity and delivery timelines. They confirmed satisfaction with our standard terms and indicated willingness to proceed to the next milestone once formal approval is granted.";
  const shortRemarks = "Customer agreed to move forward.";

  // Missing lost reason
  assert.equal(validateStageTransition({ from: 'New', to: 'Lost', isManager: false, remarks: sample50Words }).ok, false);
  // Valid Lost with reason and 50 words
  assert.equal(validateStageTransition({ from: 'New', to: 'Lost', lostReasonId: 'LR-01', isManager: false, remarks: sample50Words }).ok, true);

  // Less than 50 words remarks fails
  assert.equal(validateStageTransition({ from: 'Contacted', to: 'Negotiation', isManager: false, remarks: shortRemarks }).ok, false);
  // 50+ words remarks succeeds
  assert.equal(validateStageTransition({ from: 'Contacted', to: 'Negotiation', isManager: false, remarks: sample50Words }).ok, true);

  // Backward transition: sales cannot move back even with 50 words
  assert.equal(validateStageTransition({ from: 'Negotiation', to: 'Contacted', isManager: false, remarks: sample50Words }).ok, false);
  // Backward transition: manager without 50 words fails
  assert.equal(validateStageTransition({ from: 'Negotiation', to: 'Contacted', isManager: true, remarks: 'Wrong stage' }).ok, false);
  // Backward transition: manager with 50 words succeeds
  assert.equal(validateStageTransition({ from: 'Negotiation', to: 'Contacted', isManager: true, remarks: sample50Words }).ok, true);

  // Reopen closed lead: sales cannot reopen
  assert.equal(validateStageTransition({ from: 'Won', to: 'Negotiation', isManager: false, remarks: sample50Words }).ok, false);
  // Reopen closed lead: manager without 50 words fails
  assert.equal(validateStageTransition({ from: 'Won', to: 'Negotiation', isManager: true, remarks: 'Order revised' }).ok, false);
  // Reopen closed lead: manager with 50 words succeeds
  assert.equal(validateStageTransition({ from: 'Won', to: 'Negotiation', isManager: true, remarks: sample50Words }).ok, true);

  // Invalid stage and same stage
  assert.equal(validateStageTransition({ from: 'New', to: 'Bogus', isManager: true, remarks: sample50Words }).ok, false);
  assert.equal(validateStageTransition({ from: 'New', to: 'New', isManager: true, remarks: sample50Words }).ok, false);
});

test('phone normalisation keeps last 10 digits', () => {
  assert.equal(normalizePhone('+91 98765-43210'), '9876543210');
  assert.equal(normalizePhone('12345'), '');
});

test('scoring is explainable and bounded', () => {
  const now = Date.parse('2026-11-20T00:00:00Z');
  const hot = computeLeadScore({
    source: 'Referral', estimated_value: 2000000, estimated_kw: 150, phone: '9876543210', email: 'a@b.com',
    pipeline_stage: 'Negotiation', last_activity_at: '2026-11-19T00:00:00Z'
  }, undefined, now);
  assert.equal(hot.temperature, 'Hot');
  assert.ok(hot.score <= 100);
  assert.ok(hot.breakdown.every(b => typeof b.label === 'string' && typeof b.points === 'number'));
  const cold = computeLeadScore({ source: 'Direct', pipeline_stage: 'New', last_activity_at: '2026-10-01T00:00:00Z' }, undefined, now);
  assert.equal(cold.temperature, 'Cold');
  assert.ok(cold.score >= 0);
});

test('source canonicalisation', () => {
  assert.equal(canonicalSource('IndiaMART Inbound'), 'IndiaMART');
  assert.equal(canonicalSource('WhatsApp Inbound'), 'WhatsApp');
  assert.equal(canonicalSource('Direct Inbound'), 'Manual');
});

test('roles', () => {
  assert.equal(isLeadAdmin('CEO'), true);
  assert.equal(isLeadAdmin('Sales Head'), false);
  assert.equal(isLeadManager('Sales Head'), false); // no Sales Head role in BUSINZ
  assert.equal(isLeadManager('Technical Administrator'), true);
  assert.equal(isLeadManager('Tech Support'), true);
  assert.equal(isLeadManager('Sales Executive'), false);
  assert.equal(canAccessSmartLeads('Sales Executive'), true);
  assert.equal(canAccessSmartLeads('Dispatch'), false);
  assert.equal(canAccessSmartLeads(''), false);
});
