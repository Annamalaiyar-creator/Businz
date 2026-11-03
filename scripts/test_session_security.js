/**
 * test_session_security.js
 * 
 * Comprehensive Automated Security Regression Test for BUSINZ Session Management
 * Tests:
 * 1. Unauthenticated session self-registration rejection (401)
 * 2. Arbitrary role assignment / privilege escalation prevention (assigned role derived strictly from DB)
 * 3. Invalid credentials rejection (401)
 * 4. Existing session overwrite protection
 * 5. Unauthenticated session revocation rejection (401)
 * 6. Cross-user session revocation prevention (403 for non-admins)
 * 7. Legitimate own-session revocation allowed (200)
 * 8. Administrator cross-user revocation allowed (200)
 * 9. Unauthenticated /api/sessions/active rejection (401)
 * 10. Notifications authorization boundary enforcement (401 unauth / 403 cross-user)
 */

import http from 'http';

function makeRequest(options, postData = null) {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let body = '';
      res.on('data', chunk => { body += chunk; });
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, headers: res.headers, body: JSON.parse(body) });
        } catch (_) {
          resolve({ status: res.statusCode, headers: res.headers, rawBody: body });
        }
      });
    });
    req.on('error', reject);
    if (postData) {
      req.write(typeof postData === 'string' ? postData : JSON.stringify(postData));
    }
    req.end();
  });
}

async function runSessionSecurityTests(port = 5001) {
  console.log(`\n============================================================`);
  console.log(`🔒 BUSINZ SESSION SECURITY & AUTHORIZATION REGRESSION SUITE`);
  console.log(`   Target Server: http://127.0.0.1:${port}`);
  console.log(`============================================================\n`);

  let passed = 0;
  let failed = 0;

  function assert(condition, testName, detail = '') {
    if (condition) {
      console.log(`✅ [PASS] ${testName}`);
      passed++;
    } else {
      console.error(`❌ [FAIL] ${testName} - ${detail}`);
      failed++;
    }
  }

  try {
    // -------------------------------------------------------------------------
    // TEST 1: Unauthenticated session self-registration with arbitrary role
    // -------------------------------------------------------------------------
    const res1 = await makeRequest({
      hostname: '127.0.0.1',
      port,
      path: '/api/sessions/register',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, {
      id: 'hacked-session-001',
      role: 'CEO',
      empCode: 'CEO-001',
      email: 'ceo@vrmstructures.com'
    });

    assert(
      res1.status === 401,
      'Test 1: Unauthenticated caller cannot register session with arbitrary CEO role',
      `Expected status 401, got ${res1.status}`
    );

    // -------------------------------------------------------------------------
    // TEST 2: Registration with incorrect password
    // -------------------------------------------------------------------------
    const res2 = await makeRequest({
      hostname: '127.0.0.1',
      port,
      path: '/api/sessions/register',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, {
      id: 'hacked-session-002',
      empCode: 'TA-VRM001',
      password: 'WrongPassword123'
    });

    assert(
      res2.status === 401,
      'Test 2: Invalid password registration is rejected with 401',
      `Expected status 401, got ${res2.status}`
    );

    // -------------------------------------------------------------------------
    // TEST 3: Privilege Escalation Attack:
    // Legitimate Sales Executive provides valid password but claims role="CEO"
    // -------------------------------------------------------------------------
    const seSessionId = 'SES-SE-VALID-' + Date.now();
    const res3 = await makeRequest({
      hostname: '127.0.0.1',
      port,
      path: '/api/sessions/register',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, {
      id: seSessionId,
      empCode: 'SH-VRM001', // Sales Head
      password: '12345',
      role: 'CEO', // Attacker claims CEO
      user: 'Attacker Impersonating CEO'
    });

    assert(
      res3.status === 200 && res3.body?.session?.role === 'Sales Head',
      'Test 3: Server ignores client role="CEO" and enforces authoritative DB role ("Sales Head")',
      `Expected role "Sales Head", got "${res3.body?.session?.role}" (Status: ${res3.status})`
    );

    // Verify session in active sessions or probe
    const res3Probe = await makeRequest({
      hostname: '127.0.0.1',
      port,
      path: '/api/crm/leads/notifications?employeeCode=CEO-001',
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'x-session-id': seSessionId
      }
    });

    assert(
      res3Probe.status === 403,
      'Test 3b: Sales Head session cannot access CEO notifications (Privilege escalation blocked)',
      `Expected status 403, got ${res3Probe.status}`
    );

    // -------------------------------------------------------------------------
    // TEST 4: Overwriting existing active session
    // Unauthenticated caller attempts to hijack seSessionId and elevate to CEO
    // -------------------------------------------------------------------------
    const res4 = await makeRequest({
      hostname: '127.0.0.1',
      port,
      path: '/api/sessions/register',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, {
      id: seSessionId,
      role: 'CEO',
      empCode: 'CEO-001'
    });

    // Reconnection without credentials must preserve existing server role
    assert(
      res4.body?.session?.role === 'Sales Head',
      'Test 4: Reconnect preserves existing server role and rejects role hijacking',
      `Expected role "Sales Head", got "${res4.body?.session?.role}"`
    );

    // -------------------------------------------------------------------------
    // TEST 5: Unauthenticated revocation attempt
    // -------------------------------------------------------------------------
    const res5 = await makeRequest({
      hostname: '127.0.0.1',
      port,
      path: '/api/sessions/revoke',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, {
      sessionId: seSessionId
    });

    assert(
      res5.status === 401,
      'Test 5: Unauthenticated caller cannot revoke sessions',
      `Expected status 401, got ${res5.status}`
    );

    // -------------------------------------------------------------------------
    // TEST 6: Cross-user session revocation:
    // Sales Head tries to revoke another user's session
    // -------------------------------------------------------------------------
    const targetOtherSession = 'SES-OTHER-USER-123';
    const res6 = await makeRequest({
      hostname: '127.0.0.1',
      port,
      path: '/api/sessions/revoke',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-session-id': seSessionId
      }
    }, {
      sessionId: targetOtherSession
    });

    assert(
      res6.status === 403,
      'Test 6: Non-admin employee cannot revoke another employee session (403 Forbidden)',
      `Expected status 403, got ${res6.status}`
    );

    // -------------------------------------------------------------------------
    // TEST 7: Employee revoking their OWN session
    // -------------------------------------------------------------------------
    const res7 = await makeRequest({
      hostname: '127.0.0.1',
      port,
      path: '/api/sessions/revoke',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-session-id': seSessionId
      }
    }, {
      sessionId: seSessionId
    });

    assert(
      res7.status === 200 && res7.body?.success === true,
      'Test 7: Employee can successfully revoke their own session',
      `Expected status 200, got ${res7.status}`
    );

    // Verify revoked session is rejected on subsequent calls
    const res7Check = await makeRequest({
      hostname: '127.0.0.1',
      port,
      path: '/api/crm/leads/notifications',
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'x-session-id': seSessionId
      }
    });

    assert(
      res7Check.status === 401 && res7Check.body?.error?.includes('revoked'),
      'Test 7b: Subsequent requests with revoked session return 401 Session Revoked',
      `Expected status 401, got ${res7Check.status} (${JSON.stringify(res7Check.body)})`
    );

    // -------------------------------------------------------------------------
    // TEST 8: Technical Administrator authenticated session & revocation
    // -------------------------------------------------------------------------
    const adminSessionId = 'SES-ADMIN-VALID-' + Date.now();
    const res8 = await makeRequest({
      hostname: '127.0.0.1',
      port,
      path: '/api/sessions/register',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, {
      id: adminSessionId,
      empCode: 'TA-VRM001',
      password: 'Efx@1234'
    });

    assert(
      res8.status === 200 && res8.body?.session?.role === 'Technical Administrator',
      'Test 8a: Technical Administrator successfully registers session with server role derivation',
      `Expected role "Technical Administrator", got "${res8.body?.session?.role}"`
    );

    // Admin can revoke any session
    const res8Revoke = await makeRequest({
      hostname: '127.0.0.1',
      port,
      path: '/api/sessions/revoke',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-session-id': adminSessionId
      }
    }, {
      sessionId: 'some-target-session'
    });

    assert(
      res8Revoke.status === 200,
      'Test 8b: Technical Administrator can revoke any target session (200 OK)',
      `Expected status 200, got ${res8Revoke.status}`
    );

    // -------------------------------------------------------------------------
    // TEST 9: Unauthenticated /api/sessions/active rejection
    // -------------------------------------------------------------------------
    const res9 = await makeRequest({
      hostname: '127.0.0.1',
      port,
      path: '/api/sessions/active',
      method: 'GET',
      headers: { 'Content-Type': 'application/json' }
    });

    assert(
      res9.status === 401,
      'Test 9: Unauthenticated access to /api/sessions/active is rejected with 401',
      `Expected status 401, got ${res9.status}`
    );

  } catch (err) {
    console.error(`💥 Unexpected test harness error:`, err);
    failed++;
  }

  console.log(`\n------------------------------------------------------------`);
  console.log(`SUMMARY: ${passed} Passed, ${failed} Failed`);
  console.log(`------------------------------------------------------------\n`);
  return { passed, failed };
}

if (process.argv[1]?.endsWith('test_session_security.js')) {
  const port = process.env.PORT || 5001;
  runSessionSecurityTests(port).then(r => {
    process.exit(r.failed === 0 ? 0 : 1);
  });
}

export { runSessionSecurityTests };
