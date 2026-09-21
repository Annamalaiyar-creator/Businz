import dotenv from 'dotenv';
import crypto from 'crypto';
import path from 'path';
import { fileURLToPath } from 'url';
import { createClient } from '@supabase/supabase-js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function runAudit() {
  const { data: boms, error } = await supabase.from('bom_orders').select('*').order('id');
  if (error) {
    console.error('Error:', error);
    return;
  }
  console.log('Total BOMs fetched:', boms.length);

  const found = [];

  function inspectValue(val, pathStr, bom) {
    if (!val) return;
    if (typeof val === 'string') {
      const trimmed = val.trim();
      if (trimmed.startsWith('data:') || (trimmed.length > 200 && /^[A-Za-z0-9+/=\s]+$/.test(trimmed.slice(0, 100)) && !trimmed.startsWith('http'))) {
        let base64Part = trimmed;
        let mimeType = 'application/octet-stream';
        if (trimmed.startsWith('data:')) {
          const m = trimmed.match(/^data:([^;]+);base64,(.+)$/s);
          if (m) {
            mimeType = m[1];
            base64Part = m[2];
          }
        }
        const cleanB64 = base64Part.replace(/\s/g, '');
        const decoded = Buffer.from(cleanB64, 'base64');
        const hash = crypto.createHash('sha256').update(decoded).digest('hex');

        // Extract filename if adjacent
        let filename = null;
        if (pathStr.includes('.')) {
          const parentObj = getNested(bom, pathStr.slice(0, pathStr.lastIndexOf('.')));
          if (parentObj && typeof parentObj === 'object') {
            filename = parentObj.name || parentObj.fileName || parentObj.title;
          }
        }

        found.push({
          bomCode: bom.id || bom.bom_code,
          fieldPath: pathStr,
          filename: filename || 'document',
          mimeType,
          b64CharLength: trimmed.length,
          decodedBytes: decoded.length,
          sha256: hash
        });
      }
    } else if (Array.isArray(val)) {
      val.forEach((item, idx) => inspectValue(item, `${pathStr}[${idx}]`, bom));
    } else if (typeof val === 'object') {
      Object.keys(val).forEach(k => inspectValue(val[k], pathStr ? `${pathStr}.${k}` : k, bom));
    }
  }

  function getNested(obj, p) {
    return p.split('.').reduce((acc, part) => (acc && acc[part] !== undefined) ? acc[part] : null, obj);
  }

  boms.forEach(bom => {
    Object.keys(bom).forEach(col => {
      let parsed = bom[col];
      if (typeof parsed === 'string' && (parsed.startsWith('{') || parsed.startsWith('['))) {
        try { parsed = JSON.parse(parsed); } catch (_) {}
      }
      inspectValue(parsed, col, bom);
    });
  });

  console.log('Total Base64 references found:', found.length);
  const uniqueBoms = new Set(found.map(f => f.bomCode));
  console.log('BOMs containing Base64:', uniqueBoms.size, Array.from(uniqueBoms));

  console.log('\n--- DETAILED AUDIT OF ACTIVE BASE64 REFERENCES ---');
  found.forEach((item, idx) => {
    console.log(`${idx + 1}. [${item.bomCode}] ${item.fieldPath}`);
    console.log(`   Filename: ${item.filename} | MIME: ${item.mimeType}`);
    console.log(`   Decoded: ${item.decodedBytes.toLocaleString()} bytes | Base64 chars: ${item.b64CharLength.toLocaleString()}`);
    console.log(`   SHA-256: ${item.sha256}`);
  });

  // Group by BOM and then SHA-256
  const byBom = {};
  found.forEach(item => {
    if (!byBom[item.bomCode]) byBom[item.bomCode] = [];
    byBom[item.bomCode].push(item);
  });

  console.log('\n--- PER-BOM DEDUPLICATION ANALYSIS ---');
  let totalUniqueObjectsPerBom = 0;
  Object.keys(byBom).forEach(bomCode => {
    const items = byBom[bomCode];
    const uniqueHashes = new Set(items.map(i => i.sha256));
    totalUniqueObjectsPerBom += uniqueHashes.size;
    console.log(`[${bomCode}]: ${items.length} references -> ${uniqueHashes.size} unique object(s)`);
    items.forEach(it => {
      console.log(`   - ${it.fieldPath} (${it.decodedBytes} bytes, hash: ${it.sha256.slice(0, 12)}...)`);
    });
  });

  console.log('\nTotal storage upload objects needed (BOM-scoped):', totalUniqueObjectsPerBom);
}

runAudit().catch(console.error);
