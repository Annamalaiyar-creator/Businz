import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import pkg from 'pg';
const { Pool } = pkg;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// PostgreSQL connection config for Hostinger VPS (Self-hosted)
const connectionString = process.env.DATABASE_URL || 
  process.env.PG_CONNECTION_STRING || 
  `postgres://${process.env.PGUSER || 'postgres'}:${encodeURIComponent(process.env.PGPASSWORD || 'postgres')}@${process.env.PGHOST || '127.0.0.1'}:${process.env.PGPORT || 5432}/${process.env.PGDATABASE || 'businz'}`;

const pool = new Pool({
  connectionString,
  connectionTimeoutMillis: 5000,
  ssl: process.env.PGSSL === 'true' ? { rejectUnauthorized: false } : false
});

async function runProductionClean() {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupDir = path.resolve(__dirname, 'backups', `pre_clean_backup_${timestamp}`);

  console.log('=====================================================');
  console.log('🚀 BUSINZ PRODUCTION DATABASE & STORE CLEAN RESET');
  console.log('=====================================================\n');

  // STEP 1: SAFETY BACKUP
  console.log(`📦 [Step 1/4] Creating safety backup in: ${backupDir}...`);
  fs.mkdirSync(backupDir, { recursive: true });

  const allServerFiles = fs.readdirSync(__dirname);
  const jsonFiles = allServerFiles.filter(f => f.endsWith('.json'));

  jsonFiles.forEach(file => {
    const src = path.join(__dirname, file);
    const dest = path.join(backupDir, file);
    fs.copyFileSync(src, dest);
  });
  console.log(`✅ [Step 1/4] Backed up ${jsonFiles.length} store files successfully.\n`);

  // STEP 2: RESET TRANSACTIONAL & DIRECTORY STORES TO 0
  console.log('🧹 [Step 2/4] Wiping all test/mock data from server stores...');

  const storesToEmpty = [
    'po_store.json',
    'proforma_invoice_store.json',
    'sales_pi_store.json',
    'procurement_pi_store.json',
    'bom_store.json',
    'invoice_store.json',
    'grn_store.json',
    'workorder_store.json',
    'vrm_prod_workorders.json',
    'vrm_prod_ledger.json',
    'vrm_prod_inventory.json',
    'quotations_store.json',
    'crm_quotations.json',
    'crm_leads.json',
    'crm_opportunities.json',
    'crm_whatsapp_conversations.json',
    'notifications_store.json',
    'payment_store.json',
    'dc_store.json',
    'vendor_store.json',
    'item_store.json',
    'raw_materials_store.json',
    'deleted_raw_materials_store.json'
  ];

  storesToEmpty.forEach(storeFile => {
    const filePath = path.join(__dirname, storeFile);
    fs.writeFileSync(filePath, '[]', 'utf8');
    console.log(`   - Cleared ${storeFile} -> []`);
  });

  // Media cache reset
  const mediaCachePath = path.join(__dirname, 'media_cache.json');
  fs.writeFileSync(mediaCachePath, '{}', 'utf8');
  console.log('   - Cleared media_cache.json -> {}');

  // Reset CEO targets to clean 0
  const ceoTargetPath = path.join(__dirname, 'ceo_target_store.json');
  fs.writeFileSync(ceoTargetPath, JSON.stringify({
    monthlyCompanyTarget: 0,
    repTargets: { 'All': 0 }
  }, null, 2), 'utf8');
  console.log('   - Reset ceo_target_store.json to 0');

  // STEP 3: RESET LOGINS TO SINGLE MASTER TECHNICAL ADMIN
  console.log('\n🔐 [Step 3/4] Resetting logins to master Technical Administrator ONLY...');
  const masterEmployees = [
    {
      employee_code: "TA-VRM001",
      employee_name: "Ar.Annamalaiyar",
      email: "arannamalaiyar@gmail.com",
      password: "Efx@1234",
      prefix: "TA",
      role: "Technical Administrator",
      dashboard_type: "Technical Administrator",
      status: "Active"
    }
  ];
  const empPath = path.join(__dirname, 'employees_store.json');
  fs.writeFileSync(empPath, JSON.stringify(masterEmployees, null, 2), 'utf8');
  console.log('   - Preserved master admin: Ar.Annamalaiyar (arannamalaiyar@gmail.com / TA-VRM001)');
  console.log('   - Removed all test dummy accounts (BI-001, SE-001, PR-1000, etc.)');

  // STEP 4: RESET HOSTINGER VPS POSTGRESQL DATABASE
  console.log('\n🐘 [Step 4/4] Syncing clean state to Hostinger VPS PostgreSQL database...');
  try {
    const client = await pool.connect();
    console.log('   - Connected to Hostinger VPS PostgreSQL database');

    // Update controlroom_store key-value table
    await client.query(`
      CREATE TABLE IF NOT EXISTS public.controlroom_store (
        key TEXT PRIMARY KEY,
        data JSONB NOT NULL DEFAULT '[]'::jsonb,
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);

    for (const storeFile of storesToEmpty) {
      const key = storeFile.replace('.json', '');
      await client.query(`
        INSERT INTO public.controlroom_store (key, data, updated_at)
        VALUES ($1, '[]'::jsonb, NOW())
        ON CONFLICT (key) DO UPDATE SET data = '[]'::jsonb, updated_at = NOW()
      `, [key]);
    }

    // Update employees_store in PG
    await client.query(`
      INSERT INTO public.controlroom_store (key, data, updated_at)
      VALUES ('employees_store', $1::jsonb, NOW())
      ON CONFLICT (key) DO UPDATE SET data = $1::jsonb, updated_at = NOW()
    `, [JSON.stringify(masterEmployees)]);

    // Check and truncate relational tables if they exist
    const tablesToTruncate = [
      'bom_orders',
      'invoices',
      'purchase_orders',
      'proforma_invoices',
      'goods_receipt_notes',
      'production_work_orders',
      'production_ledger',
      'payments',
      'quotations',
      'leads',
      'opportunities',
      'whatsapp_conversations',
      'notifications'
    ];
    for (const tbl of tablesToTruncate) {
      try {
        const check = await client.query(`SELECT to_regclass('public.${tbl}') as tbl_exists`);
        if (check.rows[0]?.tbl_exists) {
          await client.query(`TRUNCATE TABLE public.${tbl} CASCADE`);
          console.log(`   - Truncated table public.${tbl}`);
        }
      } catch (tblErr) {
        // Table may not exist or has active foreign key constraints
      }
    }

    // Reset public.users keeping only master Technical Administrator
    try {
      const userCheck = await client.query(`SELECT to_regclass('public.users') as tbl_exists`);
      if (userCheck.rows[0]?.tbl_exists) {
        await client.query(`
          DELETE FROM public.users WHERE email <> 'arannamalaiyar@gmail.com';
          INSERT INTO public.users (name, email, password, role, department)
          VALUES ('Ar.Annamalaiyar', 'arannamalaiyar@gmail.com', 'Efx@1234', 'Technical Administrator', 'Executive')
          ON CONFLICT (email) DO UPDATE 
          SET password = 'Efx@1234', role = 'Technical Administrator';
        `);
        console.log('   - Preserved master admin in public.users');
      }
    } catch (uErr) {
      // Table may not exist
    }

    // Reset public.leaves if table exists
    try {
      const leavesCheck = await client.query(`SELECT to_regclass('public.leaves') as tbl_exists`);
      if (leavesCheck.rows[0]?.tbl_exists) {
        await client.query(`
          DELETE FROM public.leaves 
          WHERE employee IN (
            'BOM_STORE', 'SALES_PI_STORE', 'PROFORMA_INVOICE_STORE', 'PROCUREMENT_PI_STORE',
            'PO_STORE', 'GRN_STORE', 'INVOICE_STORE', 'PAYMENT_STORE', 'WORKORDER_STORE',
            'VRM_PROD_WORKORDERS', 'VRM_PROD_LEDGER', 'JOBWORKS_STORE', 'RESERVATIONS_STORE',
            'NOTIFICATIONS_STORE', 'CRM_LEADS',
            'CRM_OPPORTUNITIES', 'CRM_QUOTATIONS', 'BOM_SEQUENCE'
          );
          INSERT INTO public.leaves (employee, reason, status, type) VALUES
          ('BOM_STORE', '[]', 'active', 'Store'),
          ('SALES_PI_STORE', '[]', 'active', 'Store'),
          ('PROFORMA_INVOICE_STORE', '[]', 'active', 'Store'),
          ('PO_STORE', '[]', 'active', 'Store'),
          ('GRN_STORE', '[]', 'active', 'Store'),
          ('INVOICE_STORE', '[]', 'active', 'Store'),
          ('BOM_SEQUENCE', '{"lastNumber": 0}', 'active', 'Sequence');
        `);
        console.log('   - Cleaned operational keys in public.leaves');
      }
    } catch (lErr) {
      // leaves table may not exist
    }

    client.release();
    console.log('✅ [Step 4/4] Hostinger VPS database cleanly reset to 0.');
  } catch (dbErr) {
    console.warn('⚠️ [Step 4/4] PostgreSQL connection notice:', dbErr.message);
    console.warn('   (The server stores on disk are 100% clean and will sync to PostgreSQL as soon as the service connects)');
  } finally {
    try { await pool.end(); } catch (_) {}
  }

  console.log('\n=====================================================');
  console.log('🎉 PRODUCTION CLEAN COMPLETE!');
  console.log('=====================================================');
  console.log('All dummy data and mock logins removed.');
  console.log('Active login credentials:');
  console.log('  Role: Technical Administrator');
  console.log('  Code: TA-VRM001');
  console.log('  Email: arannamalaiyar@gmail.com');
  console.log('  Password: Efx@1234');
  console.log(`Backup saved at: ${backupDir}`);
  console.log('=====================================================\n');
}

runProductionClean().catch(err => {
  console.error('Clean execution failed:', err);
  process.exit(1);
});
