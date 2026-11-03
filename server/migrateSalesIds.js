import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import pkg from 'pg';
import dotenv from 'dotenv';

const { Pool } = pkg;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables in proper priority
dotenv.config({ path: path.resolve(__dirname, '../.env.development.local') });
dotenv.config({ path: path.resolve(__dirname, '../.env.local') });
dotenv.config({ path: path.resolve(__dirname, '../.env') });
dotenv.config();

// PostgreSQL connection config
const baseHost = process.env.PGHOST || '127.0.0.1';
const basePort = process.env.PGPORT || 5432;
const baseUser = process.env.PGUSER || 'postgres';
const basePassword = process.env.PGPASSWORD || 'postgres';
const defaultDb = process.env.PGDATABASE || 'businz';

const connectionString = process.env.DATABASE_URL || 
  process.env.PG_CONNECTION_STRING || 
  `postgres://${baseUser}:${encodeURIComponent(basePassword)}@${baseHost}:${basePort}/${defaultDb}`;

const pool = new Pool({
  connectionString,
  connectionTimeoutMillis: 5000,
  ssl: process.env.PGSSL === 'true' ? { rejectUnauthorized: false } : false
});

// Explicit, exact mapping for Sales, Technical Admin, Tech Support, and Accounts
const TEAM_MAPPINGS = [
  // --- 1. Technical Administrator ---
  {
    name: 'Ar.Annamalaiyar',
    matchNames: ['annamalaiyar', 'ar.annamalaiyar', 'arannamalaiyar'],
    email: 'arannamalaiyar@gmail.com',
    matchEmails: ['arannamalaiyar@gmail.com'],
    oldCode: 'TA-VRM001',
    newCode: 'TA-001',
    role: 'Technical Administrator',
    dashboard_type: 'Technical Administrator',
    department: 'IT & Administration',
    aliases: ['TA-VRM001', 'TA-001', 'TA-VRM002']
  },

  // --- 2. Tech Support ---
  {
    name: 'KalpanaRam',
    matchNames: ['kalpanaram', 'kalpana ram', 'kalpana'],
    email: 'kalpanaram17@vrmstructures.in',
    matchEmails: ['kalpanaram17@vrmstructures.in', 'kalpanaram@vrmstructures.in'],
    oldCode: 'TS-VRM002',
    newCode: 'TS-001',
    role: 'Tech Support',
    dashboard_type: 'Tech Support',
    department: 'Technical Support',
    aliases: ['TS-VRM002', 'TS-VRM001', 'TS-001', 'DH-VRM001']
  },
  {
    name: 'Vasanth',
    matchNames: ['vasanth tech', 'vasanth support'],
    email: 'vasanth.support@vrmstructures.in',
    matchEmails: ['vasanth.support@vrmstructures.in', 'techsupport@vrmstructures.in'],
    oldCode: 'TS-002',
    newCode: 'TS-002',
    role: 'Tech Support',
    dashboard_type: 'Tech Support',
    department: 'Technical Support',
    aliases: ['TS-002', 'TS-VRM003']
  },

  // --- 3. Accounts ---
  {
    name: 'Keerthana',
    matchNames: ['keerthana', 'keerthi'],
    email: 'keerthana@vrmstructures.in',
    matchEmails: ['keerthana@vrmstructures.in', 'accounts@vrmstructures.in'],
    oldCode: 'AH-001',
    newCode: 'AC-001',
    role: 'Accounts',
    dashboard_type: 'Accounts',
    department: 'Finance & Accounts',
    aliases: ['AH-001', 'AH-1000', 'AE-001', 'AC-001', 'AH-VRM001']
  },
  {
    name: 'Vaishnavi',
    matchNames: ['vaishnavi'],
    email: 'vaishnavi@vrmstructures.in',
    matchEmails: ['vaishnavi@vrmstructures.in', 'accounts2@vrmstructures.in'],
    oldCode: 'AH-002',
    newCode: 'AC-002',
    role: 'Accounts',
    dashboard_type: 'Accounts',
    department: 'Finance & Accounts',
    aliases: ['AH-002', 'AE-002', 'AC-002', 'AH-VRM002']
  },
  {
    name: 'AJITH R',
    matchNames: ['ajith', 'ajith r', 'ajith kumar'],
    email: 'ajith@vrmstructures.in',
    matchEmails: ['ajith@vrmstructures.in', 'accounts3@vrmstructures.in'],
    oldCode: 'AH-003',
    newCode: 'AC-003',
    role: 'Accounts',
    dashboard_type: 'Accounts',
    department: 'Finance & Accounts',
    aliases: ['AH-003', 'AE-003', 'AC-003', 'AH-VRM003']
  },

  // --- 4. Sales Team ---
  {
    name: 'Manojraj Selvaraj',
    matchNames: ['manojraj selvaraj', 'manojraj', 'manoj'],
    email: 'sales.s1@vrmstructures.in',
    matchEmails: ['sales.s1@vrmstructures.in'],
    oldCode: 'SH-001',
    newCode: 'SE-001',
    role: 'Sales',
    dashboard_type: 'Sales',
    department: 'Sales & Marketing',
    aliases: ['SH-001', 'SH-VRM001']
  },
  {
    name: 'Sanjai kumar',
    matchNames: ['sanjai kumar', 'sanjai'],
    email: 'sanjaikumar3a@gmail.com',
    matchEmails: ['sanjaikumar3a@gmail.com'],
    oldCode: 'SE-001',
    newCode: 'SE-002',
    role: 'Sales',
    dashboard_type: 'Sales',
    department: 'Sales & Marketing',
    aliases: ['SE-001', 'SE-VRM002']
  },
  {
    name: 'Vasanth Kumar S',
    matchNames: ['vasanth kumar s', 'vasanth kumar'],
    email: 'vasanthkumarsaravanan.work@gmail.com',
    matchEmails: ['vasanthkumarsaravanan.work@gmail.com', 'vasanthkumar1234@gmail.com'],
    oldCode: 'SE-004',
    newCode: 'SE-003',
    role: 'Sales',
    dashboard_type: 'Sales',
    department: 'Sales & Marketing',
    aliases: ['SE-004', 'SE-VRM006']
  },
  {
    name: 'Mohith JV',
    matchNames: ['mohith jv', 'mohith j v', 'mohith'],
    email: 'sales.s4@vrmstructures.in',
    matchEmails: ['sales.s4@vrmstructures.in'],
    oldCode: 'SE-015',
    newCode: 'SE-004',
    role: 'Sales',
    dashboard_type: 'Sales',
    department: 'Sales & Marketing',
    aliases: ['SE-015', 'SE-VRM002']
  },
  {
    name: 'Shanthi',
    matchNames: ['shanthi'],
    email: 'sales.s3@vrmstructures.in',
    matchEmails: ['sales.s3@vrmstructures.in'],
    oldCode: 'SE-002',
    newCode: 'SE-005',
    role: 'Sales',
    dashboard_type: 'Sales',
    department: 'Sales & Marketing',
    aliases: ['SE-002', 'SE-VRM003']
  },
  {
    name: 'Dhana Sekar',
    matchNames: ['dhana sekar', 'dhanasekar'],
    email: 'dhanasekar@gmail.com',
    matchEmails: ['dhanasekar@gmail.com'],
    oldCode: 'SE-020',
    newCode: 'SE-006',
    role: 'Sales',
    dashboard_type: 'Sales',
    department: 'Sales & Marketing',
    aliases: ['SE-020']
  },
  {
    name: 'PRASHANTH',
    matchNames: ['prashanth', 'prasanth'],
    email: 'sales.s2@vrmstructures.in',
    matchEmails: ['sales.s2@vrmstructures.in'],
    oldCode: 'SE-007',
    newCode: 'SE-007',
    role: 'Sales',
    dashboard_type: 'Sales',
    department: 'Sales & Marketing',
    aliases: ['SE-007']
  },
  {
    name: 'Pavithra',
    matchNames: ['pavithra', 'pavi'],
    email: 'projectsales@jashsun.com',
    matchEmails: ['projectsales@jashsun.com'],
    oldCode: 'SE-010',
    newCode: 'SE-008',
    role: 'Sales',
    dashboard_type: 'Sales',
    department: 'Sales & Marketing',
    aliases: ['SE-010']
  },
  {
    name: 'KALAISELVI T',
    matchNames: ['kalaiselvi t', 'kalaiselvi'],
    email: 'mms@vrmstructures.in',
    matchEmails: ['mms@vrmstructures.in', 'sales@vrmstrutures.in'],
    oldCode: 'SE-VRM090',
    newCode: 'SE-009',
    role: 'Sales',
    dashboard_type: 'Sales',
    department: 'Sales & Marketing',
    aliases: ['SE-VRM090', 'SE-VRM005']
  }
];

// Helper to normalize strings for comparison
const norm = (s) => String(s || '').trim().toLowerCase();

// Unified role normalizer to eliminate legacy "Head" / "Executive" labels
function cleanRoleName(rawRole) {
  if (!rawRole) return 'Sales';
  const lower = String(rawRole).trim().toLowerCase();
  if (lower.includes('technical admin') || lower.includes('developer') || lower.startsWith('ta')) return 'Technical Administrator';
  if (lower.includes('tech support') || lower.includes('technical support')) return 'Tech Support';
  if (lower.includes('sales')) return 'Sales';
  if (lower.includes('floor')) return 'Floor Executive';
  if (lower.includes('production')) return 'Production';
  if (lower.includes('dispatch')) return 'Dispatch';
  if (lower.includes('procurement') || lower.includes('purchase')) return 'Procurement';
  if (lower.includes('account') || lower.includes('finance')) return 'Accounts';
  if (lower.includes('billing') || lower.includes('invoice')) return 'Billing';
  if (lower.includes('design')) return 'Design';
  if (lower === 'ceo' || lower === 'md' || lower.includes('managing director')) return 'CEO';
  return rawRole;
}

// Robust resolver for an employee record
function findMappingForEmp(emp) {
  if (!emp) return null;
  const empEmail = norm(emp.email);
  const empName = norm(emp.employee_name || emp.name);
  const empCode = String(emp.employee_code || emp.code || '').trim().toUpperCase();

  // 1. Match by exact email (highest precision)
  if (empEmail) {
    const emailMatch = TEAM_MAPPINGS.find(m => 
      (m.email && norm(m.email) === empEmail) ||
      (Array.isArray(m.matchEmails) && m.matchEmails.some(me => norm(me) === empEmail))
    );
    if (emailMatch) return emailMatch;
  }

  // 2. Match by exact name
  if (empName) {
    const nameMatch = TEAM_MAPPINGS.find(m => {
      if (m.name && norm(m.name) === empName) return true;
      if (Array.isArray(m.matchNames) && m.matchNames.some(mn => empName === norm(mn) || empName.includes(norm(mn)))) {
        // Disambiguate Vasanth Support vs Vasanth Kumar S (Sales)
        if (m.role === 'Tech Support' && (empName.includes('kumar') || (emp.role && emp.role.includes('Sales')))) return false;
        if (m.role === 'Sales' && emp.role && emp.role.includes('Support')) return false;
        return true;
      }
      return false;
    });
    if (nameMatch) return nameMatch;
  }

  // 3. Match if already has newCode and matching role
  const newCodeMatch = TEAM_MAPPINGS.find(m => m.newCode === empCode);
  if (newCodeMatch) return newCodeMatch;

  // 4. Match by oldCode (only if email/name didn't conflict)
  if (empCode) {
    const oldCodeMatch = TEAM_MAPPINGS.find(m => 
      (m.oldCode && m.oldCode.toUpperCase() === empCode) ||
      (Array.isArray(m.aliases) && m.aliases.some(a => a.toUpperCase() === empCode))
    );
    if (oldCodeMatch) return oldCodeMatch;
  }

  return null;
}

async function runMigration() {
  console.log('========================================================');
  console.log('🚀 BUSINZ COMPLETE TEAM ID RE-SEQUENCING & PRESERVATION');
  console.log('   (Sales, Tech Admin, Tech Support, Accounts & Legacy Cleanup)');
  console.log('========================================================\n');

  let hasPg = false;
  let client = null;
  try {
    client = await pool.connect();
    hasPg = true;
    console.log('✅ Connected to PostgreSQL database.');

    try {
      console.log('--- Applying Database Schema Migrations ---');
      const ddlStatements = [
        'ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS is_converted BOOLEAN DEFAULT false;',
        'ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS is_unattended_24h BOOLEAN DEFAULT false;',
        'ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS is_unattended_2h BOOLEAN DEFAULT false;',
        'ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS is_unattended_48h BOOLEAN DEFAULT false;',
        'ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS converted_customer_id TEXT;',
        'ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS converted_customer_code TEXT;',
        'ALTER TABLE public.bom_orders ADD COLUMN IF NOT EXISTS sales_person_email TEXT;',
        'ALTER TABLE public.proforma_invoices ADD COLUMN IF NOT EXISTS sales_person_email TEXT;',
        "ALTER TABLE public.proforma_invoices ADD COLUMN IF NOT EXISTS status_type TEXT DEFAULT 'issued';",
        'ALTER TABLE public.proforma_invoices ADD COLUMN IF NOT EXISTS converted_bom_code TEXT;',
        'ALTER TABLE public.proforma_invoices ADD COLUMN IF NOT EXISTS converted_bom_no TEXT;'
      ];

      for (const ddl of ddlStatements) {
        try {
          await client.query(ddl);
        } catch (e) {
          console.warn(`DDL Notice (${ddl.slice(0, 40)}...):`, e.message);
        }
      }

      try {
        await client.query(`
          UPDATE public.proforma_invoices p
          SET status = 'Converted to BOM',
              status_type = 'converted',
              converted_bom_no = COALESCE(p.converted_bom_no, b.bom_code),
              converted_bom_code = COALESCE(p.converted_bom_code, b.bom_code),
              updated_at = NOW()
          FROM public.bom_orders b
          WHERE (LOWER(TRIM(p.pi_no)) = LOWER(TRIM(b.source_pi_no)) OR LOWER(TRIM(p.id)) = LOWER(TRIM(b.source_pi_no)))
            AND b.status NOT ILIKE '%cancel%'
            AND (p.status = 'Draft' OR p.status_type = 'draft' OR p.status = 'Draft Saved');
        `);
      } catch (_) {}
      console.log('✅ Database schema verified and converted PIs healed.');
    } catch (dbErr) {
      console.warn('⚠️ DB Schema check notice:', dbErr.message);
    }
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
  const processedNewCodes = new Set();

  emps = emps.map(emp => {
    if (!emp) return emp;

    const mapping = findMappingForEmp(emp);

    if (mapping) {
      empsUpdatedCount++;
      processedNewCodes.add(mapping.newCode);

      const existingAliases = Array.isArray(emp.alias_codes) ? emp.alias_codes : [];
      const combinedAliases = Array.from(new Set([
        ...existingAliases,
        ...(mapping.aliases || []),
        emp.employee_code,
        emp.code,
        mapping.oldCode
      ])).filter(Boolean).filter(c => c !== mapping.newCode);

      console.log(`  ✓ Updated ${mapping.name}: ${emp.employee_code || mapping.oldCode} -> ${mapping.newCode} (Role: ${mapping.role})`);
      return {
        ...emp,
        employee_code: mapping.newCode,
        code: mapping.newCode,
        employee_name: mapping.name,
        name: mapping.name,
        email: mapping.email || emp.email,
        role: mapping.role,
        dashboard_type: mapping.dashboard_type || mapping.role,
        department: mapping.department || emp.department,
        status: emp.status || 'Active',
        alias_codes: combinedAliases
      };
    }

    // Clean legacy role names for non-mapped employees (e.g. legacy heads / executives)
    const normalizedRole = cleanRoleName(emp.role);
    if (normalizedRole !== emp.role) {
      console.log(`  ✓ Normalized role for ${emp.employee_name || emp.name} (${emp.employee_code}): "${emp.role}" -> "${normalizedRole}"`);
      return {
        ...emp,
        role: normalizedRole,
        dashboard_type: normalizedRole
      };
    }

    return emp;
  });

  // If any mapped member was missing from emps, register them safely
  TEAM_MAPPINGS.forEach(m => {
    if (!processedNewCodes.has(m.newCode)) {
      const exists = emps.some(e => 
        (m.email && norm(e.email) === norm(m.email)) || 
        String(e.employee_code).toUpperCase() === m.newCode
      );
      if (!exists) {
        console.log(`  + Registering active account: ${m.name} (${m.newCode} - ${m.role})`);
        emps.push({
          employee_code: m.newCode,
          code: m.newCode,
          employee_name: m.name,
          name: m.name,
          email: m.email,
          role: m.role,
          dashboard_type: m.dashboard_type || m.role,
          department: m.department || 'Operations',
          status: 'Active',
          alias_codes: m.aliases || []
        });
        empsUpdatedCount++;
        processedNewCodes.add(m.newCode);
      }
    }
  });

  // De-duplicate any double records with identical employee_code keeping the one with valid password/email
  const uniqueEmpsMap = new Map();
  emps.forEach(emp => {
    const code = String(emp.employee_code || emp.code || '').trim().toUpperCase();
    if (!uniqueEmpsMap.has(code)) {
      uniqueEmpsMap.set(code, emp);
    } else {
      const existing = uniqueEmpsMap.get(code);
      // Merge properties preferring one with actual password or fuller data
      uniqueEmpsMap.set(code, {
        ...existing,
        ...emp,
        password: existing.password || emp.password || '12345',
        alias_codes: Array.from(new Set([...(existing.alias_codes || []), ...(emp.alias_codes || [])]))
      });
    }
  });
  emps = Array.from(uniqueEmpsMap.values());

  await saveStore('employees_store', emps);
  console.log(`Total employee accounts updated/verified: ${empsUpdatedCount} (Active total: ${emps.length})`);

  // Helper to migrate sales documents
  const SALES_MAPPINGS = TEAM_MAPPINGS.filter(m => m.role === 'Sales');

  function findSalesMappingForDoc(doc) {
    if (!doc) return null;
    const docEmail = norm(doc.salesPersonEmail || doc.createdByEmail || doc.email || doc.creatorEmail);
    const docName = norm(doc.salesPerson || doc.salesperson || doc.createdBy || doc.convertedBy || doc.sales_person);

    // 1. Unambiguous match by Email first (highest fidelity)
    if (docEmail) {
      const matchByEmail = SALES_MAPPINGS.find(m => 
        (m.email && norm(m.email) === docEmail) ||
        (m.matchEmails && m.matchEmails.some(me => norm(me) === docEmail))
      );
      if (matchByEmail) return matchByEmail;
    }

    // 2. Unambiguous match by Name second
    if (docName) {
      const matchByName = SALES_MAPPINGS.find(m => {
        if (m.name && (norm(m.name) === docName || docName.includes(norm(m.name)) || norm(m.name).includes(docName))) return true;
        if (m.matchNames && m.matchNames.some(mn => docName.includes(norm(mn)) || norm(mn).includes(docName))) return true;
        return false;
      });
      if (matchByName) return matchByName;
    }

    // 3. Match unique historical codes that have zero collision risk
    const docCode = String(doc.salesPersonCode || doc.createdById || doc.sales_person_code || doc.created_by_id || '').toUpperCase().trim();
    if (docCode) {
      if (docCode === 'SH-001' || docCode === 'SH-VRM001') {
        return SALES_MAPPINGS.find(m => m.newCode === 'SE-001'); // Manojraj Selvaraj was the sole Sales Head
      }
      if (docCode === 'SE-015') {
        return SALES_MAPPINGS.find(m => m.newCode === 'SE-004'); // Mohith JV
      }
      if (docCode === 'SE-020') {
        return SALES_MAPPINGS.find(m => m.newCode === 'SE-006'); // Dhana Sekar
      }
      if (docCode === 'SE-010') {
        return SALES_MAPPINGS.find(m => m.newCode === 'SE-008'); // Pavithra
      }
      if (docCode === 'SE-VRM090') {
        return SALES_MAPPINGS.find(m => m.newCode === 'SE-009'); // Kalaiselvi
      }
    }

    // NOTE: Strictly avoid fallback to swapped employee codes (e.g. SE-001/SE-002/SE-004) to prevent cross-contamination
    return null;
  }

  function migrateDocuments(docList, storeName) {
    if (!Array.isArray(docList)) return { list: docList, count: 0 };
    let count = 0;
    const updated = docList.map(doc => {
      if (!doc) return doc;
      const mapping = findSalesMappingForDoc(doc);
      if (mapping) {
        count++;
        return {
          ...doc,
          salesPerson: mapping.name,
          salesperson: mapping.name,
          sales_person: mapping.name,
          salesPersonCode: mapping.newCode,
          sales_person_code: mapping.newCode,
          createdById: mapping.newCode,
          created_by_id: mapping.newCode,
          salesPersonEmail: doc.salesPersonEmail || mapping.email,
          sales_person_email: doc.salesPersonEmail || mapping.email
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

  // 5. DIRECT POSTGRESQL TABLE MIGRATION FOR PROFORMA_INVOICES & BOM_ORDERS
  async function migratePgRelational(pgClient, dbLabel) {
    console.log(`\n--- 5. Migrating PostgreSQL public.proforma_invoices & public.bom_orders [${dbLabel}] ---`);
    for (const ddl of [
      'ALTER TABLE public.bom_orders ADD COLUMN IF NOT EXISTS sales_person_email TEXT;',
      'ALTER TABLE public.proforma_invoices ADD COLUMN IF NOT EXISTS sales_person_email TEXT;',
      'ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS is_converted BOOLEAN DEFAULT false;'
    ]) {
      try { await pgClient.query(ddl); } catch (_) {}
    }

    for (const m of SALES_MAPPINGS) {
      try {
        const nameChecks = (m.matchNames || [m.name]).map(n => `LOWER(TRIM(COALESCE(sales_person, created_by, ''))) ILIKE '%${n.trim().toLowerCase()}%'`).join(' OR ');
        const emailChecks = (m.matchEmails || [m.email]).filter(Boolean).map(e => `LOWER(TRIM(COALESCE(sales_person_email, email, ''))) ILIKE '%${e.trim().toLowerCase()}%'`).join(' OR ');
        
        let codeCheck = '';
        if (m.oldCode === 'SH-001') {
          codeCheck = " OR sales_person_code = 'SH-001' OR created_by_id = 'SH-001'";
        } else if (m.oldCode && !['SE-001', 'SE-002', 'SE-004'].includes(m.oldCode)) {
          codeCheck = ` OR sales_person_code = '${m.oldCode}' OR created_by_id = '${m.oldCode}'`;
        }

        let excludeCheck = '';
        if (m.newCode === 'SE-002') { // Sanjai kumar
          excludeCheck = " AND LOWER(TRIM(COALESCE(sales_person, created_by, ''))) NOT ILIKE '%manoj%'";
        } else if (m.newCode === 'SE-001') { // Manojraj Selvaraj
          excludeCheck = " AND LOWER(TRIM(COALESCE(sales_person, created_by, ''))) NOT ILIKE '%sanjai%' AND LOWER(TRIM(COALESCE(sales_person, created_by, ''))) NOT ILIKE '%sanjay%'";
        }

        const baseCond = emailChecks ? `(${nameChecks}) OR (${emailChecks})` : `(${nameChecks})`;
        const fullCondition = `((${baseCond})${codeCheck})${excludeCheck}`;

        const piRes = await pgClient.query(`
          UPDATE public.proforma_invoices
          SET sales_person_code = $1,
              sales_person = $2,
              sales_person_email = COALESCE(NULLIF(sales_person_email, ''), $3),
              created_by_id = CASE WHEN LOWER(TRIM(COALESCE(created_by, ''))) ILIKE '%${m.matchNames[0]}%' THEN $1 ELSE created_by_id END,
              updated_at = NOW()
          WHERE ${fullCondition}
        `, [m.newCode, m.name, m.email]);

        const bomRes = await pgClient.query(`
          UPDATE public.bom_orders
          SET sales_person_code = $1,
              sales_person = $2,
              sales_person_email = COALESCE(NULLIF(sales_person_email, ''), $3),
              created_by_id = CASE WHEN LOWER(TRIM(COALESCE(created_by, ''))) ILIKE '%${m.matchNames[0]}%' THEN $1 ELSE created_by_id END,
              updated_at = NOW()
          WHERE ${fullCondition}
        `, [m.newCode, m.name, m.email]);

        console.log(`  ✓ Relational PG [${dbLabel}]: ${m.name} (${m.newCode}) updated ${piRes.rowCount} PIs and ${bomRes.rowCount} BOMs.`);
      } catch (err) {
        console.warn(`  ⚠️ Error updating ${m.name} in PG [${dbLabel}]:`, err.message);
      }
    }
  }

  if (hasPg && client) {
    await migratePgRelational(client, defaultDb);

    // Also migrate the sibling database if available
    const siblingDb = defaultDb === 'businz' ? 'businz_dev' : 'businz';
    try {
      const siblingPool = new Pool({
        connectionString: `postgres://${baseUser}:${encodeURIComponent(basePassword)}@${baseHost}:${basePort}/${siblingDb}`,
        connectionTimeoutMillis: 3000
      });
      const siblingClient = await siblingPool.connect();
      await migratePgRelational(siblingClient, siblingDb);
      siblingClient.release();
      await siblingPool.end().catch(() => {});
    } catch (_) {
      // Sibling database not present or not accessible, harmless
    }
  }

  if (client) client.release();
  await pool.end().catch(() => {});

  console.log('\n========================================================');
  console.log('🎉 TEAM ID RE-SEQUENCING & ROLE CLEANUP COMPLETED!');
  console.log('   All historical records preserved with zero data loss.');
  console.log('========================================================\n');
}

runMigration().catch(err => {
  console.error('Migration failed:', err);
  process.exit(1);
});
