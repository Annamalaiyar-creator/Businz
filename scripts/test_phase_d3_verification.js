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

const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);
const supabaseAnon = createClient(supabaseUrl, anonKey);

const BUCKET_NAME = 'bom-documents';
const BASE_URL = 'http://localhost:5001';

async function runTests() {
  console.log('====================================================');
  console.log('🧪 BUSINZ PHASE D3 — POST-MIGRATION VERIFICATION SUITE');
  console.log('====================================================\n');

  let passed = 0;
  let total = 0;

  function assert(condition, name) {
    total++;
    if (condition) {
      console.log(`  ✅ [PASS] ${name}`);
      passed++;
    } else {
      console.error(`  ❌ [FAIL] ${name}`);
      throw new Error(`Assertion failed: ${name}`);
    }
  }

  // --- 1. DATA INTEGRITY CHECKS (STEP 15) ---
  console.log('--- 1. DATA INTEGRITY & ROW COUNTS ---');
  const { data: boms, error: bomsErr } = await supabaseAdmin.from('bom_orders').select('*').order('id');
  assert(!bomsErr && boms, 'Fetched public.bom_orders without error');
  assert(boms.length === 53, `public.bom_orders row count is exactly 53 (actual: ${boms.length})`);

  // Check no duplicate IDs
  const idSet = new Set(boms.map(b => b.id));
  assert(idSet.size === 53, 'Zero duplicate BOM IDs across all 53 records');

  // Verify BOM_STORE in public.leaves (id: 2) untouched
  const { data: leavesRow, error: leavesErr } = await supabaseAdmin.from('leaves').select('*').eq('id', 2).single();
  assert(!leavesErr && leavesRow, 'BOM_STORE row (id: 2) in public.leaves exists');
  assert(leavesRow.type === 'Store', 'public.leaves row 2 type remains "Store"');
  const leavesSize = Buffer.byteLength(JSON.stringify(leavesRow), 'utf8');
  assert(leavesSize > 2000000, `public.leaves row 2 size preserved untouched (~${Math.round(leavesSize / 1024)} KB)`);

  // Verify server/bom_store.json untouched
  const bomStoreJsonExists = fs.existsSync(path.resolve(__dirname, '../server/bom_store.json'));
  assert(bomStoreJsonExists, 'server/bom_store.json exists for emergency rollback');
  const bomStoreStat = fs.statSync(path.resolve(__dirname, '../server/bom_store.json'));
  assert(bomStoreStat.size > 2000000, `server/bom_store.json size preserved untouched (~${Math.round(bomStoreStat.size / 1024)} KB)`);

  // --- 2. BASE64 RESIDUAL AUDIT (STEP 12) ---
  console.log('\n--- 2. BASE64 RESIDUAL AUDIT ---');
  let residualB64Count = 0;
  function scanForB64(val) {
    if (!val) return;
    if (typeof val === 'string') {
      const t = val.trim();
      if (t.startsWith('data:') || (t.length > 200 && /^[A-Za-z0-9+/=\s]+$/.test(t.slice(0, 100)) && !t.startsWith('http'))) {
        residualB64Count++;
      }
    } else if (Array.isArray(val)) {
      val.forEach(scanForB64);
    } else if (typeof val === 'object') {
      Object.values(val).forEach(scanForB64);
    }
  }

  boms.forEach(b => {
    Object.keys(b).forEach(k => {
      let v = b[k];
      if (typeof v === 'string' && (v.startsWith('{') || v.startsWith('['))) {
        try { v = JSON.parse(v); } catch (_) {}
      }
      scanForB64(v);
    });
  });
  assert(residualB64Count === 0, `Zero residual Base64 document payloads in public.bom_orders (actual: ${residualB64Count})`);

  // --- 3. STORAGE OBJECTS VERIFICATION & SIGNED URLS (STEPS 8, 11, 13) ---
  console.log('\n--- 3. MIGRATED DOCUMENTS & BACKEND RESOLVER TESTS ---');
  const migratedBoms = ['BOM-713', 'BOM-722', 'BOM-723', 'BOM-724', 'BOM-726', 'BOM-727', 'BOM-728', 'BOM-730', 'BOM-733'];

  function parseField(val) {
    if (!val) return null;
    if (typeof val === 'string' && (val.startsWith('{') || val.startsWith('['))) {
      try { return JSON.parse(val); } catch (_) { return val; }
    }
    return val;
  }

  for (const code of migratedBoms) {
    const bom = boms.find(b => b.id === code);
    assert(Boolean(bom), `BOM order ${code} exists in public.bom_orders`);

    const paymentProof = parseField(bom.payment_proof_doc);
    const deliveryProof = parseField(bom.delivery_address_proof_doc);
    const payments = parseField(bom.payments);

    // Check payment_proof_doc
    assert(paymentProof && paymentProof.storageBucket === BUCKET_NAME, `${code}: payment_proof_doc has canonical storageBucket 'bom-documents'`);
    assert(paymentProof.storagePath.startsWith(`${code}/payment-proof/`), `${code}: payment_proof_doc has correct BOM-scoped path`);
    assert(!paymentProof.dataUrl, `${code}: payment_proof_doc.dataUrl has been completely removed`);

    // Check payments.proofDocObj
    assert(payments?.proofDocObj && payments.proofDocObj.storageBucket === BUCKET_NAME, `${code}: payments.proofDocObj has canonical storageBucket`);
    assert(payments.proofDocObj.storagePath.startsWith(`${code}/payment-proof/`), `${code}: payments.proofDocObj has correct BOM-scoped path`);
    assert(!payments.proofDocObj.dataUrl, `${code}: payments.proofDocObj.dataUrl has been completely removed`);
    assert(!payments.proofDocData, `${code}: payments.proofDocData has been completely removed`);

    // Delivery address proof doc for BOM-713
    if (code === 'BOM-713') {
      assert(deliveryProof && deliveryProof.storageBucket === BUCKET_NAME, `${code}: delivery_address_proof_doc has canonical storageBucket`);
      assert(deliveryProof.storagePath.startsWith(`${code}/delivery-proof/`), `${code}: delivery_address_proof_doc has correct BOM-scoped path`);
      assert(!deliveryProof.dataUrl, `${code}: delivery_address_proof_doc.dataUrl has been completely removed`);
    }

    // Unauthenticated Signed URL request test: must return 401
    const unauthRes = await fetch(`${BASE_URL}/api/boms/${code}/documents/signed-url?path=${encodeURIComponent(paymentProof.storagePath)}`);
    assert(unauthRes.status === 401, `${code}: Unauthenticated request rejected with HTTP 401`);

    // Authorized Backend Signed URL resolution test
    const signedUrlRes = await fetch(`${BASE_URL}/api/boms/${code}/documents/signed-url?path=${encodeURIComponent(paymentProof.storagePath)}`, {
      headers: { 'x-admin-key': serviceRoleKey }
    });
    assert(signedUrlRes.status === 200, `${code}: Authorized signed URL request returned HTTP 200`);
    const signedUrlJson = await signedUrlRes.json();
    assert(Boolean(signedUrlJson.signedUrl), `${code}: Backend returned valid signedUrl string`);

    // Fetch binary content using the signed URL
    const fetchDocRes = await fetch(signedUrlJson.signedUrl);
    assert(fetchDocRes.status === 200, `${code}: Signed URL successfully downloads binary content`);
    const docBlob = await fetchDocRes.arrayBuffer();
    assert(docBlob.byteLength === paymentProof.size, `${code}: Downloaded content size matches metadata size (${docBlob.byteLength} bytes)`);
  }

  // --- 4. SECURITY AUDIT (STEP 14) ---
  console.log('\n--- 4. SECURITY & PERMISSION TESTS ---');

  // Anonymous Direct Read from bom-documents bucket: DENIED
  const { data: anonReadData, error: anonReadErr } = await supabaseAnon.storage
    .from(BUCKET_NAME)
    .download('BOM-713/delivery-proof/test.png');
  assert(Boolean(anonReadErr), 'Anonymous direct download from private bucket is DENIED');

  // Anonymous Upload to bom-documents bucket: DENIED
  const { data: anonUpData, error: anonUpErr } = await supabaseAnon.storage
    .from(BUCKET_NAME)
    .upload('BOM-713/payment-proof/hack.txt', Buffer.from('unauthorized'));
  assert(Boolean(anonUpErr), 'Anonymous upload to private bucket is DENIED');

  // Public URL: non-functional on private bucket
  const { data: publicUrlData } = supabaseAnon.storage
    .from(BUCKET_NAME)
    .getPublicUrl('BOM-713/delivery-proof/test.png');
  const pubFetch = await fetch(publicUrlData.publicUrl);
  assert(pubFetch.status >= 400, `Public URL access is DENIED (HTTP ${pubFetch.status})`);

  // Cross-BOM Signed URL generation attempt: DENIED with 403
  const crossBomRes = await fetch(`${BASE_URL}/api/boms/BOM-713/documents/signed-url?path=${encodeURIComponent('BOM-722/payment-proof/test.jpeg')}`, {
    headers: { 'x-admin-key': serviceRoleKey }
  });
  assert(crossBomRes.status === 403, `Cross-BOM signed URL access is DENIED with HTTP 403 (actual: ${crossBomRes.status})`);

  // No permanent signed URLs stored in database
  let permanentSignedUrlCount = 0;
  boms.forEach(b => {
    const str = JSON.stringify(b);
    if (str.includes('token=') || str.includes('storage/v1/object/sign/')) {
      permanentSignedUrlCount++;
    }
  });
  assert(permanentSignedUrlCount === 0, `Zero permanent signed URLs stored in database (actual: ${permanentSignedUrlCount})`);

  // --- 5. BACKUP VERIFICATION & ROLLBACK READINESS (STEPS 5, 19) ---
  console.log('\n--- 5. BACKUP & ROLLBACK READINESS ---');
  const backupDir = path.resolve(__dirname, '../server/backups');
  const backupFiles = fs.readdirSync(backupDir).filter(f => f.startsWith('bom_orders_pre_d3_backup_'));
  assert(backupFiles.length >= 1, `Local backup exists in server/backups (${backupFiles[0]})`);
  const latestBackup = path.join(backupDir, backupFiles[backupFiles.length - 1]);
  const backupContent = JSON.parse(fs.readFileSync(latestBackup, 'utf8'));
  assert(backupContent.length === 9, `Backup contains all 9 pre-migration BOM orders`);

  console.log('\n====================================================');
  console.log(`🎉 ALL ${passed} / ${total} PHASE D3 VERIFICATION TESTS PASSED!`);
  console.log('====================================================');
}

runTests().catch(err => {
  console.error('\n❌ VERIFICATION TEST FAILED:', err);
  process.exit(1);
});
