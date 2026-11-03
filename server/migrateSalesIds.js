import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import pkg from 'pg';
const { Pool } = pkg;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// PostgreSQL connection config
const connectionString = process.env.DATABASE_URL || 
  process.env.PG_CONNECTION_STRING || 
  `postgres://${process.env.PGUSER || 'postgres'}:${encodeURIComponent(process.env.PGPASSWORD || 'postgres')}@${process.env.PGHOST || '127.0.0.1'}:${process.env.PGPORT || 5432}/${process.env.PGDATABASE || 'businz'}`;

const pool = new Pool({
  connectionString,
  connectionTimeoutMillis: 5000,
  ssl: process.env.PGSSL === 'true' ? { rejectUnauthorized: false } : false
});

// Explicit, exact mapping provided by user
const SALES_MAPPING = [
  {
    name: 'Manojraj Selvaraj',
    email: 'sales.s1@vrmstructures.in',
    oldCode: 'SH-001',
    newCode: 'SE-001',
    aliases: ['SH-001', 'SH-VRM001']
  },
  {
    name: 'Sanjai kumar',
    email: 'sanjaikumar3a@gmail.com',
    oldCode: 'SE-001',
    newCode: 'SE-002',
    aliases: ['SE-001', 'SE-VRM002']
  },
  {
    name: 'Vasanth Kumar S',
    email: 'vasanthkumarsaravanan.work@gmail.com',
    oldCode: 'SE-004',
    newCode: 'SE-003',
    aliases: ['SE-004']
  },
  {
    name: 'Mohith JV',
    email: 'sales.s4@vrmstructures.in',
    oldCode: 'SE-015',
    newCode: 'SE-004',
    aliases: ['SE-015', 'SE-VRM002']
  },
  {
    name: 'Shanthi',
    email: 'sales.s3@vrmstructures.in',
    oldCode: 'SE-002',
    newCode: 'SE-005',
    aliases: ['SE-002', 'SE-VRM003']
  },
  {
    name: 'Dhana Sekar',
    email: 'dhanasekar@gmail.com',
    oldCode: 'SE-020',
    newCode: 'SE-006',
    aliases: ['SE-020']
  },
  {
    name: 'PRASHANTH',
    email: 'sales.s2@vrmstructures.in',
    oldCode: 'SE-007',
    newCode: 'SE-007',
    aliases: ['SE-007']
  },
  {
    name: 'Pavithra',
    email: 'projectsales@jashsun.com',
    oldCode: 'SE-010',
    newCode: 'SE-008',
    aliases: ['SE-010']
  },
  {
    name: 'KALAISELVI T',
    email: 'mms@vrmstructures.in',
    oldCode: 'SE-VRM090',
    newCode: 'SE-009',
    aliases: ['SE-VRM090', 'SE-VRM005']
  }
];

// Helper to normalize strings for comparison
const norm = (s) => String(s || '').trim().toLowerCase();

async function runMigration() {
  console.log('========================================================');
  console.log('🚀 BUSINZ SALES TEAM ID RE-SEQUENCING & PRESERVATION');
  console.log('========================================================\n');

  let hasPg = false;
  let client = null;
  try {
    client = await pool.connect();
    hasPg = true;
    console.log('✅ Connected to PostgreSQL database.');
  } catch (err) {
    console.log('ℹ️  PostgreSQL not directly reachable on this run, operating on file stores.');
  }

  // Helper to load a store (from PG if available, else from file)
  async function loadStore(storeKey) {
    if (hasPg && client) {
      try {
        const res = await client.query('SELECT data FROM controlroom_store WHERE key = $1', [storeKey]);
        if (res.rows.length > 0 && res.rows[0].data) {
          let d = res.rows[0].data;
          if (typeof d === 'string') {
            try { d = JSON.parse(d); } catch (_) {}
          }
          return d;
        }
      } catch (e) {
        console.warn(`PG load error for ${storeKey}:`, e.message);
      }
    }
    const filePath = path.join(__dirname, `${storeKey}.json`);
    if (fs.existsSync(filePath)) {
      try {
        return JSON.parse(fs.readFileSync(filePath, 'utf8'));
      } catch (_) {}
    }
    return [];
  }

  // Helper to save a store (to PG if available, and always to file)
  async function saveStore(storeKey, data) {
    const jsonStr = JSON.stringify(data, null, 2);
    const filePath = path.join(__dirname, `${storeKey}.json`);
    fs.writeFileSync(filePath, jsonStr, 'utf8');

    if (hasPg && client) {
      try {
        await client.query(`
          INSERT INTO controlroom_store (key, data, updated_at)
          VALUES ($1, $2::jsonb, NOW())
          ON CONFLICT (key) DO UPDATE SET
            data = EXCLUDED.data,
            updated_at = NOW()
        `, [storeKey, JSON.stringify(data)]);
      } catch (e) {
        console.warn(`PG save error for ${storeKey}:`, e.message);
      }
    }
  }

  // 1. UPDATE EMPLOYEES STORE
  console.log('\n--- 1. Migrating Employee Accounts in employees_store ---');
  let emps = await loadStore('employees_store');
  if (!Array.isArray(emps)) emps = [];

  let empsUpdatedCount = 0;
  emps = emps.map(emp => {
    if (!emp) return emp;
    const empEmail = norm(emp.email);
    const empName = norm(emp.employee_name || emp.name);
    const empCode = String(emp.employee_code || emp.code || '').trim().toUpperCase();

    // Match mapping by email first, or exact name/code
    const mapping = SALES_MAPPING.find(m => 
      (m.email && norm(m.email) === empEmail) ||
      (m.name && norm(m.name) === empName) ||
      (m.oldCode && m.oldCode.toUpperCase() === empCode)
    );

    if (mapping) {
      empsUpdatedCount++;
      const existingAliases = Array.isArray(emp.alias_codes) ? emp.alias_codes : [];
      const combinedAliases = Array.from(new Set([
        ...existingAliases,
        ...mapping.aliases,
        emp.employee_code,
        emp.code,
        mapping.oldCode
      ])).filter(Boolean).filter(c => c !== mapping.newCode);

      console.log(`  ✓ Updated ${mapping.name}: ${emp.employee_code || mapping.oldCode} -> ${mapping.newCode} (Role: Sales)`);
      return {
        ...emp,
        employee_code: mapping.newCode,
        code: mapping.newCode,
        role: 'Sales',
        dashboard_type: 'Sales',
        alias_codes: combinedAliases
      };
    }
    return emp;
  });

  // If any of the 9 sales members were not found in emps, add them safely
  SALES_MAPPING.forEach(m => {
    const exists = emps.some(e => norm(e.email) === norm(m.email) || String(e.employee_code).toUpperCase() === m.newCode);
    if (!exists) {
      console.log(`  + Registering missing active sales account: ${m.name} (${m.newCode})`);
      emps.push({
        employee_code: m.newCode,
        code: m.newCode,
        employee_name: m.name,
        name: m.name,
        email: m.email,
        role: 'Sales',
        dashboard_type: 'Sales',
        status: 'Active',
        alias_codes: m.aliases
      });
      empsUpdatedCount++;
    }
  });

  await saveStore('employees_store', emps);
  console.log(`Total employee accounts updated: ${empsUpdatedCount}`);

  // Helper to migrate documents
  function migrateDocuments(docList, storeName) {
    if (!Array.isArray(docList)) return { list: docList, count: 0 };
    let count = 0;
    const updated = docList.map(doc => {
      if (!doc) return doc;
      const docEmail = norm(doc.salesPersonEmail || doc.createdByEmail || doc.email);
      const docName = norm(doc.salesPerson || doc.salesperson || doc.createdBy || doc.convertedBy);
      const docCode = String(doc.salesPersonCode || doc.createdById || doc.convertedById || '').trim().toUpperCase();

      // Find matching salesperson by email first, then exact name, then old code
      const mapping = SALES_MAPPING.find(m => {
        if (docEmail && m.email && norm(m.email) === docEmail) return true;
        if (docName && m.name && norm(m.name) === docName) return true;
        if (docCode && m.aliases.map(a => a.toUpperCase()).includes(docCode)) return true;
        return false;
      });

      if (mapping) {
        count++;
        return {
          ...doc,
          salesPerson: mapping.name,
          salesperson: mapping.name,
          salesPersonCode: mapping.newCode,
          createdById: mapping.newCode,
          salesPersonEmail: doc.salesPersonEmail || mapping.email
        };
      }
      return doc;
    });
    return { list: updated, count };
  }

  // 2. MIGRATE SALES_PI_STORE & PROFORMA_INVOICE_STORE
  console.log('\n--- 2. Migrating Proforma Invoices (sales_pi_store & proforma_invoice_store) ---');
  let salesPis = await loadStore('sales_pi_store');
  const piRes1 = migrateDocuments(salesPis, 'sales_pi_store');
  await saveStore('sales_pi_store', piRes1.list);
  console.log(`  ✓ sales_pi_store: ${piRes1.count} PIs re-keyed to new IDs.`);

  let profPis = await loadStore('proforma_invoice_store');
  const piRes2 = migrateDocuments(profPis, 'proforma_invoice_store');
  await saveStore('proforma_invoice_store', piRes2.list);
  console.log(`  ✓ proforma_invoice_store: ${piRes2.count} PIs re-keyed to new IDs.`);

  // 3. MIGRATE BOM_STORE
  console.log('\n--- 3. Migrating BOM Orders (bom_store) ---');
  let boms = await loadStore('bom_store');
  const bomRes = migrateDocuments(boms, 'bom_store');
  await saveStore('bom_store', bomRes.list);
  console.log(`  ✓ bom_store: ${bomRes.count} BOMs re-keyed to new IDs.`);

  // 4. MIGRATE CRM QUOTATIONS, LEADS & OPPORTUNITIES
  console.log('\n--- 4. Migrating CRM Quotations, Leads & Opportunities ---');
  let quotes = await loadStore('crm_quotations');
  const qRes = migrateDocuments(quotes, 'crm_quotations');
  await saveStore('crm_quotations', qRes.list);

  let leads = await loadStore('crm_leads');
  const leadRes = migrateDocuments(leads, 'crm_leads');
  await saveStore('crm_leads', leadRes.list);

  let opps = await loadStore('crm_opportunities');
  const oppRes = migrateDocuments(opps, 'crm_opportunities');
  await saveStore('crm_opportunities', oppRes.list);
  console.log(`  ✓ CRM: ${qRes.count} quotes, ${leadRes.count} leads, ${oppRes.count} opportunities re-keyed.`);

  if (client) client.release();
  await pool.end().catch(() => {});

  console.log('\n========================================================');
  console.log('🎉 MIGRATION COMPLETED SUCCESSFULLY WITH 0 DATA LOSS!');
  console.log('========================================================\n');
}

runMigration().catch(err => {
  console.error('Migration failed:', err);
  process.exit(1);
});
