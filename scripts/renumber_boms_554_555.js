import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { query, verifyDbConnectivity, isDbConnected } from '../server/db.js';
import { getStoreFilePath } from '../server/runtimePaths.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export async function renumberBoms554And555() {
  console.log('==================================================');
  console.log('🔄 BUSINZ: Renumbering Legacy BOMs to 556 & 557');
  console.log('==================================================');

  const renames = [
    {
      oldCode: 'VRM-BOM-1132',
      newCode: 'VRMS/BOM/26-27/556',
      customerMatch: 'SRI SASTHAA SOLAR',
      defaultAmount: 27612,
      defaultSubTotal: 23400
    },
    {
      oldCode: 'VRM-BOM-1166',
      newCode: 'VRMS/BOM/26-27/557',
      customerMatch: 'Sri Vaarahi Enterprises',
      defaultAmount: 9416.40,
      defaultSubTotal: 7980
    },
    {
      oldCode: 'VRM-BOM-1198',
      newCode: 'VRMS/BOM/26-27/558',
      customerMatch: 'Vilva Tech',
      defaultAmount: 0,
      defaultSubTotal: 0
    },
    {
      oldCode: 'VRM-BOM-1227',
      newCode: 'VRMS/BOM/26-27/559',
      customerMatch: 'JYSL ASSOCIATES',
      defaultAmount: 0,
      defaultSubTotal: 0
    }
  ];

  let pgUpdated = 0;
  let crStoreUpdated = 0;
  let diskUpdated = 0;

  // 1. Check PostgreSQL Database Connectivity
  const connCheck = await verifyDbConnectivity(5000);
  console.log('📡 Database status:', connCheck.ok ? `CONNECTED (${connCheck.latencyMs}ms)` : `NOT CONNECTED (${connCheck.error})`);

  if (isDbConnected()) {
    try {
      for (const item of renames) {
        // Find existing record in bom_orders
        const existing = await query(`
          SELECT * FROM public.bom_orders
          WHERE bom_code = $1 OR code = $1 OR id = $1 OR customer_name ILIKE $2
        `, [item.oldCode, `%${item.customerMatch}%`]);

        if (existing?.rows && existing.rows.length > 0) {
          for (const row of existing.rows) {
            let grandTotal = parseFloat(row.grand_total || row.total_amount || 0);
            let subTotal = parseFloat(row.sub_total || 0);
            
            // If amount is missing (e.g. Sri Vaarahi), compute from items JSON if available
            if (grandTotal <= 0 && row.items) {
              try {
                const itemsList = typeof row.items === 'string' ? JSON.parse(row.items) : row.items;
                if (Array.isArray(itemsList)) {
                  const itemsSum = itemsList.reduce((acc, it) => acc + ((parseFloat(it.qty || it.bomQty || 1) * parseFloat(it.rate || it.price || 0)) || 0), 0);
                  if (itemsSum > 0) {
                    subTotal = itemsSum;
                    grandTotal = Math.round(itemsSum * 1.18 * 100) / 100;
                  }
                }
              } catch (_) {}
            }
            if (grandTotal <= 0 && item.defaultAmount) {
              grandTotal = item.defaultAmount;
              subTotal = item.defaultSubTotal || Math.round(grandTotal / 1.18);
            }

            console.log(`Updating PostgreSQL bom_orders: ${row.bom_code} -> ${item.newCode} (Customer: ${row.customer_name}, Amount: ${grandTotal})`);

            await query(`
              UPDATE public.bom_orders
              SET bom_code = $1,
                  code = $1,
                  id = $1,
                  grand_total = CASE WHEN grand_total IS NULL OR grand_total = 0 THEN $2 ELSE grand_total END,
                  total_amount = CASE WHEN total_amount IS NULL OR total_amount = 0 THEN $2 ELSE total_amount END,
                  sub_total = CASE WHEN sub_total IS NULL OR sub_total = 0 THEN $3 ELSE sub_total END
              WHERE id = $4 OR bom_code = $5
            `, [item.newCode, grandTotal, subTotal, row.id, row.bom_code]);

            pgUpdated++;
          }
        }

        // Also update any proforma_invoices referencing old BOM code
        await query(`
          UPDATE public.proforma_invoices
          SET converted_bom_code = $1
          WHERE converted_bom_code = $2
        `, [item.newCode, item.oldCode]);
      }

      // Update controlroom_store for key = 'bom_store'
      const crRes = await query(`SELECT data FROM public.controlroom_store WHERE key = 'bom_store'`);
      if (crRes?.rows?.[0]?.data && Array.isArray(crRes.rows[0].data)) {
        let changed = false;
        const updatedList = crRes.rows[0].data.map(b => {
          for (const item of renames) {
            const matchesCode = b.bomCode === item.oldCode || b.code === item.oldCode || b.id === item.oldCode ||
              (item.oldCode === 'VRM-BOM-1132' && (b.bomCode === 'VRMS/BOM/26-27/554' && String(b.customerName || '').includes('SASTHAA'))) ||
              (item.oldCode === 'VRM-BOM-1166' && (b.bomCode === 'VRMS/BOM/26-27/555' && String(b.customerName || '').includes('Vaarahi')));
            const matchesCustomer = item.customerMatch && (
              String(b.customerName || '').toLowerCase().includes(item.customerMatch.toLowerCase()) ||
              String(b.companyName || '').toLowerCase().includes(item.customerMatch.toLowerCase())
            ) && (b.bomCode === item.oldCode || String(b.bomCode || '').includes('1166') || String(b.bomCode || '').includes('1132') ||
              (item.oldCode === 'VRM-BOM-1132' && b.bomCode === 'VRMS/BOM/26-27/554') ||
              (item.oldCode === 'VRM-BOM-1166' && b.bomCode === 'VRMS/BOM/26-27/555'));

            if (matchesCode || matchesCustomer) {
              changed = true;
              crStoreUpdated++;
              console.log(`Updating controlroom_store item: ${b.bomCode} -> ${item.newCode}`);

              let gTotal = parseFloat(b.grandTotal || b.totalAmount || b.amount || 0);
              if (gTotal <= 0 && Array.isArray(b.items) && b.items.length > 0) {
                const s = b.items.reduce((acc, it) => acc + ((parseFloat(it.qty || it.bomQty || 1) * parseFloat(it.rate || it.price || 0)) || 0), 0);
                if (s > 0) gTotal = Math.round(s * 1.18 * 100) / 100;
              }
              if (gTotal <= 0 && item.defaultAmount) {
                gTotal = item.defaultAmount;
              }

              return {
                ...b,
                id: item.newCode,
                bomCode: item.newCode,
                code: item.newCode,
                grandTotal: gTotal > 0 ? gTotal : b.grandTotal,
                totalAmount: gTotal > 0 ? gTotal : b.totalAmount
              };
            }
          }
          return b;
        });

        if (changed) {
          await query(`UPDATE public.controlroom_store SET data = $1 WHERE key = 'bom_store'`, [JSON.stringify(updatedList)]);
          console.log(`✅ Saved ${crStoreUpdated} updated records back to controlroom_store (bom_store).`);
        }
      }

      // Also update sales_pi_store in controlroom_store
      const piRes = await query(`SELECT data FROM public.controlroom_store WHERE key = 'sales_pi_store'`);
      if (piRes?.rows?.[0]?.data && Array.isArray(piRes.rows[0].data)) {
        let piChanged = false;
        const updatedPis = piRes.rows[0].data.map(p => {
          for (const item of renames) {
            if (p.convertedBomCode === item.oldCode || p.convertedBomNo === item.oldCode) {
              piChanged = true;
              return { ...p, convertedBomCode: item.newCode, convertedBomNo: item.newCode };
            }
          }
          return p;
        });
        if (piChanged) {
          await query(`UPDATE public.controlroom_store SET data = $1 WHERE key = 'sales_pi_store'`, [JSON.stringify(updatedPis)]);
          console.log(`✅ Updated converted_bom_code references in sales_pi_store.`);
        }
      }

    } catch (dbErr) {
      console.error('❌ Error updating database:', dbErr);
    }
  }

  // 2. Update Disk Storage Files
  const diskPath = getStoreFilePath('bom_store.json');
  if (fs.existsSync(diskPath)) {
    try {
      const fileData = JSON.parse(fs.readFileSync(diskPath, 'utf8'));
      if (Array.isArray(fileData)) {
        let changed = false;
        const updatedList = fileData.map(b => {
          for (const item of renames) {
            const matches = b.bomCode === item.oldCode || b.code === item.oldCode || b.id === item.oldCode ||
              (item.oldCode === 'VRM-BOM-1132' && (b.bomCode === 'VRMS/BOM/26-27/554' && String(b.customerName || '').includes('SASTHAA'))) ||
              (item.oldCode === 'VRM-BOM-1166' && (b.bomCode === 'VRMS/BOM/26-27/555' && String(b.customerName || '').includes('Vaarahi')));
            if (matches) {
              changed = true;
              diskUpdated++;
              let gTotal = parseFloat(b.grandTotal || b.totalAmount || 0);
              if (gTotal <= 0 && Array.isArray(b.items)) {
                const s = b.items.reduce((acc, it) => acc + ((parseFloat(it.qty || it.bomQty || 1) * parseFloat(it.rate || it.price || 0)) || 0), 0);
                if (s > 0) gTotal = Math.round(s * 1.18 * 100) / 100;
              }
              if (gTotal <= 0 && item.defaultAmount) {
                gTotal = item.defaultAmount;
              }
              return {
                ...b,
                id: item.newCode,
                bomCode: item.newCode,
                code: item.newCode,
                grandTotal: gTotal > 0 ? gTotal : b.grandTotal,
                totalAmount: gTotal > 0 ? gTotal : b.totalAmount
              };
            }
          }
          return b;
        });
        if (changed) {
          fs.writeFileSync(diskPath, JSON.stringify(updatedList, null, 2), 'utf8');
          console.log(`✅ Updated ${diskUpdated} records in disk file: ${diskPath}`);
        }
      }
    } catch (diskErr) {
      console.warn('⚠️ Could not update disk file:', diskErr.message);
    }
  }

  console.log(`\n🎉 Renumbering Summary:`);
  console.log(`   - PostgreSQL bom_orders updated: ${pgUpdated}`);
  console.log(`   - controlroom_store items updated: ${crStoreUpdated}`);
  console.log(`   - Disk store items updated: ${diskUpdated}`);
  console.log(`   - Target 1: VRM-BOM-1132 -> VRMS/BOM/26-27/556 (SRI SASTHAA SOLAR)`);
  console.log(`   - Target 2: VRM-BOM-1166 -> VRMS/BOM/26-27/557 (Sri Vaarahi Enterprises)\n`);

  return { pgUpdated, crStoreUpdated, diskUpdated };
}

// Run standalone if executed directly
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  renumberBoms554And555().then(() => {
    process.exit(0);
  }).catch(err => {
    console.error(err);
    process.exit(1);
  });
}

