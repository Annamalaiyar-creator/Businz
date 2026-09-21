/**
 * scripts/audit_phase_d5_consistency.js
 * Phase D5: Storage / DB Reference Consistency and Inventory Audit
 */
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const BUCKET_NAME = 'bom-documents';

if (!supabaseUrl || !serviceRoleKey) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false }
});

async function listAllObjects(prefix = '') {
  let results = [];
  const { data: items, error } = await supabaseAdmin.storage.from(BUCKET_NAME).list(prefix);
  if (error) {
    console.error(`Error listing prefix "${prefix}":`, error.message);
    return results;
  }
  for (const it of (items || [])) {
    const itemPath = prefix ? `${prefix}/${it.name}` : it.name;
    if (it.id) {
      results.push({
        name: it.name,
        storagePath: itemPath,
        id: it.id,
        updated_at: it.updated_at,
        created_at: it.created_at,
        metadata: it.metadata
      });
    } else {
      const sub = await listAllObjects(itemPath);
      results = results.concat(sub);
    }
  }
  return results;
}

async function runAudit() {
  console.log('====================================================');
  console.log('🔍 BUSINZ PHASE D5 — STORAGE & DB CONSISTENCY AUDIT');
  console.log('====================================================\n');

  // 1. Fetch all BOM records
  const { data: boms, error: bomsErr } = await supabaseAdmin
    .from('bom_orders')
    .select('*')
    .order('created_at', { ascending: false });

  if (bomsErr) {
    console.error('❌ Error fetching bom_orders:', bomsErr.message);
    process.exit(1);
  }

  console.log(`📊 public.bom_orders count: ${boms.length}`);

  // Check unique bom_code
  const bomCodes = boms.map(b => b.bom_code || b.id);
  const uniqueBomCodes = new Set(bomCodes);
  const duplicateCodes = bomCodes.filter((item, index) => bomCodes.indexOf(item) !== index);
  console.log(`📊 Unique BOM codes: ${uniqueBomCodes.size}`);
  console.log(`📊 Duplicate BOM codes: ${duplicateCodes.length} ${duplicateCodes.length > 0 ? JSON.stringify(duplicateCodes) : '(None)'}`);

  // Check missing IDs
  const missingIds = boms.filter(b => !b.id || !b.bom_code);
  console.log(`📊 Missing required IDs: ${missingIds.length}`);

  // Check serialized size
  const serialized = JSON.stringify(boms);
  const serializedBytes = Buffer.byteLength(serialized, 'utf8');
  console.log(`📊 Serialized bom_orders payload: ${serializedBytes.toLocaleString()} bytes`);

  // 2. Scan for document references and active Base64
  let activeBase64Count = 0;
  const dbDocReferences = [];
  const referencedStoragePaths = new Set();

  function scanDocField(val, fieldName, bomCode) {
    if (!val) return;
    let target = val;
    if (typeof val === 'string' && (val.startsWith('{') || val.startsWith('['))) {
      try { target = JSON.parse(val); } catch (_) {}
    }

    if (typeof target === 'string') {
      const trimmed = target.trim();
      if (trimmed.startsWith('data:') || (trimmed.length > 200 && /^[A-Za-z0-9+/=\s]+$/.test(trimmed.slice(0, 100)) && !trimmed.startsWith('http'))) {
        activeBase64Count++;
        console.warn(`⚠️ Found active Base64 in ${bomCode}.${fieldName}!`);
      }
    } else if (typeof target === 'object' && target !== null) {
      if (target.dataUrl || target.fileData || target.proofDocData) {
        activeBase64Count++;
        console.warn(`⚠️ Found embedded binary payload in ${bomCode}.${fieldName}!`);
      }
      if (target.storageBucket && target.storagePath) {
        dbDocReferences.push({
          bomCode,
          fieldName,
          storageBucket: target.storageBucket,
          storagePath: target.storagePath,
          name: target.name || target.fileName || target.originalName,
          size: target.size
        });
        referencedStoragePaths.add(target.storagePath);
      }
      if (Array.isArray(target.photos)) {
        target.photos.forEach((p, idx) => scanDocField(p, `${fieldName}.photos[${idx}]`, bomCode));
      }
      if (Array.isArray(target.videos)) {
        target.videos.forEach((v, idx) => scanDocField(v, `${fieldName}.videos[${idx}]`, bomCode));
      }
      if (Array.isArray(target.history)) {
        target.history.forEach((h, idx) => scanDocField(h, `${fieldName}.history[${idx}]`, bomCode));
      }
    }
  }

  boms.forEach(b => {
    const code = b.bom_code || b.id;
    scanDocField(b.payment_proof_doc, 'payment_proof_doc', code);
    scanDocField(b.delivery_address_proof_doc, 'delivery_address_proof_doc', code);
    scanDocField(b.proof_doc, 'proof_doc', code);
    if (b.payments) {
      scanDocField(b.payments.proofDocObj, 'payments.proofDocObj', code);
      scanDocField(b.payments.proofDocData, 'payments.proofDocData', code);
    }
    if (b.dispatch_packing) {
      scanDocField(b.dispatch_packing, 'dispatch_packing', code);
    }
    if (b.accounts_verification && b.accounts_verification._extra_data) {
      const ed = b.accounts_verification._extra_data;
      scanDocField(ed.dispatchPackingMedia, 'accounts_verification._extra_data.dispatchPackingMedia', code);
      scanDocField(ed.vehicleLoading, 'accounts_verification._extra_data.vehicleLoading', code);
    }
  });

  console.log(`📊 Active Base64 count: ${activeBase64Count}`);
  console.log(`📊 Total DB document references found: ${dbDocReferences.length}`);
  console.log(`📊 Unique referenced Storage paths in DB: ${referencedStoragePaths.size}`);

  // 3. List actual Storage objects in bucket
  const storageObjects = await listAllObjects();
  console.log(`📊 Total Storage objects in ${BUCKET_NAME}: ${storageObjects.length}`);
  const storagePathMap = new Map(storageObjects.map(o => [o.storagePath, o]));

  // 4. Cross-Verification
  // A: Every DB reference exists in Storage
  const missingInStorage = [];
  for (const ref of dbDocReferences) {
    if (!storagePathMap.has(ref.storagePath)) {
      missingInStorage.push(ref);
    }
  }
  console.log(`📊 Missing Storage objects (referenced in DB but absent in Storage): ${missingInStorage.length}`);
  if (missingInStorage.length > 0) {
    console.error('❌ Missing objects:', missingInStorage);
  }

  // B: Every Storage object has at least one DB reference
  const orphanInStorage = [];
  for (const obj of storageObjects) {
    if (!referencedStoragePaths.has(obj.storagePath)) {
      orphanInStorage.push(obj);
    }
  }
  console.log(`📊 Orphan Storage objects (present in Storage but not referenced in DB): ${orphanInStorage.length}`);
  if (orphanInStorage.length > 0) {
    console.error('❌ Orphan objects:', orphanInStorage);
  }

  // C: Check for any test artifacts or non-BOM paths
  const invalidPaths = storageObjects.filter(o => !o.storagePath.match(/^BOM-\d{3,}\//));
  console.log(`📊 Objects with non-canonical/test path: ${invalidPaths.length}`);

  // D: Check bucket privacy
  const { data: bucketInfo, error: bucketErr } = await supabaseAdmin.storage.getBucket(BUCKET_NAME);
  if (bucketErr) {
    console.error('❌ Error checking bucket:', bucketErr.message);
  } else {
    console.log(`📊 Bucket "${BUCKET_NAME}" is strictly private (public = false): ${bucketInfo?.public === false}`);
  }

  console.log('\n====================================================');
  if (missingInStorage.length === 0 && orphanInStorage.length === 0 && activeBase64Count === 0 && boms.length === 53) {
    console.log('✅ CONSISTENCY AUDIT 100% CLEAN: 0 MISSING, 0 ORPHAN, 0 BASE64');
  } else {
    console.log('⚠️ AUDIT REPORTED DISCREPANCIES (SEE ABOVE)');
  }
  console.log('====================================================');
}

runAudit().catch(err => {
  console.error('Fatal error in audit:', err);
  process.exit(1);
});
