import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createClient } from '@supabase/supabase-js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const anonKey = process.env.VITE_SUPABASE_ANON_KEY;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!serviceRoleKey) {
  console.error('Missing SUPABASE_SERVICE_ROLE_KEY in .env');
  process.exit(1);
}

const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);
const supabaseAnon = createClient(supabaseUrl, anonKey);

const BUCKET_NAME = 'bom-documents';
const BASE_URL = 'http://localhost:5001';

async function runD4Tests() {
  console.log('====================================================');
  console.log('🚀 BUSINZ PHASE D4 — DOCUMENT UPLOADS CUTOVER TEST SUITE');
  console.log('====================================================\n');

  let passed = 0;
  let total = 0;

  function assert(condition, testName) {
    total++;
    if (condition) {
      console.log(`  ✅ [PASS ${total}] ${testName}`);
      passed++;
    } else {
      console.error(`  ❌ [FAIL ${total}] ${testName}`);
      throw new Error(`Assertion failed: ${testName}`);
    }
  }

  const testBomCode = 'BOM-TEST-D4';
  const testHeaders = {
    'Content-Type': 'application/json',
    'x-admin-key': serviceRoleKey
  };

  // Helper for API fetch
  async function apiFetch(url, options = {}) {
    const res = await fetch(`${BASE_URL}${url}`, options);
    const data = await res.json().catch(() => ({}));
    return { status: res.status, ok: res.ok, data };
  }

  try {
    // ----------------------------------------------------
    // PRE-TEST VERIFICATION
    // ----------------------------------------------------
    console.log('--- PRE-TEST: DATABASE & STORAGE BASELINE ---');

    // Find all objects recursively
    async function listAllObjects(prefix = '') {
      let results = [];
      const { data: items } = await supabaseAdmin.storage.from(BUCKET_NAME).list(prefix);
      for (const it of (items || [])) {
        const itemPath = prefix ? `${prefix}/${it.name}` : it.name;
        if (it.id) {
          results.push(itemPath);
        } else {
          const sub = await listAllObjects(itemPath);
          results = results.concat(sub);
        }
      }
      return results;
    }

    // Clean up any stale test BOM or test objects before baseline assertion
    await apiFetch(`/api/boms/${testBomCode}`, { method: 'DELETE' });
    await supabaseAdmin.from('bom_orders').delete().or(`id.eq.${testBomCode},bom_code.eq.${testBomCode}`);
    const staleTestObjects = (await listAllObjects()).filter(p => p.startsWith(testBomCode));
    if (staleTestObjects.length > 0) {
      await supabaseAdmin.storage.from(BUCKET_NAME).remove(staleTestObjects);
    }

    const { data: initialRows } = await supabaseAdmin.from('bom_orders').select('*');
    assert(initialRows && initialRows.length === 53, `Initial bom_orders has exactly 53 rows (actual: ${initialRows?.length})`);

    const baselineObjects = await listAllObjects();
    assert(baselineObjects.length === 10, `Initial bom-documents bucket has exactly 10 real objects (actual: ${baselineObjects.length})`);

    // ----------------------------------------------------
    // STEP 14: END-TO-END PAYMENT PROOF TEST
    // ----------------------------------------------------
    console.log('\n--- STEP 14: PAYMENT PROOF CUTOVER TEST ---');

    // 1. Upload payment proof
    const paymentContent = 'Phase D4 Payment Proof Synthetic Content - ' + Date.now();
    const paymentB64 = Buffer.from(paymentContent).toString('base64');
    const paymentUpload = await apiFetch(`/api/boms/${testBomCode}/documents`, {
      method: 'POST',
      headers: testHeaders,
      body: JSON.stringify({
        fileName: 'payment_slip_test.pdf',
        mimeType: 'application/pdf',
        fileData: paymentB64,
        category: 'payment-proof'
      })
    });

    assert(paymentUpload.status === 200, 'Payment proof upload returned 200 OK');
    assert(paymentUpload.data.success === true, 'Payment proof upload data.success is true');
    const payMeta = paymentUpload.data.metadata;
    assert(payMeta.storageBucket === BUCKET_NAME, 'Metadata bucket matches bom-documents');
    assert(payMeta.storagePath.startsWith(`${testBomCode}/payment-proof/`), `Metadata storagePath starts with ${testBomCode}/payment-proof/`);
    assert(payMeta.mimeType === 'application/pdf' || payMeta.type === 'application/pdf', 'Metadata mimeType/type is application/pdf');

    // 2. Verify Storage object actually exists
    const { data: payObjCheck, error: payObjErr } = await supabaseAdmin.storage.from(BUCKET_NAME).download(payMeta.storagePath);
    assert(!payObjErr && payObjCheck, 'Storage object exists and is downloadable via admin client');

    // 3. Save into synthetic BOM record
    const syntheticBom = {
      bomCode: testBomCode,
      code: testBomCode,
      customerName: 'D4 Synthetic Test Customer',
      status: 'Payment Uploaded & Verified',
      paymentProofDoc: payMeta,
      payments: {
        proofDoc: payMeta.originalName,
        proofDocObj: payMeta,
        paymentUpdated: true
      },
      items: [{ name: 'Test Solar Clamp', qty: 10, rate: 100 }]
    };

    const saveBomRes = await apiFetch('/api/boms', {
      method: 'POST',
      headers: testHeaders,
      body: JSON.stringify({ bom: syntheticBom, isNew: true })
    });
    assert(saveBomRes.status === 200 && saveBomRes.data.success, 'BOM record created with canonical payment metadata');

    // 4. Verify in Database: metadata stored, 0 Base64
    const { data: dbBomRow } = await supabaseAdmin.from('bom_orders').select('*').eq('bom_code', testBomCode).single();
    assert(dbBomRow && dbBomRow.payment_proof_doc, 'DB bom_orders contains payment_proof_doc');
    const payDocDb = typeof dbBomRow.payment_proof_doc === 'string' ? JSON.parse(dbBomRow.payment_proof_doc) : dbBomRow.payment_proof_doc;
    assert(payDocDb && payDocDb.storageBucket === BUCKET_NAME, 'DB payment_proof_doc contains storageBucket');
    assert(!payDocDb.dataUrl, 'DB payment_proof_doc has NO dataUrl');
    assert(!payDocDb.fileData, 'DB payment_proof_doc has NO fileData');
    assert(!dbBomRow.payments?.proofDocData, 'DB payments has NO proofDocData');

    // 5. Resolver obtains signed URL and file opens correctly
    const signedUrlRes = await apiFetch(`/api/boms/${testBomCode}/documents/signed-url?storagePath=${encodeURIComponent(payMeta.storagePath)}`, {
      headers: testHeaders
    });
    assert(signedUrlRes.status === 200 && signedUrlRes.data.signedUrl, 'Resolver returned signed URL');
    const fileFetch = await fetch(signedUrlRes.data.signedUrl);
    assert(fileFetch.status === 200, 'Signed URL opened successfully via HTTP GET (200 OK)');
    const fileFetchedText = await fileFetch.text();
    assert(fileFetchedText === paymentContent, 'Fetched file content matches original upload');

    // 6. Replacement safety test
    const newPaymentContent = 'Phase D4 New Replacement Payment Content - ' + Date.now();
    const newPaymentB64 = Buffer.from(newPaymentContent).toString('base64');
    const replaceUpload = await apiFetch(`/api/boms/${testBomCode}/documents`, {
      method: 'POST',
      headers: testHeaders,
      body: JSON.stringify({
        fileName: 'payment_slip_replacement.pdf',
        mimeType: 'application/pdf',
        fileData: newPaymentB64,
        category: 'payment-proof'
      })
    });
    assert(replaceUpload.status === 200 && replaceUpload.data.metadata, 'New replacement payment proof uploaded first');
    const newPayMeta = replaceUpload.data.metadata;

    // Verify downloadable
    const newSignedUrlRes = await apiFetch(`/api/boms/${testBomCode}/documents/signed-url?storagePath=${encodeURIComponent(newPayMeta.storagePath)}`, {
      headers: testHeaders
    });
    assert(newSignedUrlRes.status === 200 && newSignedUrlRes.data.signedUrl, 'New replacement file verified downloadable');

    // Update BOM in DB with new metadata
    syntheticBom.paymentProofDoc = newPayMeta;
    syntheticBom.payments.proofDocObj = newPayMeta;
    await apiFetch('/api/boms', {
      method: 'POST',
      headers: testHeaders,
      body: JSON.stringify({ bom: syntheticBom, isUpdate: true })
    });

    // ONLY THEN delete obsolete old object
    const deleteOldRes = await apiFetch('/api/boms/' + testBomCode + '/documents', {
      method: 'DELETE',
      headers: testHeaders,
      body: JSON.stringify({ storagePath: payMeta.storagePath })
    });
    assert(deleteOldRes.status === 200 && deleteOldRes.data.success, 'Obsolete payment proof deleted safely after replacement');

    // Verify old object gone from storage list and signed URL fails
    const oldFolder = path.dirname(payMeta.storagePath);
    const oldFileName = path.basename(payMeta.storagePath);
    const { data: oldFolderList } = await supabaseAdmin.storage.from(BUCKET_NAME).list(oldFolder);
    const oldExists = (oldFolderList || []).some(f => f.name === oldFileName);
    assert(!oldExists, 'Old payment proof object is successfully removed');
    const { data: newCheckData } = await supabaseAdmin.storage.from(BUCKET_NAME).download(newPayMeta.storagePath);
    assert(Boolean(newCheckData), 'New replacement payment proof remains safely in storage');

    // Clean up replacement payment object
    await apiFetch('/api/boms/' + testBomCode + '/documents', {
      method: 'DELETE',
      headers: testHeaders,
      body: JSON.stringify({ storagePath: newPayMeta.storagePath })
    });

    // ----------------------------------------------------
    // STEP 15: DELIVERY PROOF CUTOVER TEST
    // ----------------------------------------------------
    console.log('\n--- STEP 15: DELIVERY PROOF CUTOVER TEST ---');
    const deliveryContent = 'Phase D4 Delivery Proof Synthetic Content - ' + Date.now();
    const deliveryB64 = Buffer.from(deliveryContent).toString('base64');
    const delUpload = await apiFetch(`/api/boms/${testBomCode}/documents`, {
      method: 'POST',
      headers: testHeaders,
      body: JSON.stringify({
        fileName: 'delivery_address_proof.jpg',
        mimeType: 'image/jpeg',
        fileData: deliveryB64,
        category: 'delivery-proof'
      })
    });
    assert(delUpload.status === 200 && delUpload.data.success, 'Delivery proof uploaded successfully');
    const delMeta = delUpload.data.metadata;
    assert(delMeta.storagePath.startsWith(`${testBomCode}/delivery-proof/`), 'Delivery proof stored in <BOM-CODE>/delivery-proof/');

    // Update DB
    syntheticBom.deliveryAddressProofDoc = delMeta;
    await apiFetch('/api/boms', {
      method: 'POST',
      headers: testHeaders,
      body: JSON.stringify({ bom: syntheticBom, isUpdate: true })
    });

    const { data: dbDelBom } = await supabaseAdmin.from('bom_orders').select('*').eq('bom_code', testBomCode).single();
    const delDocDb = typeof dbDelBom.delivery_address_proof_doc === 'string' ? JSON.parse(dbDelBom.delivery_address_proof_doc) : dbDelBom.delivery_address_proof_doc;
    assert(delDocDb && delDocDb.storageBucket === BUCKET_NAME, 'Delivery proof stored as canonical metadata in DB');
    assert(!delDocDb.dataUrl, 'Delivery proof contains 0 Base64 dataUrl');

    // Verify view via resolver
    const delSignedUrl = await apiFetch(`/api/boms/${testBomCode}/documents/signed-url?storagePath=${encodeURIComponent(delMeta.storagePath)}`, {
      headers: testHeaders
    });
    assert(delSignedUrl.status === 200 && delSignedUrl.data.signedUrl, 'Delivery proof resolved via signed URL');
    const delFetch = await fetch(delSignedUrl.data.signedUrl);
    assert((await delFetch.text()) === deliveryContent, 'Delivery proof signed URL content verified');

    // Clean up delivery proof object
    await apiFetch('/api/boms/' + testBomCode + '/documents', {
      method: 'DELETE',
      headers: testHeaders,
      body: JSON.stringify({ storagePath: delMeta.storagePath })
    });

    // ----------------------------------------------------
    // STEP 16: DISPATCH MEDIA CUTOVER TEST
    // ----------------------------------------------------
    console.log('\n--- STEP 16: DISPATCH MEDIA CUTOVER TEST (IMAGES & VIDEOS) ---');
    // Dispatch Image
    const imgContent = 'Phase D4 Dispatch Packing Image Payload - ' + Date.now();
    const imgB64 = Buffer.from(imgContent).toString('base64');
    const imgUpload = await apiFetch(`/api/boms/${testBomCode}/documents`, {
      method: 'POST',
      headers: testHeaders,
      body: JSON.stringify({
        fileName: 'dispatch_packed_box.jpg',
        mimeType: 'image/jpeg',
        fileData: imgB64,
        category: 'dispatch/images'
      })
    });
    assert(imgUpload.status === 200 && imgUpload.data.success, 'Dispatch image uploaded successfully');
    const imgMeta = imgUpload.data.metadata;
    assert(imgMeta.storagePath.startsWith(`${testBomCode}/dispatch/images/`), 'Dispatch image path starts with <BOM-CODE>/dispatch/images/');

    // Dispatch Video
    const videoContent = 'Phase D4 Dispatch Video Payload - ' + Date.now();
    const videoB64 = Buffer.from(videoContent).toString('base64');
    const videoUpload = await apiFetch(`/api/boms/${testBomCode}/documents`, {
      method: 'POST',
      headers: testHeaders,
      body: JSON.stringify({
        fileName: 'dispatch_loading_video.mp4',
        mimeType: 'video/mp4',
        fileData: videoB64,
        category: 'dispatch/videos'
      })
    });
    assert(videoUpload.status === 200 && videoUpload.data.success, 'Dispatch video uploaded successfully');
    const videoMeta = videoUpload.data.metadata;
    assert(videoMeta.storagePath.startsWith(`${testBomCode}/dispatch/videos/`), 'Dispatch video path starts with <BOM-CODE>/dispatch/videos/');

    // Save dispatch media into DB BOM
    syntheticBom.dispatchPackingMedia = {
      photos: [imgMeta],
      videos: [videoMeta]
    };
    await apiFetch('/api/boms', {
      method: 'POST',
      headers: testHeaders,
      body: JSON.stringify({ bom: syntheticBom, isUpdate: true })
    });

    const { data: dbDispatchBom } = await supabaseAdmin.from('bom_orders').select('*').eq('bom_code', testBomCode).single();
    const dispatchMediaObj = dbDispatchBom?.dispatch_packing_media || dbDispatchBom?.accounts_verification?._extra_data?.dispatchPackingMedia;
    assert(dispatchMediaObj && dispatchMediaObj.photos?.length === 1, 'DB contains 1 dispatch photo');
    assert(dispatchMediaObj && dispatchMediaObj.videos?.length === 1, 'DB contains 1 dispatch video');
    assert(!dispatchMediaObj.photos[0].dataUrl, 'Dispatch photo contains NO dataUrl');
    assert(!dispatchMediaObj.videos[0].dataUrl, 'Dispatch video contains NO dataUrl');

    // Clean up dispatch media test files
    await apiFetch('/api/boms/' + testBomCode + '/documents', {
      method: 'DELETE',
      headers: testHeaders,
      body: JSON.stringify({ storagePath: imgMeta.storagePath })
    });
    await apiFetch('/api/boms/' + testBomCode + '/documents', {
      method: 'DELETE',
      headers: testHeaders,
      body: JSON.stringify({ storagePath: videoMeta.storagePath })
    });

    // ----------------------------------------------------
    // STEP 17: FAILURE AND SECURITY TESTS
    // ----------------------------------------------------
    console.log('\n--- STEP 17: FAILURE & SECURITY BOUNDARY TESTS ---');

    // 1. Unsupported MIME
    const badMime = await apiFetch(`/api/boms/${testBomCode}/documents`, {
      method: 'POST',
      headers: testHeaders,
      body: JSON.stringify({
        fileName: 'malicious.exe',
        mimeType: 'application/x-msdownload',
        fileData: Buffer.from('bad').toString('base64'),
        category: 'payment-proof'
      })
    });
    assert(badMime.status === 400, 'Unsupported MIME type rejected with 400 Bad Request');

    // 2. Invalid category
    const badCategory = await apiFetch(`/api/boms/${testBomCode}/documents`, {
      method: 'POST',
      headers: testHeaders,
      body: JSON.stringify({
        fileName: 'test.png',
        mimeType: 'image/png',
        fileData: Buffer.from('test').toString('base64'),
        category: 'malicious-folder'
      })
    });
    assert(badCategory.status === 400, 'Invalid category rejected with 400 Bad Request');

    // 3. Unauthenticated request (no session header)
    const unauth = await apiFetch(`/api/boms/${testBomCode}/documents`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fileName: 'test.png',
        mimeType: 'image/png',
        fileData: Buffer.from('test').toString('base64'),
        category: 'payment-proof'
      })
    });
    assert(unauth.status === 401, 'Unauthenticated upload rejected with 401 Unauthorized');

    // 4. Cross-BOM signed URL access attempt
    const crossBom = await apiFetch(`/api/boms/BOM-9999/documents/signed-url?storagePath=BOM-001/payment-proof/secret.pdf`, {
      headers: testHeaders
    });
    assert(crossBom.status === 403, 'Cross-BOM storage path access rejected with 403 Forbidden');

    // 5. Path traversal attempt
    const pathTraversal = await apiFetch(`/api/boms/${testBomCode}/documents/signed-url?storagePath=${encodeURIComponent('../../../etc/passwd')}`, {
      headers: testHeaders
    });
    assert(pathTraversal.status === 403 || pathTraversal.status === 400, 'Path traversal rejected with 400/403');

    // 6. Direct browser/anon Storage write blocked
    const anonUploadRes = await supabaseAnon.storage.from(BUCKET_NAME).upload('direct-anon-hack.txt', 'hacked');
    assert(Boolean(anonUploadRes.error), 'Direct browser anonymous Storage upload is BLOCKED (401/403)');

    // 7. Direct browser/anon Storage read blocked
    const anonDownloadRes = await supabaseAnon.storage.from(BUCKET_NAME).download('BOM-736/payment-proof/payment_slip.jpg');
    assert(Boolean(anonDownloadRes.error), 'Direct browser anonymous Storage download without signed URL is BLOCKED');

    // 8. Public URL access denied
    const { data: publicUrlData } = supabaseAnon.storage.from(BUCKET_NAME).getPublicUrl('BOM-736/payment-proof/payment_slip.jpg');
    const pubFetch = await fetch(publicUrlData.publicUrl);
    assert(!pubFetch.ok, 'Storage bucket public URL access returns error/denied');

    // 9. Zero-Base64 Write Enforcement in toDatabaseBomRow
    console.log('\n--- STEP 13: ZERO-BASE64 WRITE ENFORCEMENT TEST ---');
    const hackBase64Payload = 'data:image/png;base64,' + Buffer.from('fake image data').toString('base64');
    const bomWithAccidentalB64 = {
      ...syntheticBom,
      paymentProofDoc: {
        name: 'accidental.png',
        dataUrl: hackBase64Payload
      },
      deliveryAddressProofDoc: {
        name: 'accidental_addr.png',
        fileData: hackBase64Payload
      }
    };
    await apiFetch('/api/boms', {
      method: 'POST',
      headers: testHeaders,
      body: JSON.stringify({ bom: bomWithAccidentalB64, isUpdate: true })
    });

    const { data: sanitizedDbBom } = await supabaseAdmin.from('bom_orders').select('*').eq('bom_code', testBomCode).single();
    const sanitizedPayDoc = typeof sanitizedDbBom.payment_proof_doc === 'string' ? JSON.parse(sanitizedDbBom.payment_proof_doc) : sanitizedDbBom.payment_proof_doc;
    const sanitizedDelDoc = typeof sanitizedDbBom.delivery_address_proof_doc === 'string' ? JSON.parse(sanitizedDbBom.delivery_address_proof_doc) : sanitizedDbBom.delivery_address_proof_doc;
    assert(!sanitizedPayDoc || !sanitizedPayDoc.dataUrl, 'Server-side sanitizer stripped accidental dataUrl from payment_proof_doc');
    assert(!sanitizedDelDoc || !sanitizedDelDoc.fileData, 'Server-side sanitizer stripped accidental fileData from delivery_address_proof_doc');

    // ----------------------------------------------------
    // CLEANUP SYNTHETIC TEST BOM
    // ----------------------------------------------------
    console.log('\n--- CLEANING UP SYNTHETIC TEST ARTIFACTS ---');
    await supabaseAdmin.from('bom_orders').delete().eq('bom_code', testBomCode);
    const { data: verifyCleanBom } = await supabaseAdmin.from('bom_orders').select('id').eq('bom_code', testBomCode);
    assert(verifyCleanBom.length === 0, 'Synthetic test BOM completely deleted from database');

    // ----------------------------------------------------
    // STEP 18: DATABASE AUDIT AFTER D4 TESTS
    // ----------------------------------------------------
    console.log('\n--- STEP 18: DATABASE AUDIT AFTER D4 TESTS ---');
    const { data: finalRows } = await supabaseAdmin.from('bom_orders').select('*');
    assert(finalRows.length === 53, `Final bom_orders row count is exactly 53 (actual: ${finalRows.length})`);

    // Scan all 53 rows for active Base64
    let activeB64Count = 0;
    function scanVal(val) {
      if (!val) return;
      if (typeof val === 'string') {
        const t = val.trim();
        if (t.startsWith('data:image/') || t.startsWith('data:application/') || t.startsWith('data:video/')) {
          activeB64Count++;
        }
      } else if (typeof val === 'object') {
        for (const k of Object.keys(val)) {
          scanVal(val[k]);
        }
      }
    }
    for (const r of finalRows) {
      scanVal(r.payment_proof_doc);
      scanVal(r.delivery_address_proof_doc);
      scanVal(r.payments);
      scanVal(r.dispatch_packing_media);
      scanVal(r.vehicle_loading);
    }
    assert(activeB64Count === 0, `Active Base64 documents across all 53 real BOM records is 0 (actual: ${activeB64Count})`);

    // ----------------------------------------------------
    // STEP 19: STORAGE AUDIT
    // ----------------------------------------------------
    console.log('\n--- STEP 19: STORAGE AUDIT ---');
    const finalObjects = await listAllObjects();
    assert(finalObjects.length === 10, `bom-documents bucket has exactly 10 real objects intact (actual: ${finalObjects.length})`);
    assert(finalObjects.every(p => !p.startsWith('BOM-TEST')), 'Zero synthetic test objects remaining in bucket');

    // ----------------------------------------------------
    // STEP 20: PAYLOAD CHECK
    // ----------------------------------------------------
    console.log('\n--- STEP 20: PAYLOAD CHECK ---');
    const payloadBytes = Buffer.byteLength(JSON.stringify(finalRows), 'utf8');
    console.log(`  📊 Final public.bom_orders serialized payload: ${payloadBytes.toLocaleString()} bytes (D3 baseline: 290,368 bytes)`);
    assert(payloadBytes <= 320000, `Payload size remains compact (${payloadBytes} bytes)`);

    // ----------------------------------------------------
    // ROLLBACK & INTEGRITY VERIFICATION
    // ----------------------------------------------------
    console.log('\n--- ROLLBACK & INTEGRITY SAFEGUARDS ---');
    const { data: leavesFinal } = await supabaseAdmin.from('leaves').select('*').eq('id', 2).single();
    assert(leavesFinal && leavesFinal.type === 'Store', 'public.leaves BOM_STORE (row 2) remains untouched');
    assert(fs.existsSync(path.resolve(__dirname, '../server/bom_store.json')), 'server/bom_store.json remains untouched');

    console.log('\n====================================================');
    console.log(`🎉 PHASE D4 TEST SUITE COMPLETE: ${passed}/${total} PASSED (100%)`);
    console.log('====================================================');
  } catch (err) {
    console.error('\n❌ TEST SUITE FAILED:', err.message);
    process.exit(1);
  }
}

runD4Tests();
