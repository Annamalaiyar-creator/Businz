#!/usr/bin/env node
/**
 * BUSINZ ERP: Notification Authorization Security Verification Suite
 * Tests:
 * 1. 401 Unauthorized when no session provided for /api/store/notifications_store
 * 2. 401 Unauthorized when no session provided for /api/crm/leads/notifications
 * 3. 403 Forbidden when non-executive requests CEO notifications (/api/store/notifications_store?role=CEO)
 * 4. 200 OK with role-scoped records for authenticated Sales Executive (zero CEO leaks)
 * 5. 403 Forbidden when Sales Executive attempts cross-employee leak (/api/crm/leads/notifications?employeeCode=CEO-001)
 * 6. 200 OK for CEO session accessing all notifications
 * 7. 200 OK for CEO session viewing specific employee lead notifications
 * 8. 403 Forbidden when Tech Support attempts to access CEO notifications
 * 9. 401 Unauthorized when no session provided for POST /api/store/notifications_store
 */

import { resolveAndValidateTestApiUrl } from './testEnvironmentGuard.js';

// Resolve explicit test API URL (Fails closed if missing, or if targeting 5001/5002)
const BASE_URL = resolveAndValidateTestApiUrl();

async function registerSession(session) {
  const res = await fetch(`${BASE_URL}/api/sessions/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(session)
  });
  return res.json();
}

async function runSecurityAudit() {
  console.log('===================================================================');
  console.log('🔒 BUSINZ ERP: NOTIFICATION AUTHORIZATION SECURITY TEST SUITE');
  console.log('===================================================================\n');

  let passed = 0;
  let failed = 0;

  function record(desc, ok, details = '') {
    if (ok) {
      console.log(`✅ [PASS] ${desc}`);
      passed++;
    } else {
      console.error(`❌ [FAIL] ${desc} - ${details}`);
      failed++;
    }
  }

  // Set up test sessions
  const salesSessionId = `SES_TEST_SALES_${Date.now()}`;
  const ceoSessionId = `SES_TEST_CEO_${Date.now()}`;
  const techSupportSessionId = `SES_TEST_TECH_${Date.now()}`;

  await registerSession({
    id: salesSessionId,
    email: 'sales.exec@vrmstructures.in',
    empCode: 'SE-004',
    user: 'Sales Executive 4',
    role: 'Sales Executive',
    status: 'active'
  });

  await registerSession({
    id: ceoSessionId,
    email: 'ceo@vrmstructures.com',
    empCode: 'CEO-001',
    user: 'Velmurugan Rathinam',
    role: 'CEO',
    status: 'active'
  });

  await registerSession({
    id: techSupportSessionId,
    email: 'support@vrmstructures.in',
    empCode: 'TS-001',
    user: 'Technical Support Staff',
    role: 'Technical Support',
    status: 'active'
  });

  console.log('Test sessions registered in memory.\n');

  // Test 1: Unauthenticated request to /api/store/notifications_store -> 401
  try {
    const res = await fetch(`${BASE_URL}/api/store/notifications_store`);
    const json = await res.json();
    record('Test 1: Unauthenticated /api/store/notifications_store returns 401', res.status === 401 && json.success === false, `Status: ${res.status}`);
  } catch (e) {
    record('Test 1: Unauthenticated /api/store/notifications_store returns 401', false, e.message);
  }

  // Test 2: Unauthenticated request to /api/crm/leads/notifications -> 401
  try {
    const res = await fetch(`${BASE_URL}/api/crm/leads/notifications?employeeCode=SE-004`);
    const json = await res.json();
    record('Test 2: Unauthenticated /api/crm/leads/notifications returns 401', res.status === 401 && json.success === false, `Status: ${res.status}`);
  } catch (e) {
    record('Test 2: Unauthenticated /api/crm/leads/notifications returns 401', false, e.message);
  }

  // Test 3: Sales Executive queries ?role=CEO -> 403 Forbidden
  try {
    const res = await fetch(`${BASE_URL}/api/store/notifications_store?role=CEO`, {
      headers: { 'x-session-id': salesSessionId }
    });
    const json = await res.json();
    record('Test 3: Sales Executive attempting ?role=CEO returns 403 Forbidden', res.status === 403 && json.success === false, `Status: ${res.status}`);
  } catch (e) {
    record('Test 3: Sales Executive attempting ?role=CEO returns 403 Forbidden', false, e.message);
  }

  // Test 4: Sales Executive queries /api/store/notifications_store -> 200 OK strictly scoped (no CEO records)
  try {
    const res = await fetch(`${BASE_URL}/api/store/notifications_store?limit=50`, {
      headers: { 'x-session-id': salesSessionId }
    });
    const json = await res.json();
    const hasCeoOnlyNotifs = Array.isArray(json.data) && json.data.some(n => {
      const roles = Array.isArray(n.targetRoles) ? n.targetRoles : [n.role];
      return roles.length === 1 && String(roles[0]).toLowerCase() === 'ceo';
    });
    record('Test 4: Sales Executive notifications scoped properly with zero CEO-only records', res.status === 200 && json.success === true && !hasCeoOnlyNotifs, `Status: ${res.status}, Records: ${json.data?.length}`);
  } catch (e) {
    record('Test 4: Sales Executive notifications scoped properly', false, e.message);
  }

  // Test 5: Sales Executive attempts cross-employee leak /api/crm/leads/notifications?employeeCode=CEO-001 -> 403 Forbidden
  try {
    const res = await fetch(`${BASE_URL}/api/crm/leads/notifications?employeeCode=CEO-001`, {
      headers: {
        'x-session-id': salesSessionId,
        'x-user-emp-id': 'CEO-001'
      }
    });
    const json = await res.json();
    record('Test 5: Sales Executive cross-employee request for CEO-001 returns 403 Forbidden', res.status === 403 && json.success === false, `Status: ${res.status}`);
  } catch (e) {
    record('Test 5: Sales Executive cross-employee request returns 403 Forbidden', false, e.message);
  }

  // Test 6: CEO queries /api/store/notifications_store -> 200 OK full access
  try {
    const res = await fetch(`${BASE_URL}/api/store/notifications_store?limit=10`, {
      headers: { 'x-session-id': ceoSessionId }
    });
    const json = await res.json();
    record('Test 6: CEO session queries /api/store/notifications_store successfully (200 OK)', res.status === 200 && json.success === true, `Status: ${res.status}`);
  } catch (e) {
    record('Test 6: CEO session queries /api/store/notifications_store', false, e.message);
  }

  // Test 7: CEO queries lead notifications with specific employeeCode -> 200 OK (authorized executive privilege)
  try {
    const res = await fetch(`${BASE_URL}/api/crm/leads/notifications?employeeCode=SE-004`, {
      headers: { 'x-session-id': ceoSessionId }
    });
    const json = await res.json();
    record('Test 7: CEO session cross-inspection of employee lead notifications succeeds (200 OK)', res.status === 200 && json.success === true, `Status: ${res.status}`);
  } catch (e) {
    record('Test 7: CEO session cross-inspection succeeds', false, e.message);
  }

  // Test 8: Technical Support queries ?role=CEO -> 403 Forbidden
  try {
    const res = await fetch(`${BASE_URL}/api/store/notifications_store?role=CEO`, {
      headers: { 'x-session-id': techSupportSessionId }
    });
    const json = await res.json();
    record('Test 8: Tech Support attempting ?role=CEO returns 403 Forbidden', res.status === 403 && json.success === false, `Status: ${res.status}`);
  } catch (e) {
    record('Test 8: Tech Support attempting ?role=CEO returns 403 Forbidden', false, e.message);
  }

  // Test 9: Unauthenticated POST /api/store/notifications_store -> 401
  try {
    const res = await fetch(`${BASE_URL}/api/store/notifications_store`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify([{ id: 'FAKE-NOTIF', title: 'Unauthorized' }])
    });
    const json = await res.json();
    record('Test 9: Unauthenticated POST /api/store/notifications_store returns 401', res.status === 401 && json.success === false, `Status: ${res.status}`);
  } catch (e) {
    record('Test 9: Unauthenticated POST /api/store/notifications_store returns 401', false, e.message);
  }

  console.log('\n===================================================================');
  console.log(`Security Audit Complete: ${passed} Passed, ${failed} Failed`);
  console.log('===================================================================');

  if (failed > 0) {
    process.exit(1);
  }
}

runSecurityAudit().catch(err => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
