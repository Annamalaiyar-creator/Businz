#!/usr/bin/env node
/**
 * BUSINZ ERP: BOM Documents Registered Routes Verification Suite
 * Tests actual registered endpoints:
 * 1. POST /api/boms/:bomCode/documents (Upload with authorized session)
 * 2. GET /api/boms/:bomCode/documents/metadata (Inspect metadata)
 * 3. GET /api/boms/:bomCode/documents/signed-url (Generate short-lived signed URL)
 * 4. GET <signedUrl> (Fetch uploaded file via returned signed URL)
 * 5. DELETE /api/boms/:bomCode/documents (Delete uploaded document)
 * 6. 401 Unauthorized when no session provided
 * 7. 403 Forbidden on path traversal attempt (?path=../../evil.txt)
 */

const BASE_URL = 'http://localhost:5001';

async function registerSession(session) {
  const res = await fetch(`${BASE_URL}/api/sessions/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(session)
  });
  return res.json();
}

async function runBomDocTests() {
  console.log('===================================================================');
  console.log('📎 BUSINZ ERP: BOM DOCUMENT ROUTES & SECURITY VERIFICATION');
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

  const sessionId = `SES_BOM_DOC_TEST_${Date.now()}`;
  await registerSession({
    id: sessionId,
    email: 'admin@vrmstructures.com',
    empCode: 'TA-VRM001',
    user: 'Ar.Annamalaiyar',
    role: 'Technical Administrator',
    status: 'active'
  });

  const testBomCode = 'VRM-BOM-2026-TEST';
  const testFileName = `test_proof_${Date.now()}.png`;
  // Minimal valid 1x1 transparent PNG data URL
  const testDataUrl = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAA=',
  testCategory = 'payment-proof';

  let uploadedStoragePath = null;

  // Test 1: Upload document with valid session
  try {
    const res = await fetch(`${BASE_URL}/api/boms/${testBomCode}/documents`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-session-id': sessionId
      },
      body: JSON.stringify({
        fileName: testFileName,
        mimeType: 'image/png',
        fileData: testDataUrl,
        category: testCategory
      })
    });
    const json = await res.json();
    uploadedStoragePath = json.metadata?.storagePath;
    record('Test 1: POST /api/boms/:bomCode/documents uploads file with session (200 OK)', res.status === 200 && json.success === true && !!uploadedStoragePath, `Status: ${res.status}, Path: ${uploadedStoragePath}`);
  } catch (e) {
    record('Test 1: POST /api/boms/:bomCode/documents upload', false, e.message);
  }

  // Test 2: Inspect metadata of uploaded document
  if (uploadedStoragePath) {
    try {
      const res = await fetch(`${BASE_URL}/api/boms/${testBomCode}/documents/metadata?path=${encodeURIComponent(uploadedStoragePath)}`, {
        headers: { 'x-session-id': sessionId }
      });
      const json = await res.json();
      record('Test 2: GET /api/boms/:bomCode/documents/metadata retrieves metadata (200 OK)', res.status === 200 && json.success === true && json.metadata?.name?.includes('test_proof'), `Status: ${res.status}, Name: ${json.metadata?.name}`);
    } catch (e) {
      record('Test 2: GET /api/boms/:bomCode/documents/metadata', false, e.message);
    }
  }

  // Test 3: Generate short-lived signed URL
  let signedUrl = null;
  if (uploadedStoragePath) {
    try {
      const res = await fetch(`${BASE_URL}/api/boms/${testBomCode}/documents/signed-url?path=${encodeURIComponent(uploadedStoragePath)}`, {
        headers: { 'x-session-id': sessionId }
      });
      const json = await res.json();
      signedUrl = json.signedUrl;
      record('Test 3: GET /api/boms/:bomCode/documents/signed-url generates URL (200 OK)', res.status === 200 && json.success === true && typeof signedUrl === 'string', `Status: ${res.status}, URL: ${signedUrl}`);
    } catch (e) {
      record('Test 3: GET /api/boms/:bomCode/documents/signed-url', false, e.message);
    }
  }

  // Test 4: Fetch document via signed URL
  if (signedUrl) {
    try {
      const fullSignedUrl = signedUrl.startsWith('http') ? signedUrl : `${BASE_URL}${signedUrl}`;
      const res = await fetch(fullSignedUrl);
      record('Test 4: Access document via generated signed URL returns 200 OK', res.status === 200, `Status: ${res.status}`);
    } catch (e) {
      record('Test 4: Access document via generated signed URL', false, e.message);
    }
  }

  // Test 5: Delete document
  if (uploadedStoragePath) {
    try {
      const res = await fetch(`${BASE_URL}/api/boms/${testBomCode}/documents`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          'x-session-id': sessionId
        },
        body: JSON.stringify({ path: uploadedStoragePath })
      });
      const json = await res.json();
      record('Test 5: DELETE /api/boms/:bomCode/documents removes file (200 OK)', res.status === 200 && json.success === true, `Status: ${res.status}`);
    } catch (e) {
      record('Test 5: DELETE /api/boms/:bomCode/documents', false, e.message);
    }
  }

  // Test 6: Unauthenticated request to /api/boms/:bomCode/documents/signed-url returns 401 or 403
  try {
    const res = await fetch(`${BASE_URL}/api/boms/${testBomCode}/documents/signed-url?path=some/path.png`);
    const json = await res.json();
    record('Test 6: Unauthenticated document access rejected with 401 or 403', (res.status === 401 || res.status === 403) && json.success === false, `Status: ${res.status}`);
  } catch (e) {
    record('Test 6: Unauthenticated document access rejected', false, e.message);
  }

  // Test 7: Path traversal protection returns 403 Forbidden
  try {
    const res = await fetch(`${BASE_URL}/api/boms/${testBomCode}/documents/signed-url?path=../../etc/passwd`, {
      headers: { 'x-session-id': sessionId }
    });
    const json = await res.json();
    record('Test 7: Path traversal attempt (../../) returns 403 Forbidden', res.status === 403 && json.success === false, `Status: ${res.status}`);
  } catch (e) {
    record('Test 7: Path traversal attempt', false, e.message);
  }

  console.log('\n===================================================================');
  console.log(`BOM Document Verification Complete: ${passed} Passed, ${failed} Failed`);
  console.log('===================================================================');

  if (failed > 0) process.exit(1);
}

runBomDocTests().catch(err => {
  console.error('Fatal BOM doc test error:', err);
  process.exit(1);
});
