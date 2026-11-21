import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { query, verifyDbConnectivity, isDbConnected } from '../server/db.js';
import { getStoreFilePath } from '../server/runtimePaths.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function main() {
  const targetNumber = process.argv[2] || '797';
  console.log(`\n===============================================================`);
  console.log(`🔄 UPDATING BOM ${targetNumber} TO CREDIT & REMOVING PAYMENT ATTACHMENT`);
  console.log(`===============================================================\n`);

  // 1. Verify database connectivity
  console.log('⏳ Checking PostgreSQL connection...');
  const connCheck = await verifyDbConnectivity(5000);
  console.log(`📡 Database status:`, connCheck.ok ? `CONNECTED (latency: ${connCheck.latencyMs}ms)` : `FAILED (${connCheck.error})`);

  const isMatch = (code, id) => {
    const s1 = String(code || '').replace(/[\/\-_]/g, '').toLowerCase();
    const s2 = String(id || '').replace(/[\/\-_]/g, '').toLowerCase();
    return s1.includes(targetNumber) || s2.includes(targetNumber);
  };

  let updatedInPg = 0;
  let updatedInCrStore = 0;
  let updatedInDisk = 0;

  // 2. Query and update PostgreSQL bom_orders table
  if (isDbConnected()) {
    try {
      const selectRes = await query(`
        SELECT id, bom_code, code, customer_name, payment_type, partial_amount, balance_amount, 
               grand_total, credit_days, credit_due_date, payment_proof_doc, payments, accounts_verification, date
        FROM public.bom_orders
        WHERE bom_code ILIKE '%${targetNumber}%' OR code ILIKE '%${targetNumber}%' OR id ILIKE '%${targetNumber}%'
      `);

      const matchingRows = (selectRes.rows || []).filter(r => isMatch(r.bom_code, r.id));
      console.log(`🔍 Found ${matchingRows.length} record(s) matching BOM ${targetNumber} in bom_orders table.`);

      for (const row of matchingRows) {
        console.log(`\n📄 Current BOM ${row.bom_code || row.code}:`, {
          customer: row.customer_name,
          payment_type: row.payment_type,
          grand_total: row.grand_total,
          has_payment_proof: !!row.payment_proof_doc
        });

        // Compute 30 days credit timeline
        const baseDate = row.date ? new Date(row.date) : new Date();
        const dueDate = new Date(baseDate);
        dueDate.setDate(dueDate.getDate() + 30);
        const dueDateStr = dueDate.toISOString().split('T')[0];

        // Sanitize payments JSONB object
        const paymentsObj = (row.payments && typeof row.payments === 'object') ? { ...row.payments } : {};
        delete paymentsObj.proofDoc;
        delete paymentsObj.proofDocObj;
        delete paymentsObj.paymentProofDoc;
        delete paymentsObj.paymentProofDocs;
        delete paymentsObj.balanceProofDoc;
        delete paymentsObj.attachment;
        delete paymentsObj.attachments;
        paymentsObj.paymentType = 'Credit Payment';
        paymentsObj.isCredit = true;
        paymentsObj.creditDays = 30;
        paymentsObj.creditDueDate = dueDateStr;
        paymentsObj.partialAmount = 0;
        paymentsObj.balanceAmount = Number(row.grand_total || 0);

        // Sanitize accounts_verification JSONB object
        const accObj = (row.accounts_verification && typeof row.accounts_verification === 'object') ? { ...row.accounts_verification } : {};
        accObj.paymentType = 'Credit Payment';
        accObj.creditDays = 30;
        accObj.creditDueDate = dueDateStr;

        const updateRes = await query(`
          UPDATE public.bom_orders
          SET 
            payment_type = 'Credit Payment',
            credit_days = 30,
            credit_due_date = $1,
            partial_amount = 0,
            balance_amount = grand_total,
            payment_proof_doc = NULL,
            payments = $2::jsonb,
            accounts_verification = $3::jsonb,
            updated_at = NOW()
          WHERE id = $4
        `, [dueDateStr, JSON.stringify(paymentsObj), JSON.stringify(accObj), row.id]);

        if (updateRes.rowCount > 0) {
          updatedInPg++;
          console.log(`✅ Successfully updated bom_orders row (ID: ${row.id}):`);
          console.log(`   - Payment Type: 'Credit Payment'`);
          console.log(`   - Credit Days: 30 Days (Due: ${dueDateStr})`);
          console.log(`   - Balance Amount: ₹${row.grand_total}`);
          console.log(`   - Payment Proof Attachment: REMOVED (NULL)`);
        }
      }
    } catch (e) {
      console.error('❌ Error updating bom_orders table:', e.message);
    }

    // 3. Update controlroom_store JSON array (where key = 'bom_store')
    try {
      const crRes = await query(`SELECT data FROM public.controlroom_store WHERE key = 'bom_store'`);
      if (crRes.rows.length > 0 && Array.isArray(crRes.rows[0].data)) {
        const list = crRes.rows[0].data;
        let modified = false;

        const updatedList = list.map(b => {
          if (!isMatch(b.bomCode || b.code, b.id)) return b;
          modified = true;
          updatedInCrStore++;

          const baseDate = b.date ? new Date(b.date) : new Date();
          const dueDate = new Date(baseDate);
          dueDate.setDate(dueDate.getDate() + 30);
          const dueDateStr = dueDate.toISOString().split('T')[0];

          // Clean all uploaded docs
          const cleanDocs = Array.isArray(b.uploadedDocuments)
            ? b.uploadedDocuments.filter(d => {
                const n = String(d?.name || d?.fileName || '').toLowerCase();
                const c = String(d?.category || d?.type || '').toLowerCase();
                return !n.includes('payment') && !n.includes('slip') && !c.includes('payment');
              })
            : [];

          return {
            ...b,
            paymentType: 'Credit Payment',
            paymentTerms: 'Credit Payment',
            creditDays: 30,
            creditDueDate: dueDateStr,
            isCreditOrder: true,
            isCredit: true,
            partialAmount: 0,
            balanceAmount: b.grandTotal || b.totalAmount || 0,
            paymentProofDoc: null,
            paymentProofDocs: [],
            paymentProofFile: null,
            balanceProofDoc: null,
            uploadedDocuments: cleanDocs,
            accountsVerification: {
              ...(b.accountsVerification || {}),
              paymentType: 'Credit Payment',
              creditDays: 30,
              creditDueDate: dueDateStr
            },
            payments: {
              ...(b.payments || {}),
              paymentType: 'Credit Payment',
              isCredit: true,
              creditDays: 30,
              creditDueDate: dueDateStr,
              partialAmount: 0,
              balanceAmount: b.grandTotal || b.totalAmount || 0,
              proofDoc: null,
              proofDocObj: null
            }
          };
        });

        if (modified) {
          await query(`UPDATE public.controlroom_store SET data = $1::jsonb WHERE key = 'bom_store'`, [JSON.stringify(updatedList)]);
          console.log(`✅ Successfully updated ${updatedInCrStore} record(s) in controlroom_store (bom_store key).`);
        }
      }
    } catch (e) {
      console.warn('⚠️ Could not update controlroom_store:', e.message);
    }
  }

  // 4. Update disk bom_store.json file if present
  let diskPath = '';
  try {
    diskPath = getStoreFilePath('bom_store.json');
  } catch (_) {
    diskPath = path.resolve(__dirname, '../server/data/bom_store.json');
  }

  if (fs.existsSync(diskPath)) {
    try {
      const diskList = JSON.parse(fs.readFileSync(diskPath, 'utf8') || '[]');
      if (Array.isArray(diskList)) {
        let modified = false;
        const updatedDisk = diskList.map(b => {
          if (!isMatch(b.bomCode || b.code, b.id)) return b;
          modified = true;
          updatedInDisk++;
          return {
            ...b,
            paymentType: 'Credit Payment',
            paymentTerms: 'Credit Payment',
            creditDays: 30,
            isCreditOrder: true,
            isCredit: true,
            partialAmount: 0,
            balanceAmount: b.grandTotal || b.totalAmount || 0,
            paymentProofDoc: null,
            paymentProofDocs: [],
            paymentProofFile: null
          };
        });

        if (modified) {
          fs.writeFileSync(diskPath, JSON.stringify(updatedDisk, null, 2), 'utf8');
          console.log(`✅ Successfully updated disk file: ${diskPath}`);
        }
      }
    } catch (e) {
      console.warn('⚠️ Could not update disk bom_store.json:', e.message);
    }
  }

  console.log(`\n===============================================================`);
  console.log(`🎉 COMPLETED:`);
  console.log(`   - bom_orders table updated:       ${updatedInPg} record(s)`);
  console.log(`   - controlroom_store updated:      ${updatedInCrStore} record(s)`);
  console.log(`   - Disk JSON file updated:         ${updatedInDisk} record(s)`);
  console.log(`===============================================================\n`);

  process.exit(0);
}

main().catch(err => {
  console.error('Fatal execution error:', err);
  process.exit(1);
});
