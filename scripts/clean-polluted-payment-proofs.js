import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { query, verifyDbConnectivity, isDbConnected } from '../server/db.js';
import { getStoreFilePath } from '../server/runtimePaths.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const TARGET_POLLUTED_NAME = 'WhatsApp Image 2026-11-04 at 10.35.37.jpeg';

async function main() {
  console.log(`\n===============================================================`);
  console.log(`🔍 BOM PAYMENT PROOF SANITIZER & AUDIT TOOL`);
  console.log(`Targeting polluted document: "${TARGET_POLLUTED_NAME}"`);
  console.log(`===============================================================\n`);

  // 1. Verify database connectivity
  console.log('⏳ Checking PostgreSQL connection...');
  const connCheck = await verifyDbConnectivity(5000);
  console.log(`📡 Database status:`, connCheck.ok ? `CONNECTED (latency: ${connCheck.latencyMs}ms)` : `FAILED (${connCheck.error})`);

  let modifiedBomsCount = 0;
  let restoredRealSlipCount = 0;
  let removedPollutedSlipCount = 0;

  if (isDbConnected()) {
    try {
      const dbRes = await query(`
        SELECT id, bom_code, customer_name, company_name, grand_total, payment_type, payment_proof_doc, payments
        FROM bom_orders
        WHERE payment_proof_doc::text ILIKE $1 
           OR payments::text ILIKE $1
      `, [`%${TARGET_POLLUTED_NAME}%`]);

      console.log(`\n📊 Found ${dbRes.rows.length} BOM(s) with polluted payment proof in PostgreSQL:`);

      for (const row of dbRes.rows) {
        const bCode = row.bom_code || row.id;
        const cust = row.company_name || row.customer_name || 'Customer';
        const amt = row.grand_total;

        let payDoc = row.payment_proof_doc;
        if (typeof payDoc === 'string' && (payDoc.startsWith('{') || payDoc.startsWith('['))) {
          try { payDoc = JSON.parse(payDoc); } catch (_) {}
        }

        let payments = row.payments;
        if (typeof payments === 'string' && (payments.startsWith('{') || payments.startsWith('['))) {
          try { payments = JSON.parse(payments); } catch (_) {}
        }
        if (!payments || typeof payments !== 'object') payments = {};

        // Inspect existing documents in proofDocObjs / proofDocs
        const docObjs = Array.isArray(payments.proofDocObjs) ? payments.proofDocObjs : (Array.isArray(payDoc) ? payDoc : (payDoc ? [payDoc] : []));
        const filteredDocs = docObjs.filter(d => {
          const n = typeof d === 'string' ? d : (d?.name || d?.originalName || '');
          return n !== TARGET_POLLUTED_NAME;
        });

        let newPrimaryDoc = null;
        let action = '';

        if (filteredDocs.length > 0) {
          // Case A: Salesperson attached another real slip alongside the polluted one!
          newPrimaryDoc = filteredDocs[0];
          action = `RESTORE REAL SLIP: "${newPrimaryDoc.name || newPrimaryDoc}" (removed leaked PhonePe slip)`;
          restoredRealSlipCount++;
        } else {
          // Case B: Only the polluted PhonePe slip was present.
          newPrimaryDoc = null;
          action = `CLEAR POLLUTED SLIP: Removed leaked PhonePe ₹3,800 slip from unrelated order`;
          removedPollutedSlipCount++;
        }

        console.log(` - BOM [${bCode}] (${cust}, ₹${amt}): ${action}`);

        // Update row in DB
        const updatedPayments = {
          ...payments,
          proofDoc: newPrimaryDoc ? (newPrimaryDoc.name || newPrimaryDoc.originalName || newPrimaryDoc) : null,
          proofDocObj: newPrimaryDoc || null,
          proofDocs: filteredDocs.map(d => typeof d === 'string' ? d : (d.name || d.originalName)),
          proofDocObjs: filteredDocs
        };

        await query(`
          UPDATE bom_orders
          SET payment_proof_doc = $1,
              payments = $2,
              updated_at = NOW()
          WHERE bom_code = $3 OR id = $3
        `, [
          newPrimaryDoc ? JSON.stringify(newPrimaryDoc) : null,
          JSON.stringify(updatedPayments),
          bCode
        ]);

        modifiedBomsCount++;
      }

      // Also sanitize controlroom_store bom_store
      const crRes = await query(`SELECT data FROM controlroom_store WHERE key = 'bom_store'`);
      if (crRes.rows.length > 0 && Array.isArray(crRes.rows[0].data)) {
        let crModified = false;
        const crList = crRes.rows[0].data.map(b => {
          const docStr = JSON.stringify(b.paymentProofDoc || b.paymentProofDocs || b.payments || {});
          if (!docStr.includes(TARGET_POLLUTED_NAME)) return b;

          crModified = true;
          let pDocs = Array.isArray(b.paymentProofDocs) ? b.paymentProofDocs : (b.paymentProofDoc ? [b.paymentProofDoc] : []);
          const cleanDocs = pDocs.filter(d => (d?.name || d?.originalName || d) !== TARGET_POLLUTED_NAME);
          const primary = cleanDocs.length > 0 ? cleanDocs[0] : null;

          return {
            ...b,
            paymentProofDoc: primary,
            paymentProofDocs: cleanDocs,
            payments: {
              ...(b.payments || {}),
              proofDoc: primary ? (primary.name || primary.originalName || primary) : null,
              proofDocObj: primary || null,
              proofDocs: cleanDocs.map(d => d.name || d.originalName || d),
              proofDocObjs: cleanDocs
            }
          };
        });

        if (crModified) {
          await query(`UPDATE controlroom_store SET data = $1::jsonb, updated_at = NOW() WHERE key = 'bom_store'`, [JSON.stringify(crList)]);
          console.log(`✅ Cleaned controlroom_store ('bom_store') in database.`);
        }
      }
    } catch (e) {
      console.error('❌ Error during database sanitization:', e);
    }
  }

  // 2. Sanitize local disk bom_store.json if present
  let diskPath = '';
  try {
    diskPath = getStoreFilePath('bom_store.json');
  } catch (_) {
    diskPath = path.resolve(__dirname, '../server/bom_store.json');
  }

  if (fs.existsSync(diskPath)) {
    try {
      const diskContent = fs.readFileSync(diskPath, 'utf8');
      if (diskContent.includes(TARGET_POLLUTED_NAME)) {
        const diskList = JSON.parse(diskContent);
        if (Array.isArray(diskList)) {
          const cleanDiskList = diskList.map(b => {
            const docStr = JSON.stringify(b.paymentProofDoc || b.paymentProofDocs || b.payments || {});
            if (!docStr.includes(TARGET_POLLUTED_NAME)) return b;

            let pDocs = Array.isArray(b.paymentProofDocs) ? b.paymentProofDocs : (b.paymentProofDoc ? [b.paymentProofDoc] : []);
            const cleanDocs = pDocs.filter(d => (d?.name || d?.originalName || d) !== TARGET_POLLUTED_NAME);
            const primary = cleanDocs.length > 0 ? cleanDocs[0] : null;

            return {
              ...b,
              paymentProofDoc: primary,
              paymentProofDocs: cleanDocs,
              payments: {
                ...(b.payments || {}),
                proofDoc: primary ? (primary.name || primary.originalName || primary) : null,
                proofDocObj: primary || null,
                proofDocs: cleanDocs.map(d => d.name || d.originalName || d),
                proofDocObjs: cleanDocs
              }
            };
          });

          fs.writeFileSync(diskPath, JSON.stringify(cleanDiskList, null, 2), 'utf8');
          console.log(`✅ Cleaned disk file: ${diskPath}`);
        }
      }
    } catch (dErr) {
      console.warn('⚠️ Disk clean warning:', dErr.message);
    }
  }

  console.log(`\n===============================================================`);
  console.log(`🎉 SANITIZATION COMPLETE SUMMARY:`);
  console.log(`   - Total BOMs Cleaned: ${modifiedBomsCount}`);
  console.log(`   - Authentic Customer Slips Restored: ${restoredRealSlipCount}`);
  console.log(`   - Polluted/Leaked Slips Removed: ${removedPollutedSlipCount}`);
  console.log(`===============================================================\n`);

  process.exit(0);
}

main().catch(err => {
  console.error('Fatal execution error:', err);
  process.exit(1);
});
