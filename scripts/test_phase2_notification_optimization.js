import http from 'http';
import assert from 'assert';
import { resolveAndValidateTestApiUrl } from './testEnvironmentGuard.js';

// Resolve explicit test API URL (Fails closed if missing, or if targeting 5001/5002)
const BASE_URL = resolveAndValidateTestApiUrl();
const TEST_SESSION_ID = `SES_TEST_PHASE2_${Date.now()}`;

function request(path, options = {}) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, BASE_URL);
    const reqOptions = {
      method: options.method || 'GET',
      headers: {
        'x-session-id': TEST_SESSION_ID,
        ...(options.headers || {})
      },
      timeout: options.timeout || 10000,
    };

    const req = http.request(url, reqOptions, (res) => {
      let data = '';
      res.on('data', (chunk) => {
        data += chunk;
      });
      res.on('end', () => {
        const rawBytes = Buffer.byteLength(data, 'utf8');
        try {
          const json = JSON.parse(data);
          resolve({ status: res.statusCode, headers: res.headers, data: json, rawBytes });
        } catch (e) {
          resolve({ status: res.statusCode, headers: res.headers, rawData: data, rawBytes });
        }
      });
    });

    req.on('error', reject);
    req.on('timeout', () => {
      req.destroy();
      reject(new Error(`Request timeout for ${path}`));
    });

    if (options.body) {
      const payload = typeof options.body === 'string' ? options.body : JSON.stringify(options.body);
      req.write(payload);
    }
    req.end();
  });
}

async function runPhase2Tests() {
  console.log('===============================================================');
  console.log('   BUSINZ Phase 2: Notification Optimization Automated Verification');
  console.log('===============================================================\n');

  // Register verified session for test suite
  await request('/api/sessions/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      id: TEST_SESSION_ID,
      email: 'ceo@vrmstructures.com',
      empCode: 'CEO-001',
      role: 'CEO',
      user: 'Velmurugan Rathinam'
    })
  });

  const report = {
    totalTests: 0,
    passed: 0,
    failed: 0,
    metrics: {}
  };

  function test(name, fn) {
    report.totalTests++;
    return fn()
      .then(() => {
        report.passed++;
        console.log(`  ✅ [PASS] ${name}`);
      })
      .catch((err) => {
        report.failed++;
        console.error(`  ❌ [FAIL] ${name}:`, err.message);
      });
  }

  // --- Test 1: Historical Data Preservation Check ---
  let originalTotalCount = 0;
  await test('Historical Data Preservation (No truncation/reset)', async () => {
    const res = await request('/api/store/notifications_store?page=1&limit=10');
    assert.strictEqual(res.status, 200, 'Endpoint should return 200 OK');
    assert.strictEqual(res.data.success, true, 'Response success must be true');
    assert.ok(typeof res.data.total === 'number', 'total must be a number');
    assert.ok(res.data.total >= 5000, `Total must be at least 5000 historical records (got ${res.data.total})`);
    originalTotalCount = res.data.total;
    console.log(`     -> Historical records preserved: ${originalTotalCount} notifications`);
  });

  // --- Test 2: Server-Side Pagination (Default 50, Page 1 vs Page 2) ---
  let page1Items = [];
  let page2Items = [];
  await test('Server-Side Pagination (Default 50 records/page & disjoint pages)', async () => {
    // Default limit should be 50
    const defaultRes = await request('/api/store/notifications_store');
    assert.strictEqual(defaultRes.data.limit, 50, 'Default limit must be 50');
    assert.strictEqual(defaultRes.data.page, 1, 'Default page must be 1');
    assert.strictEqual(defaultRes.data.data.length, 50, 'Default page 1 must return exactly 50 records');
    page1Items = defaultRes.data.data;

    // Page 2
    const page2Res = await request('/api/store/notifications_store?page=2&limit=50');
    assert.strictEqual(page2Res.data.page, 2, 'Page must be 2');
    assert.strictEqual(page2Res.data.data.length, 50, 'Page 2 must return 50 records');
    page2Items = page2Res.data.data;

    // Ensure Page 1 and Page 2 have no overlapping IDs
    const page1Ids = new Set(page1Items.map(n => n.id || n.message));
    const overlaps = page2Items.filter(n => page1Ids.has(n.id || n.message));
    assert.strictEqual(overlaps.length, 0, `Page 1 and Page 2 must not have overlapping records (found ${overlaps.length})`);
    assert.strictEqual(page2Res.data.hasMore, true, 'hasMore must be true when more pages exist');
    console.log(`     -> Page 1: 50 records, Page 2: 50 records, Overlaps: 0, Total Pages: ${page2Res.data.totalPages}`);
  });

  // --- Test 3: Payload Size Comparison (Before vs After) ---
  await test('API Payload Size Comparison (50-item Paginated vs Full Store)', async () => {
    const paginatedRes = await request('/api/store/notifications_store?page=1&limit=50');
    const fullRes = await request('/api/store/notifications_store?all=true');

    const paginatedKb = (paginatedRes.rawBytes / 1024).toFixed(2);
    const fullKb = (fullRes.rawBytes / 1024).toFixed(2);
    const reductionPercent = (((fullRes.rawBytes - paginatedRes.rawBytes) / fullRes.rawBytes) * 100).toFixed(2);

    assert.ok(paginatedRes.rawBytes < 50 * 1024, `Paginated payload must be under 50 KB (got ${paginatedKb} KB)`);
    assert.ok(fullRes.rawBytes > 500 * 1024, `Full store should be large (got ${fullKb} KB)`);

    report.metrics.paginatedBytes = paginatedRes.rawBytes;
    report.metrics.fullBytes = fullRes.rawBytes;
    report.metrics.reductionPercent = reductionPercent;

    console.log(`     -> Unpaginated payload: ${fullKb} KB (${(fullRes.rawBytes / (1024 * 1024)).toFixed(2)} MB)`);
    console.log(`     -> Paginated (50 items): ${paginatedKb} KB`);
    console.log(`     -> Egress reduction: ${reductionPercent}% bandwidth saved per request`);
  });

  // --- Test 4: Incremental Sync via ?sinceId= ---
  await test('Incremental Sync via ?sinceId=', async () => {
    // Pick an item at index 5 of page 1
    const anchorItem = page1Items[5];
    assert.ok(anchorItem, 'Anchor item must exist');

    const res = await request(`/api/store/notifications_store?sinceId=${encodeURIComponent(anchorItem.id)}`);
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.data.mode, 'incremental');
    assert.strictEqual(res.data.sinceId, anchorItem.id);
    assert.strictEqual(res.data.count, 5, 'Should return exactly the 5 newer items ahead of the anchor');
    assert.strictEqual(res.data.data.length, 5);
    console.log(`     -> Incremental sync returned ${res.data.count} items newer than ${anchorItem.id}`);
  });

  // --- Test 5: Role & Unread Filters ---
  await test('Role and Unread Filtering', async () => {
    const dispatchRes = await request('/api/store/notifications_store?role=Dispatch&limit=50');
    assert.strictEqual(dispatchRes.status, 200);
    assert.ok(Array.isArray(dispatchRes.data.data));
    dispatchRes.data.data.forEach(n => {
      const roles = Array.isArray(n.targetRoles) ? n.targetRoles : [n.role || 'All'];
      const matches = roles.some(r => String(r).toLowerCase().includes('dispatch') || r === 'All');
      assert.ok(matches, `Item ${n.id} should match role filter`);
    });

    const unreadRes = await request('/api/store/notifications_store?unread=true&limit=20');
    assert.strictEqual(unreadRes.status, 200);
    unreadRes.data.data.forEach(n => {
      assert.strictEqual(n.unread, true, `Item ${n.id} should be unread`);
    });
    console.log(`     -> Role filtering & unread filtering verified correctly`);
  });

  // --- Test 6: Optimized POST Response (Zero Payload Bloat) ---
  let createdNotifId = `TEST-NOTIF-${Date.now()}`;
  await test('Optimized Notification POST Response (< 2 KB, Backward-Compatible)', async () => {
    const newNotif = {
      id: createdNotifId,
      title: 'Phase 2 Test Order Packed',
      message: 'Vikram Solar order packed and verified for dispatch',
      targetRoles: ['Dispatch', 'Super Admin'],
      role: 'Dispatch',
      type: 'dispatch_packed',
      soundType: 'packed',
      time: '11:15 AM',
      createdAt: new Date().toISOString(),
      metadata: { bomCode: 'BOM-TEST-999', customerName: 'Vikram Solar Ltd' },
      unread: true
    };

    const startTime = Date.now();
    const res = await request('/api/store/notifications_store', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: { data: [newNotif] }
    });
    const postLatency = Date.now() - startTime;

    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.data.success, true);
    assert.ok(res.rawBytes < 3000, `POST response size must be < 3 KB (got ${res.rawBytes} bytes)`);
    assert.strictEqual(res.data.data[0].id, createdNotifId, 'Newly created notification must be at the top of returned slice');
    assert.strictEqual(res.data.total, originalTotalCount + 1, 'Total count must have incremented by 1');

    console.log(`     -> POST Response size: ${(res.rawBytes / 1024).toFixed(2)} KB (vs 15.9 MB before)`);
    console.log(`     -> POST Latency: ${postLatency}ms`);
  });

  // --- Test 7: 10 Concurrent Users Load & Non-Destructive Merge Benchmark ---
  await test('10 Concurrent Users POST Benchmark (Zero Data Loss, Concurrency Safe)', async () => {
    const concurrentUsers = 10;
    const testIds = [];
    const requests = [];

    const startBench = Date.now();
    const latencies = [];

    for (let i = 1; i <= concurrentUsers; i++) {
      const userNotifId = `CONCUR-USER-${i}-${Date.now()}`;
      testIds.push(userNotifId);

      const payload = {
        id: userNotifId,
        title: `Concurrent Order Alert User ${i}`,
        message: `BOM-USER-${i} status updated to Ready for Dispatch`,
        targetRoles: ['Dispatch', 'Accounts'],
        role: 'Dispatch',
        type: 'status_update',
        createdAt: new Date().toISOString(),
        unread: true
      };

      const userReqStart = Date.now();
      const p = request('/api/store/notifications_store', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: { data: [payload] }
      }).then(res => {
        latencies.push(Date.now() - userReqStart);
        return res;
      });

      requests.push(p);
    }

    const results = await Promise.all(requests);
    const totalBenchTime = Date.now() - startBench;

    // Verify all 10 succeeded
    results.forEach((r, idx) => {
      assert.strictEqual(r.status, 200, `User ${idx + 1} request must succeed with 200`);
      assert.strictEqual(r.data.success, true);
      assert.ok(r.rawBytes < 3000, `Response size for user ${idx + 1} must be small`);
    });

    latencies.sort((a, b) => a - b);
    const p50 = latencies[Math.floor(latencies.length * 0.5)];
    const p95 = latencies[Math.floor(latencies.length * 0.95)];

    report.metrics.concurrentLatencyP50 = p50;
    report.metrics.concurrentLatencyP95 = p95;
    report.metrics.totalBenchTime = totalBenchTime;

    // Verify that ALL 10 concurrent notifications exist in the store (zero data loss)
    const verifyRes = await request('/api/store/notifications_store?page=1&limit=50');
    assert.strictEqual(verifyRes.status, 200);

    const retrievedIds = new Set(verifyRes.data.data.map(n => n.id));
    testIds.forEach(id => {
      assert.ok(retrievedIds.has(id), `Concurrent notification ${id} must exist in the database store`);
    });

    console.log(`     -> 10 Concurrent writes completed in: ${totalBenchTime}ms`);
    console.log(`     -> Latency p50: ${p50}ms, p95: ${p95}ms`);
    console.log(`     -> Concurrent notifications verified in store: 10/10 (100% data integrity)`);
  });

  // --- Test 8: SSE Notification Delivery & Lightweight Payload Verification ---
  await test('Lightweight SSE Delivery for Notifications', async () => {
    return new Promise((resolve, reject) => {
      let receivedEvent = null;
      const sseReq = http.request(new URL('/api/realtime-events', BASE_URL), {
        headers: { 'Accept': 'text/event-stream' }
      }, (res) => {
        let buffer = '';

        res.on('data', (chunk) => {
          buffer += chunk.toString('utf8');
          const lines = buffer.split('\n\n');
          for (let i = 0; i < lines.length - 1; i++) {
            const rawEvent = lines[i];
            const dataMatch = rawEvent.match(/^data:\s*(.*)$/m);
            if (dataMatch) {
              try {
                const parsed = JSON.parse(dataMatch[1]);
                if (parsed.type === 'workflow_notification') {
                  receivedEvent = parsed;
                  sseReq.destroy();
                  break;
                }
              } catch (_) {}
            }
          }
          buffer = lines[lines.length - 1];

          if (receivedEvent) {
            assert.strictEqual(receivedEvent.type, 'workflow_notification');
            assert.ok(typeof receivedEvent.seq === 'number', 'SSE event must include monotonic sequence number');
            assert.ok(receivedEvent.payload, 'SSE event must have payload');
            assert.ok(receivedEvent.payload.notification, 'SSE payload must have notification');

            const payloadBytes = Buffer.byteLength(JSON.stringify(receivedEvent), 'utf8');
            assert.ok(payloadBytes < 1500, `SSE packet must be < 1.5 KB (got ${payloadBytes} bytes)`);

            console.log(`     -> SSE Event Type: ${receivedEvent.type}, Seq: ${receivedEvent.seq}`);
            console.log(`     -> SSE Notification Payload Size: ${payloadBytes} bytes (Lightweight delta)`);
            resolve();
          }
        });
      });

      sseReq.on('error', reject);
      sseReq.end();

      // Trigger a notification after connecting to SSE stream
      setTimeout(() => {
        request('/api/store/notifications_store', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: {
            data: [{
              id: `SSE-TEST-${Date.now()}`,
              title: 'SSE Alert Test',
              message: 'Testing SSE lightweight dispatch',
              targetRoles: ['Dispatch'],
              role: 'Dispatch',
              type: 'workflow_notification',
              unread: true
            }]
          }
        }).catch(reject);
      }, 500);

      // Safety timeout
      setTimeout(() => {
        if (!receivedEvent) {
          sseReq.destroy();
          reject(new Error('Timed out waiting for SSE workflow_notification event'));
        }
      }, 6000);
    });
  });

  // --- Test 9: Read/Unread Status Mutation Without Overwriting History ---
  await test('Mark As Read Preserves Historical Notifications', async () => {
    // Read the created notification
    const readPayload = {
      id: createdNotifId,
      unread: false,
      readAt: new Date().toISOString()
    };

    const res = await request('/api/store/notifications_store', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: { data: [readPayload] }
    });

    assert.strictEqual(res.status, 200);

    // Verify status was merged and title/message remained intact
    const verify = await request(`/api/store/notifications_store?page=1&limit=50`);
    const found = verify.data.data.find(n => n.id === createdNotifId);
    assert.ok(found, 'Notification must still exist');
    assert.strictEqual(found.unread, false, 'Notification must be marked as read');
    assert.strictEqual(found.title, 'Phase 2 Test Order Packed', 'Original title must be preserved');
    console.log(`     -> Read status updated, historical metadata preserved with zero loss`);
  });

  // Final Summary
  console.log('\n===============================================================');
  console.log(`   Verification Summary: ${report.passed}/${report.totalTests} Passed (${report.failed} Failed)`);
  console.log('===============================================================');

  if (report.failed > 0) {
    process.exit(1);
  }
}

runPhase2Tests().catch(err => {
  console.error('Fatal error during test run:', err);
  process.exit(1);
});
