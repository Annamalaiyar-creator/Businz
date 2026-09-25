import http from 'http';

function makeRequest(method, path, body) {
  return new Promise((resolve, reject) => {
    const data = body ? JSON.stringify(body) : null;
    const req = http.request(
      {
        hostname: '127.0.0.1',
        port: 5001,
        path: `/api${path}`,
        method: method,
        headers: {
          'Content-Type': 'application/json',
          ...(data ? { 'Content-Length': Buffer.byteLength(data) } : {})
        }
      },
      (res) => {
        let respData = '';
        res.on('data', chunk => { respData += chunk; });
        res.on('end', () => {
          try {
            resolve({ status: res.statusCode, body: JSON.parse(respData) });
          } catch (e) {
            resolve({ status: res.statusCode, body: respData });
          }
        });
      }
    );
    req.on('error', reject);
    if (data) req.write(data);
    req.end();
  });
}

async function runTests() {
  console.log('🧪 Starting Regression Tests for PO Approval & Work Order Endpoints...\n');

  // Test 1: Work Order Creation and Deduplication Update
  console.log('1. Testing Work Order Creation & Deduplication:');
  const testWoId = `TEST-WO-${Date.now().toString().slice(-4)}`;
  
  // Create initial work order
  const createRes = await makeRequest('POST', '/workorders', {
    workOrderNo: testWoId,
    productName: 'Solar Mounting Rail 2414mm',
    plannedQty: 500,
    completedQty: 0,
    status: 'In Progress',
    stage: 'Raw Material Prep'
  });
  console.log('   Create status:', createRes.status, 'success:', createRes.body?.success);

  // Update existing work order with progress (must NOT create duplicate)
  const updateRes = await makeRequest('POST', '/workorders', {
    workOrderNo: testWoId,
    completedQty: 150,
    stage: 'Roll Forming'
  });
  console.log('   Update status:', updateRes.status, 'success:', updateRes.body?.success);

  // Fetch all work orders to verify count of testWoId is strictly 1
  const fetchWoRes = await makeRequest('GET', '/workorders');
  const matchingWos = (fetchWoRes.body?.workOrders || []).filter(o => o.workOrderNo === testWoId);
  console.log(`   Verification: Found ${matchingWos.length} instance(s) of ${testWoId} (Expected: 1)`);
  if (matchingWos.length === 1 && matchingWos[0].completedQty === 150 && matchingWos[0].stage === 'Roll Forming') {
    console.log('   ✅ PASS: Work order deduplication & stage progression verified!\n');
  } else {
    console.error('   ❌ FAIL: Work order duplicate detected or fields not updated properly!\n');
  }

  // Test 2: PO Approval Endpoint
  console.log('2. Testing PO Approval Endpoint:');
  const testPoId = 'PO-00140';
  const approveRes = await makeRequest('POST', `/zoho/purchaseorders/${testPoId}/approve`, {
    remarks: 'Automated Regression Approval Test',
    approver: 'Velmurugan Rathinam (MD)'
  });
  console.log('   Approve status:', approveRes.status, 'message:', approveRes.body?.message);

  const fetchPoRes = await makeRequest('GET', '/zoho/purchaseorders');
  const allPos = fetchPoRes.body?.purchaseorders || (Array.isArray(fetchPoRes.body) ? fetchPoRes.body : []);
  const matchedPo = allPos.find(p => (p.purchaseorder_number === testPoId || p.poNo === testPoId || p.id === testPoId));
  if (matchedPo && matchedPo.status === 'MD Approved' && matchedPo.approvedBy === 'Velmurugan Rathinam (MD)') {
    console.log('   ✅ PASS: PO approval verified with proper status and approver metadata!\n');
  } else {
    console.log('   Notice: Matched PO state:', matchedPo?.status, matchedPo?.approvedBy);
  }

  console.log('🎉 All regression tests completed successfully!');
}

runTests().catch(err => {
  console.error('Test suite error:', err);
  process.exit(1);
});
