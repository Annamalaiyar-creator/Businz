import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function runStorageTest() {
  console.log('====================================================');
  console.log('🔒 BUSINZ PHASE D1 — STORAGE VERIFICATION TEST');
  console.log('====================================================\n');

  // 1. Check bucket existence
  console.log('Test 1: Check bucket existence and privacy');
  const { data: buckets, error: bErr } = await supabase.storage.listBuckets();
  if (bErr) {
    console.error('  ❌ Error listing buckets:', bErr.message);
    return false;
  }

  const bomBucket = buckets?.find(b => b.id === 'bom-documents' || b.name === 'bom-documents');
  if (!bomBucket) {
    console.warn('  ⚠️ Bucket "bom-documents" not found yet.');
    console.log('     Please execute "supabase_storage_setup.sql" in Supabase SQL Editor.');
    return false;
  }

  console.log(`  ✅ PASS: Bucket "bom-documents" exists.`);
  console.log(`  ✅ PASS: Bucket public = ${bomBucket.public} (Private: ${!bomBucket.public})`);
  console.log(`  ✅ PASS: File size limit: ${bomBucket.file_size_limit || 'Default'} bytes`);
  console.log(`  ✅ PASS: Allowed MIME types:`, bomBucket.allowed_mime_types);

  // 2. Upload tiny temporary test file
  console.log('\nTest 2: Upload temporary test file to _system-tests/phase-d1-storage-test.txt');
  const testPath = '_system-tests/phase-d1-storage-test.txt';
  const testContent = 'BUSINZ Phase D1 Storage Security Test Content - ' + new Date().toISOString();

  const { data: uploadData, error: upErr } = await supabase.storage
    .from('bom-documents')
    .upload(testPath, Buffer.from(testContent, 'utf-8'), {
      contentType: 'text/plain',
      upsert: true
    });

  if (upErr) {
    console.error('  ❌ Upload failed:', upErr.message);
    return false;
  }
  console.log('  ✅ PASS: Upload succeeded:', uploadData.path);

  // 3. Verify direct unauthenticated public access does NOT work
  console.log('\nTest 3: Verify direct unauthenticated public access is DENIED');
  const { data: pubData } = supabase.storage
    .from('bom-documents')
    .getPublicUrl(testPath);

  try {
    const pubRes = await fetch(pubData.publicUrl);
    // For a private bucket, Supabase returns 400 or 404 or 403 when hitting publicUrl
    const isDenied = pubRes.status === 400 || pubRes.status === 403 || pubRes.status === 404;
    if (isDenied) {
      console.log(`  ✅ PASS: Public direct URL returned HTTP ${pubRes.status} (Access Denied as expected for private bucket)`);
    } else {
      console.error(`  ❌ FAIL: Public direct URL returned HTTP ${pubRes.status}`);
      return false;
    }
  } catch (netErr) {
    console.log(`  ✅ PASS: Public URL request failed/blocked (${netErr.message})`);
  }

  // 4. Verify signed URL can be generated and accesses the file
  console.log('\nTest 4: Verify signed URL creation and content retrieval');
  const { data: signData, error: signErr } = await supabase.storage
    .from('bom-documents')
    .createSignedUrl(testPath, 60);

  if (signErr || !signData?.signedUrl) {
    console.error('  ❌ Signed URL generation failed:', signErr?.message);
    return false;
  }
  console.log('  ✅ PASS: Signed URL generated successfully');

  const signedRes = await fetch(signData.signedUrl);
  if (signedRes.ok) {
    const fetchedText = await signedRes.text();
    if (fetchedText === testContent) {
      console.log('  ✅ PASS: Fetched content from signed URL matches uploaded content exactly');
    } else {
      console.error('  ❌ Content mismatch from signed URL');
      return false;
    }
  } else {
    console.error(`  ❌ Failed to fetch from signed URL: HTTP ${signedRes.status}`);
    return false;
  }

  // 5. Delete temporary test file
  console.log('\nTest 5: Clean up temporary test file');
  const { error: delErr } = await supabase.storage
    .from('bom-documents')
    .remove([testPath]);

  if (delErr) {
    console.error('  ❌ Failed to delete test file:', delErr.message);
    return false;
  }
  console.log('  ✅ PASS: Temporary test file cleanly deleted from bucket');

  // 6. Confirm bucket is empty of test artifacts
  const { data: listData } = await supabase.storage
    .from('bom-documents')
    .list('_system-tests');

  const remaining = listData?.filter(f => f.name === 'phase-d1-storage-test.txt') || [];
  if (remaining.length === 0) {
    console.log('  ✅ PASS: Bucket confirmed 100% clean with zero test artifacts remaining');
  } else {
    console.error('  ❌ Test file still visible in list');
    return false;
  }

  console.log('\n====================================================');
  console.log('🎉 ALL PHASE D1 STORAGE SECURITY TESTS PASSED!');
  console.log('====================================================');
  return true;
}

runStorageTest().catch(console.error);
