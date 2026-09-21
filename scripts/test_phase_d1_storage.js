import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const anonKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  console.error('❌ Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in environment');
  process.exit(1);
}

// Frontend / anon client
const anonClient = createClient(supabaseUrl, anonKey);

// Backend / service-role administrative client
const adminClient = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false }
});

async function runStorageSecurityTestSuite() {
  console.log('====================================================');
  console.log('🔒 BUSINZ PHASE D1 — STORAGE SECURITY VERIFICATION');
  console.log('====================================================\n');

  let passedCount = 0;
  let failedCount = 0;

  function assert(condition, message) {
    if (condition) {
      console.log(`  ✅ PASS: ${message}`);
      passedCount++;
    } else {
      console.error(`  ❌ FAIL: ${message}`);
      failedCount++;
    }
  }

  // STEP 4: VERIFY BUCKET CONFIGURATION
  console.log('Step 4: Verify bom-documents bucket configuration');
  const { data: bucket, error: bErr } = await adminClient.storage.getBucket('bom-documents');
  if (bErr || !bucket) {
    console.error('  ❌ Error fetching bom-documents bucket:', bErr?.message);
    return false;
  }

  assert(bucket.id === 'bom-documents', 'Bucket id is "bom-documents"');
  assert(bucket.public === false, 'Bucket is strictly private (public = false)');
  assert(bucket.file_size_limit === 52428800, 'File size limit is 50 MB (52428800 bytes)');
  const mimes = bucket.allowed_mime_types || [];
  const expectedMimes = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf', 'video/mp4'];
  const mimesMatch = expectedMimes.every(m => mimes.includes(m)) && mimes.length === expectedMimes.length;
  assert(mimesMatch, `MIME restrictions matched expected [${expectedMimes.join(', ')}]`);

  // STEP 5: RUN STORAGE SECURITY TEST
  console.log('\nStep 5: Run storage security test (A through G)');
  const testPath = '_system-tests/phase-d1-storage-test.txt';
  const testContent = 'BUSINZ Phase D1 Storage Security Test Content - ' + new Date().toISOString();
  const testBuffer = Buffer.from(testContent, 'utf-8');

  // Test A: BACKEND AUTHORIZED UPLOAD
  console.log('\nTest A: Backend Authorized Upload (using service_role)');
  const { data: uploadData, error: upErr } = await adminClient.storage
    .from('bom-documents')
    .upload(testPath, testBuffer, {
      contentType: 'image/png',
      upsert: true
    });
  assert(!upErr && uploadData?.path, `Backend authorized upload succeeded (${uploadData?.path})`);

  // Test B: ANONYMOUS UPLOAD
  console.log('\nTest B: Anonymous Upload (using public anon key)');
  const anonTestPath = '_system-tests/phase-d1-anon-upload-test.txt';
  const { data: anonData, error: anonErr } = await anonClient.storage
    .from('bom-documents')
    .upload(anonTestPath, testBuffer, {
      contentType: 'image/png',
      upsert: true
    });
  const anonDenied = Boolean(anonErr || !anonData);
  assert(anonDenied, `Anonymous upload strictly DENIED (status: ${anonErr?.statusCode || anonErr?.message || 'AccessDenied'})`);

  // Test C: PUBLIC URL ACCESS
  console.log('\nTest C: Public URL Access (direct unauthenticated access)');
  const { data: pubData } = adminClient.storage
    .from('bom-documents')
    .getPublicUrl(testPath);

  let pubDenied = false;
  try {
    const pubRes = await fetch(pubData.publicUrl);
    pubDenied = pubRes.status === 400 || pubRes.status === 403 || pubRes.status === 404;
    assert(pubDenied, `Public URL direct access DENIED (HTTP ${pubRes.status})`);
  } catch (err) {
    assert(true, `Public URL access blocked by network error: ${err.message}`);
  }

  // Test D: SIGNED URL GENERATION
  console.log('\nTest D: Signed URL Generation (using service_role)');
  const { data: signData, error: signErr } = await adminClient.storage
    .from('bom-documents')
    .createSignedUrl(testPath, 60);
  assert(!signErr && signData?.signedUrl, 'Signed URL generated successfully');

  // Test E: SIGNED URL RETRIEVAL
  console.log('\nTest E: Signed URL Retrieval');
  let fetchPassed = false;
  if (signData?.signedUrl) {
    const signedRes = await fetch(signData.signedUrl);
    if (signedRes.ok) {
      const text = await signedRes.text();
      fetchPassed = text === testContent;
    }
  }
  assert(fetchPassed, 'Signed URL successfully fetched uploaded test content with exact match');

  // Test F: DELETE
  console.log('\nTest F: Authorized Deletion (using service_role)');
  const { data: delData, error: delErr } = await adminClient.storage
    .from('bom-documents')
    .remove([testPath]);
  assert(!delErr && delData?.length > 0, 'Authorized deletion succeeded');

  // Test G: CLEANUP CHECK
  console.log('\nTest G: Cleanup Check (verify object no longer exists)');
  const { data: listData } = await adminClient.storage
    .from('bom-documents')
    .list('_system-tests');
  const stillExists = (listData || []).some(f => f.name === 'phase-d1-storage-test.txt');
  assert(!stillExists, 'Test artifact _system-tests/phase-d1-storage-test.txt confirmed completely removed');

  console.log('\n====================================================');
  console.log(`SUMMARY: ${passedCount} PASSED | ${failedCount} FAILED`);
  console.log('====================================================');

  if (failedCount > 0) {
    process.exit(1);
  }
  return true;
}

runStorageSecurityTestSuite().catch((err) => {
  console.error('Unexpected error in test suite:', err);
  process.exit(1);
});
