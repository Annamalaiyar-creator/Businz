/**
 * scripts/test_phase1_sse_optimization.js
 * Verification suite for Phase 1: SSE Optimization
 * 
 * Verifies:
 * 1. SSE Connection Handshake & Sequence Numbering (seq: 0 on connect).
 * 2. Monotonic sequence increments on broadcasts.
 * 3. Lightweight event payload structure (seq, type, key, recordId, action) without full arrays.
 * 4. Payloads are small (< 1 KB) even when updating stores.
 * 5. Reconnection & Missed-Events Replay using Last-Event-ID header and query param.
 * 6. Multi-client broadcast concurrency (10 concurrent clients, no event loop blocking).
 */

import http from 'http';
import assert from 'assert';

const SERVER_BASE = 'http://127.0.0.1:5001';

function createSseClient(name, options = {}) {
  const { lastEventId, queryParam } = options;
  const events = [];
  let resolveFirstConnected;
  const connectedPromise = new Promise((resolve) => {
    resolveFirstConnected = resolve;
  });

  let url = `${SERVER_BASE}/api/realtime-events`;
  if (queryParam) {
    url += `?lastEventId=${queryParam}`;
  }

  const headers = {};
  if (lastEventId !== undefined) {
    headers['Last-Event-ID'] = String(lastEventId);
  }

  const req = http.request(url, { headers }, (res) => {
    let buffer = '';
    res.on('data', (chunk) => {
      buffer += chunk.toString();
      const lines = buffer.split('\n\n');
      buffer = lines.pop(); // Keep incomplete chunk

      for (const block of lines) {
        if (!block.trim()) continue;
        let eventType = 'message';
        let eventData = '';
        let eventId = null;

        for (const line of block.split('\n')) {
          if (line.startsWith('event:')) {
            eventType = line.replace('event:', '').trim();
          } else if (line.startsWith('data:')) {
            eventData = line.replace('data:', '').trim();
          } else if (line.startsWith('id:')) {
            eventId = line.replace('id:', '').trim();
          }
        }

        if (eventData) {
          try {
            const parsed = JSON.parse(eventData);
            const rawSize = Buffer.byteLength(block, 'utf8');
            events.push({ eventType, eventId, data: parsed, rawSize });
            if (parsed.type === 'connected') {
              resolveFirstConnected(parsed);
            }
          } catch (err) {
            console.error(`[${name}] Failed to parse event JSON:`, eventData, err);
          }
        }
      }
    });
  });

  req.on('error', (err) => {
    // Expected on close
  });

  req.end();

  return {
    name,
    events,
    connectedPromise,
    close: () => {
      try {
        req.destroy();
      } catch (_) {}
    }
  };
}

async function postJson(endpoint, data) {
  return new Promise((resolve, reject) => {
    const payload = JSON.stringify(data);
    const u = new URL(endpoint, SERVER_BASE);
    const req = http.request(u, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(payload)
      }
    }, (res) => {
      let body = '';
      res.on('data', d => body += d);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, body: JSON.parse(body) });
        } catch (_) {
          resolve({ status: res.statusCode, body });
        }
      });
    });
    req.on('error', reject);
    req.write(payload);
    req.end();
  });
}

async function run() {
  console.log('===============================================================');
  console.log('🚀 PHASE 1 SSE OPTIMIZATION VERIFICATION SUITE');
  console.log('===============================================================\n');

  // Test 1: Connect 3 clients
  console.log('1. Connecting 3 SSE clients...');
  const client1 = createSseClient('Client-1');
  const client2 = createSseClient('Client-2');
  const client3 = createSseClient('Client-3');

  const handshakes = await Promise.all([
    client1.connectedPromise,
    client2.connectedPromise,
    client3.connectedPromise
  ]);

  console.log('   ✅ All 3 clients connected successfully.');
  handshakes.forEach((h, idx) => {
    assert.strictEqual(h.type, 'connected');
    assert(typeof h.seq === 'number' && h.seq >= 0, 'Initial connection handshake seq must be >= 0');
    console.log(`   - Client ${idx + 1} handshake: type=${h.type}, current server seq: ${h.seq}`);
  });

  // Test 2: Trigger a store update and check payload size & structure
  console.log('\n2. Testing targeted lightweight store update broadcast...');
  const testRecordId = 'ITEM-PERF-' + Date.now();
  const testPayload = {
    key: 'test_store',
    data: [
      { id: testRecordId, name: 'Performance Test Item', qty: 100 }
    ],
    recordId: testRecordId,
    action: 'update'
  };

  const postRes = await postJson('/api/store/test_store', testPayload);
  assert.strictEqual(postRes.status, 200, 'POST /api/store/test_store should succeed');

  // Wait for SSE broadcast
  await new Promise(r => setTimeout(r, 600));

  // Inspect events received across all 3 clients
  console.log('   Checking received events across all 3 clients:');
  for (const client of [client1, client2, client3]) {
    const storeEvents = client.events.filter(e => e.data.type === 'store_updated');
    assert(storeEvents.length >= 1, `${client.name} should have received at least 1 store_updated event`);
    const lastEvent = storeEvents[storeEvents.length - 1];
    
    // Check lightweight structure
    assert(lastEvent.data.seq > 0, 'Event seq must be > 0');
    assert.strictEqual(lastEvent.data.key, 'test_store');
    assert.strictEqual(lastEvent.data.recordId, testRecordId);
    assert.strictEqual(lastEvent.data.action, 'update');
    // Verify NO massive storeData array is duplicated
    assert.strictEqual(lastEvent.data.storeData, undefined, 'Full storeData array must NOT be present in lightweight event');
    
    // Check payload size
    console.log(`   - ${client.name}: seq=${lastEvent.data.seq}, raw event size: ${lastEvent.rawSize} bytes (Payload < 1KB)`);
    assert(lastEvent.rawSize < 1024, `SSE event size (${lastEvent.rawSize} bytes) should be well under 1KB!`);
  }
  console.log('   ✅ Lightweight payload verified: No full array duplication, size < 1 KB!');

  // Test 3: Reconnection and Missed-Event Replay
  console.log('\n3. Testing Reconnection & Ring Buffer Replay...');
  const currentSeq = client1.events[client1.events.length - 1].data.seq;
  console.log(`   Current highest seq: ${currentSeq}`);

  // Disconnect client 3
  console.log('   Disconnecting Client 3...');
  client3.close();

  // Send 2 more updates while Client 3 is offline
  console.log('   Broadcasting 2 new events while Client 3 is disconnected...');
  await postJson('/api/store/test_store', {
    key: 'test_store',
    data: [{ id: 'TEST-REC-1', name: 'Item 1' }],
    recordId: 'TEST-REC-1',
    action: 'create'
  });
  await new Promise(r => setTimeout(r, 300));

  await postJson('/api/store/test_store', {
    key: 'test_store',
    data: [{ id: 'TEST-REC-2', name: 'Item 2' }],
    recordId: 'TEST-REC-2',
    action: 'create'
  });
  await new Promise(r => setTimeout(r, 300));

  // Reconnect Client 3 with Last-Event-ID header
  console.log(`   Reconnecting Client 3 with Last-Event-ID = ${currentSeq}...`);
  const client3Reconnected = createSseClient('Client-3-Reconnected', { lastEventId: currentSeq });
  await client3Reconnected.connectedPromise;
  await new Promise(r => setTimeout(r, 600));

  const replayedEvents = client3Reconnected.events.filter(e => e.data.type === 'store_updated');
  console.log(`   Client 3 Reconnected received ${replayedEvents.length} store_updated events.`);
  assert(replayedEvents.length >= 2, 'Client 3 should have received the 2 missed events replayed from buffer');
  
  const seqs = replayedEvents.map(e => e.data.seq);
  console.log(`   Replayed event seqs: ${seqs.join(', ')}`);
  assert(seqs.includes(currentSeq + 1), `Should have replayed seq ${currentSeq + 1}`);
  assert(seqs.includes(currentSeq + 2), `Should have replayed seq ${currentSeq + 2}`);
  console.log('   ✅ Missed-event replay verified via Last-Event-ID ring buffer!');

  // Also test query parameter ?lastEventId=
  console.log(`   Testing reconnection with ?lastEventId=${currentSeq + 1} query param...`);
  const clientQueryParam = createSseClient('Client-QueryParam', { queryParam: currentSeq + 1 });
  await clientQueryParam.connectedPromise;
  await new Promise(r => setTimeout(r, 600));
  const queryReplayed = clientQueryParam.events.filter(e => e.data.type === 'store_updated');
  assert(queryReplayed.length >= 1, 'Query param reconnection must replay missed events');
  assert.strictEqual(queryReplayed[0].data.seq, currentSeq + 2);
  console.log(`   ✅ Query parameter ?lastEventId replay verified: received seq ${queryReplayed[0].data.seq}!`);

  // Test 4: Multi-client Concurrency (10 clients)
  console.log('\n4. Testing 10 Concurrent SSE Clients & Rapid Broadcasts...');
  const pool = [];
  for (let i = 0; i < 10; i++) {
    pool.push(createSseClient(`LoadClient-${i+1}`));
  }
  await Promise.all(pool.map(c => c.connectedPromise));
  console.log('   Connected 10 concurrent clients successfully.');

  const startTime = Date.now();
  const eventCount = 10;
  for (let i = 0; i < eventCount; i++) {
    await postJson('/api/store/test_store', {
      key: 'test_store',
      data: [{ id: `LOAD-${i}`, name: `Load test ${i}` }],
      recordId: `LOAD-${i}`,
      action: 'update'
    });
  }
  const broadcastDuration = Date.now() - startTime;
  console.log(`   Dispatched ${eventCount} broadcasts across 10 clients in ${broadcastDuration}ms.`);

  // Wait for all clients to receive
  await new Promise(r => setTimeout(r, 1000));

  // Verify all 10 clients received all events
  for (const c of pool) {
    const loadEvents = c.events.filter(e => e.data.recordId && e.data.recordId.startsWith('LOAD-'));
    assert.strictEqual(loadEvents.length, eventCount, `${c.name} should have received exactly ${eventCount} events`);
  }
  console.log('   ✅ All 10 clients received 100% of broadcast events without drops or stalls.');

  // Cleanup
  console.log('\n5. Cleaning up test clients...');
  client1.close();
  client2.close();
  client3Reconnected.close();
  clientQueryParam.close();
  pool.forEach(c => c.close());
  console.log('   ✅ Sockets closed cleanly.');

  console.log('\n===============================================================');
  console.log('🎉 ALL PHASE 1 SSE OPTIMIZATION TESTS PASSED PERFECTLY!');
  console.log('===============================================================\n');
}

run().catch(err => {
  console.error('\n❌ TEST FAILED:', err);
  process.exit(1);
});
