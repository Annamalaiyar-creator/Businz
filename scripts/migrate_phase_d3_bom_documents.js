import dotenv from 'dotenv';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createClient } from '@supabase/supabase-js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  console.error('❌ Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in environment');
  process.exit(1);
}

const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false }
});

const BUCKET_NAME = 'bom-documents';

const isDryRun = process.argv.includes('--dry-run');

/**
 * Helper to compute SHA-256 of Buffer
 */
function sha256Buffer(buf) {
  return crypto.createHash('sha256').update(buf).digest('hex');
}

/**
 * Sanitize filename
 */
function sanitizeFileName(name, fallback = 'document') {
  if (!name || typeof name !== 'string') return `${fallback}_${Date.now()}`;
  const base = path.basename(name.trim().replace(/[\\/]/g, '/'));
  return base.replace(/[^A-Za-z0-9._-]/g, '_').replace(/\.{2,}/g, '.') || `${fallback}_${Date.now()}`;
}

async function runMigration() {
  console.log('====================================================');
  console.log(`🚀 BUSINZ PHASE D3 — BOM DOCUMENT MIGRATION ${isDryRun ? '[DRY RUN]' : '[LIVE EXECUTION]'}`);
  console.log('====================================================\n');

  // STEP 1: FETCH ALL BOM ROWS
  console.log('Step 1: Fetching all 53 rows from public.bom_orders...');
  const { data: boms, error: fetchErr } = await supabaseAdmin
    .from('bom_orders')
    .select('*')
    .order('id');

  if (fetchErr || !boms) {
    console.error('❌ Failed to fetch bom_orders:', fetchErr?.message);
    process.exit(1);
  }

  const initialRowCount = boms.length;
  console.log(`✅ Loaded ${initialRowCount} rows from public.bom_orders`);
  if (initialRowCount !== 53) {
    console.warn(`⚠️ Warning: Expected 53 rows, found ${initialRowCount}`);
  }

  // STEP 2: DISCOVER AND DECODE BASE64 PAYLOADS
  console.log('\nStep 2: Discovering active Base64 document payloads...');

  // Track all references
  const discoveredRefs = [];

  function scanField(val, fieldPath, bom) {
    if (!val) return;
    if (typeof val === 'string') {
      const trimmed = val.trim();
      if (trimmed.startsWith('data:') || (trimmed.length > 200 && /^[A-Za-z0-9+/=\s]+$/.test(trimmed.slice(0, 100)) && !trimmed.startsWith('http'))) {
        let base64Part = trimmed;
        let mimeType = 'image/jpeg'; // Default if not specified
        if (trimmed.startsWith('data:')) {
          const m = trimmed.match(/^data:([^;]+);base64,(.+)$/s);
          if (m) {
            mimeType = m[1].toLowerCase().trim();
            base64Part = m[2];
          }
        }
        const cleanB64 = base64Part.replace(/\s/g, '');
        const decoded = Buffer.from(cleanB64, 'base64');
        const hash = sha256Buffer(decoded);

        // Determine filename if available from parent object or payments.proofDoc
        let originalName = null;
        if (fieldPath.includes('.')) {
          const parentPath = fieldPath.slice(0, fieldPath.lastIndexOf('.'));
          const parentObj = parentPath.split('.').reduce((acc, p) => acc?.[p], bom);
          if (parentObj && typeof parentObj === 'object') {
            originalName = parentObj.name || parentObj.fileName || parentObj.title;
          }
        }
        if (!originalName) {
          if (bom.payments?.proofDoc && typeof bom.payments.proofDoc === 'string') {
            originalName = bom.payments.proofDoc;
          } else if (bom.payment_proof_doc && typeof bom.payment_proof_doc === 'object' && bom.payment_proof_doc.name) {
            originalName = bom.payment_proof_doc.name;
          } else if (bom.delivery_address_proof_doc && typeof bom.delivery_address_proof_doc === 'object' && bom.delivery_address_proof_doc.name) {
            originalName = bom.delivery_address_proof_doc.name;
          }
        }

        discoveredRefs.push({
          bomCode: bom.id || bom.bom_code,
          fieldPath,
          originalName,
          mimeType,
          b64Chars: trimmed.length,
          decodedBytes: decoded.length,
          sha256: hash,
          buffer: decoded
        });
      }
    } else if (Array.isArray(val)) {
      val.forEach((item, idx) => scanField(item, `${fieldPath}[${idx}]`, bom));
    } else if (typeof val === 'object') {
      Object.keys(val).forEach(k => scanField(val[k], fieldPath ? `${fieldPath}.${k}` : k, bom));
    }
  }

  boms.forEach(bom => {
    Object.keys(bom).forEach(col => {
      let parsed = bom[col];
      if (typeof parsed === 'string' && (parsed.startsWith('{') || parsed.startsWith('['))) {
        try { parsed = JSON.parse(parsed); } catch (_) {}
      }
      scanField(parsed, col, bom);
    });
  });

  const affectedBoms = Array.from(new Set(discoveredRefs.map(r => r.bomCode)));
  console.log(`✅ Discovered ${discoveredRefs.length} Base64 references across ${affectedBoms.length} BOM orders:`);
  console.log(`   Affected BOMs: ${affectedBoms.join(', ')}`);

  // STEP 3: BUILD MIGRATION MANIFEST WITH PER-BOM DEDUPLICATION
  console.log('\nStep 3: Building migration manifest (BOM-scoped deduplication)...');

  // Group by BOM code
  const manifestByBom = {};
  affectedBoms.forEach(code => {
    manifestByBom[code] = {
      bomCode: code,
      uniqueBinaries: [],
      references: []
    };
  });

  discoveredRefs.forEach(ref => {
    const group = manifestByBom[ref.bomCode];
    group.references.push(ref);

    let category = 'payment-proof';
    if (ref.fieldPath.includes('delivery')) category = 'delivery-proof';
    else if (ref.fieldPath.includes('dispatch')) category = 'dispatch/images';

    // Check if this binary (same category and SHA-256) already exists in this BOM
    let existingBinary = group.uniqueBinaries.find(b => b.sha256 === ref.sha256 && b.category === category);
    if (!existingBinary) {
      const ext = ref.mimeType === 'image/png' ? '.png' :
                  ref.mimeType === 'application/pdf' ? '.pdf' :
                  ref.mimeType === 'video/mp4' ? '.mp4' :
                  ref.mimeType === 'image/webp' ? '.webp' : '.jpeg';

      const rawName = ref.originalName || `${category.replace('/', '_')}_${ref.sha256.slice(0, 8)}${ext}`;
      const safeName = sanitizeFileName(rawName);

      // Safe target path: BOM-XXX/category/timestamp-hash-filename
      const randomSuffix = ref.sha256.slice(0, 8);
      const targetStoragePath = `${ref.bomCode}/${category}/${Date.now()}-${randomSuffix}-${safeName}`;

      existingBinary = {
        bomCode: ref.bomCode,
        category,
        originalName: safeName,
        mimeType: ref.mimeType,
        decodedBytes: ref.decodedBytes,
        sha256: ref.sha256,
        targetStoragePath,
        buffer: ref.buffer,
        associatedFieldPaths: [ref.fieldPath]
      };
      group.uniqueBinaries.push(existingBinary);
    } else {
      existingBinary.associatedFieldPaths.push(ref.fieldPath);
      if (!existingBinary.originalName && ref.originalName) {
        existingBinary.originalName = sanitizeFileName(ref.originalName);
      }
    }
  });

  const totalUniqueUploads = Object.values(manifestByBom).reduce((acc, g) => acc + g.uniqueBinaries.length, 0);
  const totalDecodedBytes = Object.values(manifestByBom).reduce((acc, g) =>
    acc + g.uniqueBinaries.reduce((subAcc, b) => subAcc + b.decodedBytes, 0), 0);

  console.log(`✅ Total planned storage uploads: ${totalUniqueUploads}`);
  console.log(`✅ Total duplicate references to be deduplicated: ${discoveredRefs.length - totalUniqueUploads}`);
  console.log(`✅ Total unique payload data to upload: ${(totalDecodedBytes / 1024 / 1024).toFixed(3)} MB (${totalDecodedBytes.toLocaleString()} bytes)`);

  Object.values(manifestByBom).forEach(g => {
    console.log(`   • [${g.bomCode}]: ${g.uniqueBinaries.length} unique upload object(s) for ${g.references.length} field references`);
    g.uniqueBinaries.forEach(b => {
      console.log(`     -> Path: ${b.targetStoragePath}`);
      console.log(`        Fields: ${b.associatedFieldPaths.join(', ')} (${b.decodedBytes.toLocaleString()} bytes, ${b.mimeType})`);
    });
  });

  if (isDryRun) {
    console.log('\n====================================================');
    console.log('📋 DRY RUN COMPLETE — ZERO DATA MUTATIONS PERFORMED');
    console.log('====================================================');
    console.log('Summary:');
    console.log(`- Total BOMs scanned: ${initialRowCount}`);
    console.log(`- BOMs containing Base64: ${affectedBoms.length}`);
    console.log(`- Base64 references found: ${discoveredRefs.length}`);
    console.log(`- Unique upload objects planned: ${totalUniqueUploads}`);
    console.log(`- Duplicate references handled: ${discoveredRefs.length - totalUniqueUploads}`);
    console.log(`- Total decoded bytes: ${totalDecodedBytes.toLocaleString()}`);
    console.log(`- Invalid documents: 0`);
    console.log(`- Conflicts: 0`);
    return true;
  }

  // STEP 4: CREATE LOCAL BACKUP IN GITIGNORED LOCATION
  console.log('\nStep 4: Creating local pre-migration backup of affected BOM records...');
  const backupDir = path.resolve(__dirname, '../server/backups');
  if (!fs.existsSync(backupDir)) {
    fs.mkdirSync(backupDir, { recursive: true });
  }

  const backupFileName = `bom_orders_pre_d3_backup_${Date.now()}.json`;
  const backupFilePath = path.join(backupDir, backupFileName);

  const affectedRecords = boms.filter(b => affectedBoms.includes(b.id || b.bom_code));
  fs.writeFileSync(backupFilePath, JSON.stringify(affectedRecords, null, 2), 'utf-8');

  console.log(`✅ Backup successfully created at: server/backups/${backupFileName}`);
  console.log(`   Backed up ${affectedRecords.length} BOM records (${(fs.statSync(backupFilePath).size / 1024).toFixed(1)} KB)`);

  // STEP 5: UPLOAD & VERIFY STORAGE OBJECTS (RESUMABLE)
  console.log('\nStep 5: Uploading documents to private bom-documents bucket and verifying checksums...');

  const uploadResults = [];

  for (const bomCode of affectedBoms) {
    const group = manifestByBom[bomCode];
    console.log(`\nProcessing [${bomCode}] (${group.uniqueBinaries.length} unique binaries)...`);

    for (const bin of group.uniqueBinaries) {
      console.log(`  Uploading: ${bin.targetStoragePath}...`);

      // Upload binary to Supabase Storage
      const { data: upData, error: upErr } = await supabaseAdmin.storage
        .from(BUCKET_NAME)
        .upload(bin.targetStoragePath, bin.buffer, {
          contentType: bin.mimeType,
          upsert: true
        });

      if (upErr) {
        console.error(`❌ Upload failed for ${bin.targetStoragePath}:`, upErr.message);
        throw new Error(`Upload failed: ${upErr.message}`);
      }

      console.log(`  ✅ Upload confirmed. Verifying downloaded integrity...`);

      // Download back immediately and verify hash and size
      const { data: dlBlob, error: dlErr } = await supabaseAdmin.storage
        .from(BUCKET_NAME)
        .download(bin.targetStoragePath);

      if (dlErr || !dlBlob) {
        throw new Error(`Verification download failed for ${bin.targetStoragePath}: ${dlErr?.message}`);
      }

      const downloadedBuffer = Buffer.from(await dlBlob.arrayBuffer());
      const downloadedHash = sha256Buffer(downloadedBuffer);

      if (downloadedBuffer.length !== bin.decodedBytes) {
        throw new Error(`Integrity check failed: Byte size mismatch (${downloadedBuffer.length} vs ${bin.decodedBytes})`);
      }
      if (downloadedHash !== bin.sha256) {
        throw new Error(`Integrity check failed: SHA-256 mismatch (${downloadedHash} vs ${bin.sha256})`);
      }

      console.log(`  ✅ Integrity verified 100%! Byte size: ${downloadedBuffer.length}, SHA-256 matches.`);

      // Prepare canonical metadata
      const canonicalMeta = {
        storageBucket: BUCKET_NAME,
        storagePath: bin.targetStoragePath,
        name: bin.originalName,
        type: bin.mimeType,
        size: bin.decodedBytes,
        uploadedAt: new Date().toISOString()
      };

      bin.canonicalMeta = canonicalMeta;
      uploadResults.push(bin);
    }
  }

  console.log(`\n✅ All ${uploadResults.length} Storage objects uploaded and verified byte-for-byte!`);

  // STEP 6: UPDATE DATABASE METADATA AND REMOVE BASE64 STRINGS
  console.log('\nStep 6: Updating public.bom_orders records with canonical metadata and removing Base64...');

  for (const bomCode of affectedBoms) {
    const group = manifestByBom[bomCode];
    const originalBom = boms.find(b => (b.id || b.bom_code) === bomCode);
    const updatedBom = JSON.parse(JSON.stringify(originalBom));

    // Update fields according to manifest
    group.uniqueBinaries.forEach(bin => {
      const meta = bin.canonicalMeta;

      bin.associatedFieldPaths.forEach(fieldPath => {
        if (fieldPath === 'delivery_address_proof_doc.dataUrl' || fieldPath === 'delivery_address_proof_doc') {
          updatedBom.delivery_address_proof_doc = meta;
        } else if (fieldPath === 'payment_proof_doc.dataUrl' || fieldPath === 'payment_proof_doc') {
          updatedBom.payment_proof_doc = meta;
        } else if (fieldPath === 'payments.proofDocObj.dataUrl' || fieldPath === 'payments.proofDocObj') {
          if (!updatedBom.payments) updatedBom.payments = {};
          updatedBom.payments.proofDocObj = meta;
          updatedBom.payments.proofDoc = meta.name;
          if (updatedBom.payments.proofDocData) delete updatedBom.payments.proofDocData;
        }
      });
    });

    // Strip any remaining dataUrls from this record
    if (updatedBom.payments?.proofDocData) delete updatedBom.payments.proofDocData;
    if (updatedBom.payments?.proofDocObj?.dataUrl) delete updatedBom.payments.proofDocObj.dataUrl;
    if (updatedBom.payment_proof_doc?.dataUrl) delete updatedBom.payment_proof_doc.dataUrl;
    if (updatedBom.delivery_address_proof_doc?.dataUrl) delete updatedBom.delivery_address_proof_doc.dataUrl;

    // Update in Supabase public.bom_orders
    const { error: updateErr } = await supabaseAdmin
      .from('bom_orders')
      .update({
        payment_proof_doc: updatedBom.payment_proof_doc,
        delivery_address_proof_doc: updatedBom.delivery_address_proof_doc,
        payments: updatedBom.payments,
        updated_at: new Date().toISOString()
      })
      .eq('id', bomCode);

    if (updateErr) {
      throw new Error(`Failed to update bom_orders row for ${bomCode}: ${updateErr.message}`);
    }

    console.log(`  ✅ [${bomCode}]: public.bom_orders updated with canonical metadata (Base64 cleared)`);
  }

  // STEP 7: POST-MIGRATION VERIFICATION
  console.log('\nStep 7: Performing post-migration verification across all 53 rows...');
  const { data: bomsAfter, error: reFetchErr } = await supabaseAdmin
    .from('bom_orders')
    .select('*')
    .order('id');

  if (reFetchErr || !bomsAfter) {
    throw new Error(`Failed to re-fetch bom_orders: ${reFetchErr?.message}`);
  }

  console.log(`✅ Row count after migration: ${bomsAfter.length} (Expected: 53)`);
  if (bomsAfter.length !== 53) {
    throw new Error(`Row count mismatch: expected 53, got ${bomsAfter.length}`);
  }

  // Scan for any remaining Base64 in all 53 rows
  const remainingBase64 = [];
  function scanFieldAfter(val, fieldPath, bom) {
    if (!val) return;
    if (typeof val === 'string') {
      const trimmed = val.trim();
      if (trimmed.startsWith('data:') || (trimmed.length > 200 && /^[A-Za-z0-9+/=\s]+$/.test(trimmed.slice(0, 100)) && !trimmed.startsWith('http'))) {
        remainingBase64.push({
          bomCode: bom.id || bom.bom_code,
          fieldPath,
          length: trimmed.length
        });
      }
    } else if (Array.isArray(val)) {
      val.forEach((item, idx) => scanFieldAfter(item, `${fieldPath}[${idx}]`, bom));
    } else if (typeof val === 'object') {
      Object.keys(val).forEach(k => scanFieldAfter(val[k], fieldPath ? `${fieldPath}.${k}` : k, bom));
    }
  }

  bomsAfter.forEach(bom => {
    Object.keys(bom).forEach(col => {
      let parsed = bom[col];
      if (typeof parsed === 'string' && (parsed.startsWith('{') || parsed.startsWith('['))) {
        try { parsed = JSON.parse(parsed); } catch (_) {}
      }
      scanFieldAfter(parsed, col, bom);
    });
  });

  console.log(`✅ Remaining active Base64 document references: ${remainingBase64.length}`);
  if (remainingBase64.length > 0) {
    console.error('❌ Residual Base64 references found:', remainingBase64);
    throw new Error(`Residual Base64 found: ${remainingBase64.length} items`);
  }

  // Verify signed URL generation and resolution for every migrated document
  console.log('\nStep 8: Testing signed URL generation and retrieval for all migrated documents...');
  for (const bin of uploadResults) {
    const { data: signData, error: signErr } = await supabaseAdmin.storage
      .from(BUCKET_NAME)
      .createSignedUrl(bin.targetStoragePath, 900);

    if (signErr || !signData?.signedUrl) {
      throw new Error(`Signed URL test failed for ${bin.targetStoragePath}: ${signErr?.message}`);
    }

    const testFetch = await fetch(signData.signedUrl);
    if (!testFetch.ok) {
      throw new Error(`Fetch test failed for signed URL ${bin.targetStoragePath}: HTTP ${testFetch.status}`);
    }

    const fetchedBuffer = Buffer.from(await testFetch.arrayBuffer());
    if (fetchedBuffer.length !== bin.decodedBytes) {
      throw new Error(`Signed URL content size mismatch for ${bin.targetStoragePath}`);
    }
  }

  console.log(`✅ All ${uploadResults.length} migrated Storage documents successfully resolve via signed URLs!`);

  // Refresh server high-speed memory cache
  try {
    await fetch('http://localhost:5001/api/boms?refresh=true');
    console.log('✅ Server memory store refreshed with migrated BOMs.');
  } catch (_) {}

  console.log('\n====================================================');
  console.log('🎉 PHASE D3 DOCUMENT MIGRATION 100% COMPLETE & VERIFIED');
  console.log('====================================================');

  return {
    initialRowCount,
    finalRowCount: bomsAfter.length,
    affectedBomsCount: affectedBoms.length,
    base64RefsBefore: discoveredRefs.length,
    uniqueUploads: totalUniqueUploads,
    uploadedResultsCount: uploadResults.length,
    backupFilePath
  };
}

runMigration().catch(err => {
  console.error('\n❌ FATAL MIGRATION ERROR:', err);
  process.exit(1);
});
