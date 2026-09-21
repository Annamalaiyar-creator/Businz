/**
 * scripts/test_phase_d5_workflows.js
 * BUSINZ PHASE D5 — End-to-End Application Workflow & Network Verification
 */
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const API_URL = 'http://localhost:5001';
const BUCKET_NAME = 'bom-documents';

if (!supabaseUrl || !serviceRoleKey) {
  console.error('Missing configuration in .env');
  process.exit(1);
}

const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false }
});

const testHeaders = {
  'Content-Type': 'application/json',
  'x-admin-key': serviceRoleKey
};

let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (condition) {
    passed++;
    console.log(`  ✅ [PASS ${passed}] ${message}`);
  } else {
    failed++;
    console.error(`  ❌ [FAIL ${failed}] ${message}`);
    throw new Error(`Assertion failed: ${message}`);
  }
}

async function apiFetch(endpoint, options = {}) {
  const url = `${API_URL}${endpoint}`;
  const res = await fetch(url, options);
  let data = null;
  try {
    data = await res.json();
  } catch (_) {}
  return { status: res.status, data };
}

async function runD5Workflows() {
  console.log('====================================================');
  console.log('🚀 BUSINZ PHASE D5 — APPLICATION WORKFLOWS & EGRESS');
  console.log('====================================================\n');

  const testBomCode = 'BOM-TEST-D5-WF';

  try {
    // 0. Initial Baseline & Leaves check
    console.log('--- BASELINE & LEAVES STATE CHECK ---');
    const { data: initialLeaves } = await supabaseAdmin.from('leaves').select('id, employee, duration, dates').eq('id', 2).single();
    assert(initialLeaves && initialLeaves.employee === 'BOM_STORE', 'Legacy public.leaves BOM_STORE row 2 exists');
    const initialLeavesDates = initialLeaves.dates;

    // Clean up any stale test record
    await apiFetch(`/api/boms/${testBomCode}`, { method: 'DELETE' });
    await supabaseAdmin.from('bom_orders').delete().or(`id.eq.${testBomCode},bom_code.eq.${testBomCode}`);

    // 1. Workflow 1: BOM Creation with normalized payload
    console.log('\n--- WORKFLOW 1: BOM CREATION ---');
    const createRes = await apiFetch('/api/boms', {
      method: 'POST',
      headers: testHeaders,
      body: JSON.stringify({
        bom: {
          bomCode: testBomCode,
          code: testBomCode,
          customerName: 'D5 Workflow Test Enterprise',
          companyName: 'D5 Solar Industries',
          mobile: '9876543210',
          email: 'd5test@businz.local',
          status: 'Draft',
          subTotal: 50000,
          gstAmount: 9000,
          grandTotal: 59000,
          items: [
            { name: 'Solar Module Mid Clamp 35mm', qty: 100, rate: 250, code: 'MC-35' },
            { name: 'Solar Module End Clamp 35mm', qty: 50, rate: 180, code: 'EC-35' }
          ]
        },
        isNew: true
      })
    });

    assert(createRes.status === 200 && createRes.data.success, 'BOM created via POST /api/boms');
    
    // Read from DB
    const { data: createdRow } = await supabaseAdmin.from('bom_orders').select('*').eq('bom_code', testBomCode).single();
    assert(createdRow && createdRow.customer_name === 'D5 Workflow Test Enterprise', 'BOM verified in public.bom_orders');
    assert(createdRow.items?.length === 2, 'BOM items correctly saved (2 items)');

    // 2. Workflow 2: Payment Document Upload & Linking
    console.log('\n--- WORKFLOW 2: PAYMENT DOCUMENT UPLOAD & VIEW ---');
    const payContent = 'D5 Workflow Payment Slip Content ' + Date.now();
    const payB64 = Buffer.from(payContent).toString('base64');
    const payUpload = await apiFetch(`/api/boms/${testBomCode}/documents`, {
      method: 'POST',
      headers: testHeaders,
      body: JSON.stringify({
        fileName: 'workflow_receipt.pdf',
        mimeType: 'application/pdf',
        fileData: payB64,
        category: 'payment-proof'
      })
    });
    assert(payUpload.status === 200 && payUpload.data.success, 'Payment document uploaded to private storage');
    const payMeta = payUpload.data.metadata;
    assert(payMeta.storageBucket === BUCKET_NAME, 'Metadata bucket is bom-documents');

    // Link in BOM
    const linkPayRes = await apiFetch('/api/boms', {
      method: 'POST',
      headers: testHeaders,
      body: JSON.stringify({
        bom: {
          bomCode: testBomCode,
          paymentProofDoc: payMeta,
          payments: {
            proofDoc: payMeta.originalName,
            proofDocObj: payMeta,
            paymentUpdated: true
          }
        },
        isUpdate: true
      })
    });
    assert(linkPayRes.status === 200, 'Payment metadata linked to BOM');

    // View via signed URL
    const signedUrlRes = await apiFetch(`/api/boms/${testBomCode}/documents/signed-url?storagePath=${encodeURIComponent(payMeta.storagePath)}`, {
      headers: testHeaders
    });
    assert(signedUrlRes.status === 200 && signedUrlRes.data.signedUrl, 'Signed URL resolved');
    const payFetch = await fetch(signedUrlRes.data.signedUrl);
    assert((await payFetch.text()) === payContent, 'Downloaded file content matches uploaded content');

    // 3. Workflow 3: Sales Confirmation Flow
    console.log('\n--- WORKFLOW 3: SALES CONFIRMATION FLOW ---');
    const salesConfirmRes = await apiFetch('/api/boms', {
      method: 'POST',
      headers: testHeaders,
      body: JSON.stringify({
        bom: {
          bomCode: testBomCode,
          status: 'Sales Confirmed - Sent to Dispatch',
          salesConfirmed: true,
          salesConfirmedAt: new Date().toISOString()
        },
        isUpdate: true
      })
    });
    assert(salesConfirmRes.status === 200, 'Sales confirmation updated status');
    const { data: salesRow } = await supabaseAdmin.from('bom_orders').select('*').eq('bom_code', testBomCode).single();
    assert(salesRow.sales_confirmed === true, 'sales_confirmed boolean verified in database');
    assert(salesRow.status === 'Sales Confirmed - Sent to Dispatch', 'status verified in database');

    // 4. Workflow 4: Dispatch Packing & Loading Media
    console.log('\n--- WORKFLOW 4: DISPATCH MEDIA (PHOTOS & VIDEOS) ---');
    const mediaContent = 'D5 Dispatch Photo Binary Payload ' + Date.now();
    const mediaB64 = Buffer.from(mediaContent).toString('base64');
    const mediaUpload = await apiFetch(`/api/boms/${testBomCode}/documents`, {
      method: 'POST',
      headers: testHeaders,
      body: JSON.stringify({
        fileName: 'dispatch_packing_box.jpg',
        mimeType: 'image/jpeg',
        fileData: mediaB64,
        category: 'dispatch/images'
      })
    });
    assert(mediaUpload.status === 200 && mediaUpload.data.success, 'Dispatch packing image uploaded');
    const mediaMeta = mediaUpload.data.metadata;

    // Save dispatch media into BOM
    const dispatchSaveRes = await apiFetch('/api/boms', {
      method: 'POST',
      headers: testHeaders,
      body: JSON.stringify({
        bom: {
          bomCode: testBomCode,
          dispatchPackingMedia: {
            photos: [mediaMeta],
            videos: []
          }
        },
        isUpdate: true
      })
    });
    assert(dispatchSaveRes.status === 200, 'Dispatch media saved in BOM');

    const { data: dispatchRow } = await supabaseAdmin.from('bom_orders').select('*').eq('bom_code', testBomCode).single();
    const ed = dispatchRow.accounts_verification?._extra_data;
    assert(ed && ed.dispatchPackingMedia && ed.dispatchPackingMedia.photos?.length === 1, 'Dispatch media verified in DB extra_data');
    assert(!ed.dispatchPackingMedia.photos[0].dataUrl, 'Dispatch media photo has NO dataUrl');

    // 5. Clean up test files from Storage
    await apiFetch(`/api/boms/${testBomCode}/documents`, {
      method: 'DELETE',
      headers: testHeaders,
      body: JSON.stringify({ storagePath: payMeta.storagePath })
    });
    await apiFetch(`/api/boms/${testBomCode}/documents`, {
      method: 'DELETE',
      headers: testHeaders,
      body: JSON.stringify({ storagePath: mediaMeta.storagePath })
    });

    // 6. Workflow 5: Atomic Single-Record Deletion
    console.log('\n--- WORKFLOW 5: ATOMIC BOM DELETION ---');
    const delRes = await apiFetch(`/api/boms/${testBomCode}`, {
      method: 'DELETE',
      headers: testHeaders
    });
    assert(delRes.status === 200 && delRes.data.success, 'BOM deleted via DELETE /api/boms/:id');

    const { data: deletedCheck } = await supabaseAdmin.from('bom_orders').select('id').eq('bom_code', testBomCode);
    assert(deletedCheck && deletedCheck.length === 0, 'Test BOM completely removed from public.bom_orders');

    // 7. Network / Egress & Leaves Verification
    console.log('\n--- VERIFY ZERO LEAVES WRITES & DATA INTEGRITY ---');
    const { data: finalLeaves } = await supabaseAdmin.from('leaves').select('id, employee, duration, dates').eq('id', 2).single();
    assert(finalLeaves && finalLeaves.employee === 'BOM_STORE', 'public.leaves BOM_STORE row 2 exists');
    assert(finalLeaves.dates === initialLeavesDates, 'public.leaves BOM_STORE timestamp UNTOUCHED throughout all workflows');

    const { count: finalRowCount } = await supabaseAdmin.from('bom_orders').select('*', { count: 'exact', head: true });
    assert(finalRowCount === 53, `Final bom_orders count safely restored to exactly 53 (actual: ${finalRowCount})`);

    console.log('\n====================================================');
    console.log(`🎉 ALL ${passed} D5 WORKFLOW TESTS PASSED!`);
    console.log('====================================================');

  } catch (err) {
    console.error('\n❌ D5 WORKFLOW TEST SUITE FAILED:', err.message);
    process.exit(1);
  }
}

runD5Workflows();
