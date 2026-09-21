import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const {
  uploadBomDocument,
  createBomDocumentSignedUrl,
  deleteBomDocument,
  getBomDocumentMetadata,
  validateBomCode,
  sanitizeFileName,
  validateStoragePathBelongsToBom,
  validateMimeType,
  validateFileSize,
  MAX_FILE_SIZE,
  BUCKET_NAME
} = await import('../server/bomDocumentService.js');

const {
  resolveDocumentUrl,
  resolveDocumentUrlAsync,
  isStorageDocument,
  getDocumentDisplayName,
  getDocumentSizeLabel
} = await import('../src/utils/documentResolver.js');

async function runD2TestSuite() {
  console.log('====================================================');
  console.log('🚀 BUSINZ PHASE D2 — DOCUMENT SERVICE & RESOLVER TESTS');
  console.log('====================================================\n');

  let passed = 0;
  let failed = 0;

  function assert(condition, testName) {
    if (condition) {
      console.log(`  ✅ PASS: ${testName}`);
      passed++;
    } else {
      console.error(`  ❌ FAIL: ${testName}`);
      failed++;
    }
  }

  const testBomCode = 'BOM-TEST-D2';
  const testCategory = 'payment-proof';
  const testFileName = 'receipt_test.png';
  const testMime = 'image/png';
  const testContent = 'Phase D2 Synthetic Test Payload - ' + Date.now();
  const testBuffer = Buffer.from(testContent, 'utf-8');

  let createdStoragePath = null;

  // 1. Backend Upload Helper
  console.log('Test 1: Backend upload helper with canonical metadata');
  try {
    const meta = await uploadBomDocument({
      bomCode: testBomCode,
      category: testCategory,
      fileBuffer: testBuffer,
      fileName: testFileName,
      mimeType: testMime
    });

    createdStoragePath = meta.storagePath;
    assert(meta.storageBucket === 'bom-documents', 'Metadata contains correct storageBucket');
    assert(meta.storagePath.startsWith(`${testBomCode}/${testCategory}/`), 'Metadata storagePath starts with BOM code and category');
    assert(meta.type === testMime, 'Metadata contains correct MIME type');
    assert(meta.size === testBuffer.length, 'Metadata contains correct byte size');
    assert(Boolean(meta.uploadedAt), 'Metadata contains ISO uploadedAt timestamp');
  } catch (err) {
    assert(false, `Upload helper failed: ${err.message}`);
  }

  // 2. MIME Validation
  console.log('\nTest 2: MIME type validation (reject unsupported types)');
  try {
    validateMimeType('application/x-msdownload');
    assert(false, 'Should reject unsupported MIME type');
  } catch (err) {
    assert(err.message.includes('Unsupported MIME type'), 'Rejected unsupported executable MIME type');
  }

  // 3. Size Validation
  console.log('\nTest 3: Size validation (> 50 MB rejected)');
  try {
    validateFileSize(MAX_FILE_SIZE + 1024);
    assert(false, 'Should reject file exceeding 50 MB');
  } catch (err) {
    assert(err.message.includes('exceeds 50 MB'), 'Rejected oversized payload (> 50 MB)');
  }
  assert(validateFileSize(1024) === 1024, 'Valid file size accepted');

  // 4. Filename Sanitization
  console.log('\nTest 4: Filename sanitization');
  const rawDangerous = '../../etc/passwd/malicious$#@!.pdf';
  const sanitized = sanitizeFileName(rawDangerous);
  assert(!sanitized.includes('/') && !sanitized.includes('\\') && !sanitized.includes('..'), 'Slashes and directory traversal stripped from filename');
  assert(sanitized.endsWith('.pdf'), 'Preserved valid extension');

  // 5. Path Traversal Rejection
  console.log('\nTest 5: Path traversal rejection in storage path');
  try {
    validateStoragePathBelongsToBom(testBomCode, `${testBomCode}/../BOM-714/secret.pdf`);
    assert(false, 'Should reject storage path containing ..');
  } catch (err) {
    assert(err.message.includes('Path traversal detected'), 'Detected and rejected path traversal attempt');
  }

  // 6. Invalid BOM Code Rejection
  console.log('\nTest 6: Invalid BOM code validation');
  try {
    validateBomCode('BOM-713/../../evil');
    assert(false, 'Should reject malformed BOM code');
  } catch (err) {
    assert(err.message.includes('Invalid BOM Code format'), 'Rejected invalid BOM code format');
  }

  // 7. Signed URL Generation
  console.log('\nTest 7: Signed URL generation');
  let generatedSignedUrl = null;
  try {
    const signedRes = await createBomDocumentSignedUrl({
      bomCode: testBomCode,
      storagePath: createdStoragePath,
      expiresIn: 900
    });
    generatedSignedUrl = signedRes.signedUrl;
    assert(Boolean(generatedSignedUrl && generatedSignedUrl.includes('token=')), 'Signed URL generated with security token');
    assert(signedRes.expiresIn === 900, 'Expiration duration is 900 seconds (15 mins)');
  } catch (err) {
    assert(false, `Signed URL generation failed: ${err.message}`);
  }

  // 8. Signed URL Retrieval
  console.log('\nTest 8: Signed URL content retrieval');
  try {
    const fetchRes = await fetch(generatedSignedUrl);
    assert(fetchRes.ok, `Signed URL HTTP status: ${fetchRes.status}`);
    const text = await fetchRes.text();
    assert(text === testContent, 'Retrieved content matches original uploaded payload exactly');
  } catch (err) {
    assert(false, `Failed to retrieve content via signed URL: ${err.message}`);
  }

  // 9. Resolver with Storage Metadata
  console.log('\nTest 9: Resolver with Storage metadata shape');
  const storageDoc = {
    storageBucket: 'bom-documents',
    storagePath: createdStoragePath,
    name: testFileName,
    size: 1024,
    type: 'image/png'
  };
  assert(isStorageDocument(storageDoc), 'isStorageDocument correctly identifies Storage-backed object');
  assert(getDocumentDisplayName(storageDoc) === testFileName, 'getDocumentDisplayName returns file name');
  assert(getDocumentSizeLabel(storageDoc) === '1 KB', 'getDocumentSizeLabel formats size accurately');

  // 10. Resolver with Legacy dataUrl
  console.log('\nTest 10: Resolver with legacy dataUrl');
  const legacyDoc = {
    name: 'legacy_receipt.jpg',
    dataUrl: 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEASABIAAD...',
    size: '125 KB'
  };
  const resolvedLegacy = resolveDocumentUrl(legacyDoc);
  assert(resolvedLegacy === legacyDoc.dataUrl, 'resolveDocumentUrl immediately returns dataUrl for legacy records');

  // 11. Resolver with Existing URL
  console.log('\nTest 11: Resolver with existing static / server URL');
  const urlDoc = {
    name: 'uploaded_doc.pdf',
    url: '/api/uploads/uploaded_doc.pdf'
  };
  const resolvedUrl = resolveDocumentUrl(urlDoc);
  assert(resolvedUrl === urlDoc.url, 'resolveDocumentUrl returns existing server / web URL');

  // 12. Unauthorized Request Rejection (Backend API Endpoint)
  console.log('\nTest 12: Unauthorized HTTP request rejection');
  try {
    const unauthRes = await fetch(`http://localhost:5001/api/boms/${testBomCode}/documents/signed-url?path=${encodeURIComponent(createdStoragePath)}`);
    assert(unauthRes.status === 401, `Request without session rejected with HTTP 401 (got ${unauthRes.status})`);
  } catch (err) {
    assert(false, `HTTP test failed: ${err.message}`);
  }

  // 13. Cross-BOM Path Access Rejection
  console.log('\nTest 13: Cross-BOM path access rejection');
  try {
    await createBomDocumentSignedUrl({
      bomCode: 'BOM-999', // Different BOM attempting to access createdStoragePath (which belongs to BOM-TEST-D2)
      storagePath: createdStoragePath
    });
    assert(false, 'Should reject cross-BOM access');
  } catch (err) {
    assert(err.message.includes('Access denied'), 'Cross-BOM path access strictly rejected');
  }

  // 14. Delete Helper
  console.log('\nTest 14: Delete helper');
  try {
    const delResult = await deleteBomDocument({
      bomCode: testBomCode,
      storagePath: createdStoragePath
    });
    assert(delResult.success === true, 'Authorized deleteBomDocument succeeded');
  } catch (err) {
    assert(false, `Delete helper failed: ${err.message}`);
  }

  // 15. Test-Object Cleanup Check
  console.log('\nTest 15: Test-object cleanup verification');
  try {
    const remainingMeta = await getBomDocumentMetadata({
      bomCode: testBomCode,
      storagePath: createdStoragePath
    });
    assert(remainingMeta === null, 'Test artifact confirmed completely removed from bom-documents bucket');
  } catch (err) {
    assert(false, `Cleanup verification failed: ${err.message}`);
  }

  console.log('\n====================================================');
  console.log(`D2 TEST SUMMARY: ${passed} PASSED | ${failed} FAILED`);
  console.log('====================================================');

  if (failed > 0) {
    process.exit(1);
  }
  return true;
}

runD2TestSuite().catch(err => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
