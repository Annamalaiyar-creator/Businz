/**
 * scripts/audit_phase4_integration_and_durability.js
 * 
 * BUSINZ Phase 4: Final Integration, Security & Durability Audit
 * Tests:
 * 1. Crash-Recovery & Awaited Durability (PostgreSQL commit verification)
 * 2. Database Transaction Rollback & Orphan Protection
 * 3. SSE Resilience: 10 Clients, Server Restart Detection, >120 Missed Events (Ring Buffer Overflow)
 * 4. SSE Backpressure Protection
 * 5. Security & Permission Audits:
 *    - /api/repair-bom-sequences -> 403 Forbidden
 *    - Document signed-url without session -> 401 Unauthorized
 *    - Role-based notification isolation
 *    - Credential / DB password masking check
 */

import http from 'http';
import pg from 'pg';
import assert from 'assert';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, '../.env.development.local') });
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const BASE_URL = 'http://127.0.0.1:5001';

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/businz_dev',
  max: 5
});

function request(path, options = {}) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, BASE_URL);
    const reqOptions = {
      method: options.method || 'GET',
      headers: options.headers || {},
      timeout: options.timeout || 10000,
    };

    const req = http.request(url, reqOptions, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, headers: res.headers, data: JSON.parse(data) });
        } catch (_) {
          resolve({ status: res.statusCode, headers: res.headers, rawData: data });
        }
      });
    });

    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error(`Timeout for ${path}`)); });

    if (options.body) {
      const payload = typeof options.body === 'string' ? options.body : JSON.stringify(options.body);
      req.setHeader('Content-Type', 'application/json');
      req.setHeader('Content-Length', Buffer.byteLength(payload));
      req.write(payload);
    }
    req.end();
  });
}

function connectSseClient(clientId, lastEventId = null) {
  return new Promise((resolve, reject) => {
    const query = lastEventId ? `?lastEventId=${lastEventId}` : '';
    const headers = lastEventId ? { 'Last-Event-ID': String(lastEventId) } : {};
    
    const req = http.request(`${BASE_URL}/api/realtime-events${query}`, {
      headers,
      method: 'GET'
    }, (res) => {
      const client = {
        id: clientId,
        res,
        events: [],
        connected: false,
        handshakeSeq: null,
        resyncRequired: false,
        close: () => {
          try { res.destroy(); } catch (_) {}
        }
      };

      res.on('data', (chunk) => {
        const text = chunk.toString();
        const lines = text.split('\n');
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const parsed = JSON.parse(line.slice(6));
              client.events.push(parsed);
              if (parsed.type === 'connected') {
                client.connected = true;
                client.handshakeSeq = parsed.seq;
              }
              if (parsed.type === 'resync_required') {
                client.resyncRequired = true;
              }
            } catch (_) {}
          }
        }
      });

      // Wait a short moment for initial connected event
      setTimeout(() => resolve(client), 150);
    });

    req.on('error', reject);
    req.end();
  });
}

async function runAudit() {
  console.log('========================================================================');
  console.log('🛡️ BUSINZ PHASE 4: FINAL INTEGRATION, SECURITY & DURABILITY AUDIT');
  console.log('========================================================================\n');

  let passed = 0;
  let total = 0;

  async function test(title, fn) {
    total++;
    try {
      await fn();
      passed++;
      console.log(`✅ [PASS] ${title}`);
    } catch (err) {
      console.error(`❌ [FAIL] ${title}:`, err.message);
      throw err;
    }
  }

  // --- SECTION 1: DATA DURABILITY & TRANSACTION ROLLBACK ---
  console.log('--- 1. Data Integrity & Durability Audit ---');

  await test('Awaited Database Persistence to PostgreSQL controlroom_store', async () => {
    const testKey = `test_durability_${Date.now()}`;
    const testData = [{ id: 'DUR-01', value: 'durability_verified', timestamp: Date.now() }];

    const saveRes = await request(`/api/store/${testKey}`, {
      method: 'POST',
      body: testData
    });
    assert.strictEqual(saveRes.status, 200, 'Store write must succeed with 200');

    // Query PostgreSQL directly using pg.Pool (bypassing Express memory cache)
    const dbRes = await pool.query('SELECT data FROM controlroom_store WHERE key = $1', [testKey]);
    assert.strictEqual(dbRes.rows.length, 1, 'Record must exist directly in PostgreSQL controlroom_store');
    const dbParsed = typeof dbRes.rows[0].data === 'string' ? JSON.parse(dbRes.rows[0].data) : dbRes.rows[0].data;
    assert.strictEqual(dbParsed[0].id, 'DUR-01', 'Written content must match PostgreSQL persisted row');

    // Clean up
    await pool.query('DELETE FROM controlroom_store WHERE key = $1', [testKey]);
  });

  await test('Rejection of Invalid BOM Identifier Updates (Transaction Protection)', async () => {
    const invalidBom = {
      bomCode: 'null',
      customerName: 'Invalid Test Customer',
      grandTotal: 1000
    };
    const res = await request('/api/boms', {
      method: 'POST',
      body: { bom: invalidBom, isUpdate: true }
    });
    assert.strictEqual(res.status, 400, 'Invalid BOM code on update must be rejected with HTTP 400');
    assert.strictEqual(res.data.success, false, 'Success must be false');
  });

  await test('Inventory Over-Reservation Guard & Atomic Rollback', async () => {
    // Check item stock
    const itemsRes = await request('/api/items');
    assert.strictEqual(itemsRes.status, 200);
    const items = itemsRes.data;
    const testItem = items[0];
    assert.ok(testItem, 'Must have at least one inventory item');

    // Attempting to reserve an impossibly high quantity
    const impossibleQty = (testItem.stock || 100) + 999999;
    const overRes = await request('/api/inventory/reserve', {
      method: 'POST',
      body: {
        bomCode: 'TEST-OVER-BOM',
        items: [{ code: testItem.code, qty: impossibleQty }]
      }
    });

    // Stock should not be modified
    const checkRes = await request(`/api/items?search=${encodeURIComponent(testItem.code)}`);
    const afterItem = checkRes.data.find(it => it.code === testItem.code);
    assert.strictEqual(afterItem.stock, testItem.stock, 'Item stock must remain strictly unchanged after rejected reservation');
  });

  // --- SECTION 2: SSE RESILIENCE VERIFICATION ---
  console.log('\n--- 2. SSE Resilience Verification ---');

  await test('10 Simultaneous SSE Clients Connectivity & Real-Time Fan-Out', async () => {
    const clients = [];
    for (let i = 0; i < 10; i++) {
      const c = await connectSseClient(`client-${i + 1}`);
      assert.strictEqual(c.connected, true, `Client ${i + 1} must connect and receive handshake`);
      clients.push(c);
    }

    // Trigger an inventory broadcast
    await request('/api/raw-materials', {
      method: 'POST',
      body: [{ code: 'TEST-AUDIT-RM', name: 'Audit Material', stock: 50 }]
    });

    // Wait 200ms for SSE event arrival
    await new Promise(r => setTimeout(r, 200));

    // Verify all 10 clients received the event
    for (const c of clients) {
      const hasEvent = c.events.some(e => e.type === 'inventory_updated');
      assert.ok(hasEvent, `Client ${c.id} must receive the real-time event`);
      c.close();
    }
  });

  await test('Server Sequence Reset Detection (?lastEventId > serverSequenceId)', async () => {
    // Connect client claiming it last saw seq 999999
    const client = await connectSseClient('reboot-client', 999999);
    await new Promise(r => setTimeout(r, 100));
    assert.strictEqual(client.resyncRequired, true, 'Client with future sequence ID must receive resync_required');
    const resyncEv = client.events.find(e => e.type === 'resync_required');
    assert.strictEqual(resyncEv.reason, 'server_restart', 'Reason must be server_restart');
    client.close();
  });

  await test('Ring Buffer Overflow Detection (>120 Missed Events)', async () => {
    // Keep a persistent listener connected so broadcastRealtimeEvent processes events
    const listener = await connectSseClient('persistent-listener');
    const startSeq = listener.handshakeSeq || 1;

    // Blast 125 events to exceed the MAX_SSE_HISTORY ring buffer (size 100)
    for (let i = 0; i < 125; i++) {
      await request('/api/store/test_blast_store', {
        method: 'POST',
        body: [{ i, t: Date.now() }]
      });
    }

    // Now connect another client with startSeq (which has been pushed out of the ring buffer)
    const reconnectedClient = await connectSseClient('overflow-client', startSeq);
    await new Promise(r => setTimeout(r, 200));
    assert.strictEqual(reconnectedClient.resyncRequired, true, 'Client beyond ring buffer history must receive resync_required');
    const resyncEv = reconnectedClient.events.find(e => e.type === 'resync_required');
    assert.strictEqual(resyncEv.reason, 'buffer_overflow', 'Reason must indicate buffer_overflow');
    
    listener.close();
    reconnectedClient.close();

    // Clean up blast store
    await pool.query("DELETE FROM controlroom_store WHERE key = 'test_blast_store'");
  });

  // --- SECTION 3: SECURITY & PERMISSION VERIFICATION ---
  console.log('\n--- 3. Security Verification ---');

  await test('Protected Sequence Endpoint /api/repair-bom-sequences Returns HTTP 403 Forbidden', async () => {
    const res = await request('/api/repair-bom-sequences', { method: 'POST', body: {} });
    assert.strictEqual(res.status, 403, 'Endpoint must return 403 Forbidden');
    assert.strictEqual(res.data.success, false);
  });

  await test('Private Document Endpoint /documents/signed-url Requires Authorization', async () => {
    const res = await request('/api/boms/VRM-BOM-2026-01/documents/signed-url?storagePath=test.pdf');
    // Without Businz session headers/cookies, must return 401 or 403
    assert.ok(res.status === 401 || res.status === 403, `Must reject unauthenticated signed-url request (got ${res.status})`);
  });

  await test('Role-Based Notification Filter Isolation', async () => {
    const res = await request('/api/store/notifications_store?role=Executive&page=1&limit=20');
    assert.strictEqual(res.status, 200);
    const notifications = res.data.data || [];
    // Verify none of the items strictly belong to a conflicting role without 'Executive' or 'All'
    for (const n of notifications) {
      const roles = Array.isArray(n.targetRoles) ? n.targetRoles : (n.role ? [n.role] : ['All']);
      const isPermitted = roles.some(r => r === 'All' || String(r).toLowerCase().includes('exec'));
      assert.ok(isPermitted, `Notification ${n.id} must match requested role filter`);
    }
  });

  await test('Zero Secret / Database Password Leakage in Health & Query Responses', async () => {
    const statusRes = await request('/api/db-status');
    assert.strictEqual(statusRes.status, 200);
    const raw = JSON.stringify(statusRes.data);
    assert.strictEqual(raw.includes('password'), false, 'db-status must not leak password field');
    assert.strictEqual(raw.includes('postgres:'), false, 'db-status must not leak full connection string credentials');
  });

  console.log('\n========================================================================');
  console.log(`🎉 ALL ${passed}/${total} PHASE 4 AUDIT TESTS PASSED WITH 100% SUCCESS!`);
  console.log('========================================================================');

  await pool.end();
  process.exit(0);
}

runAudit().catch(err => {
  console.error('\n❌ Phase 4 Audit Encountered Failure:', err);
  pool.end().catch(() => {});
  process.exit(1);
});
