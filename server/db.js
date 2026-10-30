import pkg from 'pg';
const { Pool, types } = pkg;
if (types && typeof types.setTypeParser === 'function') {
  // 1082 is PostgreSQL DATE OID. Return raw 'YYYY-MM-DD' string to avoid UTC timezone shifts to 18:30:00.000Z
  types.setTypeParser(1082, str => str);
}
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { getStoreFilePath } from './runtimePaths.js';
import {
  isOptimizationTestMode,
  validateDatabaseConfigForTestMode,
  REQUIRED_TEST_DATABASE,
  REQUIRED_TEST_DB_ROLE
} from './optimizationTestGuard.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment files in priority order without overriding explicitly provided environment variables
dotenv.config({ path: path.resolve(__dirname, '../.env.development.local') });
dotenv.config({ path: path.resolve(__dirname, '../.env.local') });
dotenv.config({ path: path.resolve(__dirname, '../.env') });
dotenv.config();

// Resolve default database name - strictly require dedicated test DB in test mode
let defaultDbName = 'businz';
if (isOptimizationTestMode()) {
  defaultDbName = (process.env.BUSINZ_TEST_DATABASE || process.env.PGDATABASE || '').trim();
}

// PostgreSQL connection config for Hostinger VPS (Self-hosted)
const connectionString = process.env.DATABASE_URL || 
  process.env.PG_CONNECTION_STRING || 
  (defaultDbName ? `postgres://${process.env.PGUSER || 'postgres'}:${encodeURIComponent(process.env.PGPASSWORD || 'postgres')}@${process.env.PGHOST || '127.0.0.1'}:${process.env.PGPORT || 5432}/${defaultDbName}` : '');

// Fail closed immediately before creating pool if optimization test mode is active and database is unverified or forbidden
if (isOptimizationTestMode()) {
  validateDatabaseConfigForTestMode(connectionString);
}

export const pool = new Pool({
  connectionString: connectionString || undefined,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
  ssl: process.env.PGSSL === 'true' ? { rejectUnauthorized: false } : false
});

let isConnected = false;

pool.on('connect', () => {
  isConnected = true;
});

pool.on('error', (err) => {
  console.warn('[PostgreSQL Pool Warning (Idle client closed)]:', err.message);
  // Do NOT permanently set isConnected to false on routine idle client disconnection.
  // The pool automatically establishes a new client on the next query.
  if (err?.code === 'ECONNREFUSED' || err?.code === '57P01' || err?.code === '57P02' || err?.code === '57P03') {
    isConnected = false;
  }
});

export async function query(text, params) {
  try {
    const res = await pool.query(text, params);
    isConnected = true;
    return res;
  } catch (err) {
    if (err?.code === 'ECONNREFUSED' || err?.code === '57P01' || err?.code === '57P02' || err?.code === '57P03') {
      isConnected = false;
    }
    throw err;
  }
}

export function isDbConnected() {
  return Boolean(isConnected && pool && !pool.ending && !pool.ended);
}

/**
 * Verifies database connectivity using an actual bounded PostgreSQL query (SELECT 1).
 * Updates internal connection state and returns genuine health status.
 *
 * Hardened for Phase 6B:
 * 1. Bounded connection acquisition (timeout 1) AND bounded query execution (timeout 2).
 * 2. Guaranteed zero client leak on late-arriving connection: client is immediately released
 *    if connection completes after the timeout has fired.
 * 3. Guaranteed client release in all completion, error, and timeout paths.
 * 4. Never reports connectivity success after a timeout has fired.
 * 5. Preserves existing API response contract: { ok: boolean, latencyMs?: number, database?: string, error?: string }.
 *
 * @param {number} timeoutMs Maximum time to wait for database response (default: 3000ms)
 * @returns {Promise<{ ok: boolean, latencyMs?: number, database?: string, error?: string }>}
 */
export async function verifyDbConnectivity(timeoutMs = 3000) {
  if (!pool || pool.ending || pool.ended) {
    isConnected = false;
    return { ok: false, error: 'Database pool is not active or has ended' };
  }

  const start = Date.now();
  let client = null;
  let timer = null;
  let hasTimedOut = false;

  try {
    // 1. Connection acquisition with late-arrival cleanup protection
    const timeoutPromise = new Promise((_, reject) => {
      timer = setTimeout(() => {
        hasTimedOut = true;
        reject(new Error(`Database connectivity check timed out after ${timeoutMs}ms`));
      }, timeoutMs);
    });

    const connectPromise = pool.connect().then((acquiredClient) => {
      if (hasTimedOut) {
        // Late arriving client! Must release immediately to prevent pool leak
        try {
          acquiredClient.release();
        } catch (_) {}
        return null;
      }
      return acquiredClient;
    }).catch((err) => {
      if (hasTimedOut) {
        // Late arriving error, swallow as timeout already handled the response
        return null;
      }
      throw err;
    });

    client = await Promise.race([connectPromise, timeoutPromise]);
    if (!client && hasTimedOut) {
      throw new Error(`Database connectivity check timed out after ${timeoutMs}ms`);
    }

    // 2. Query execution bounded by remaining timeout
    const elapsed = Date.now() - start;
    const remainingTime = Math.max(500, timeoutMs - elapsed);

    let queryTimer = null;
    const queryTimeoutPromise = new Promise((_, reject) => {
      queryTimer = setTimeout(() => {
        hasTimedOut = true;
        reject(new Error(`Database health-check query timed out after ${remainingTime}ms`));
      }, remainingTime);
    });

    try {
      const res = await Promise.race([
        client.query('SELECT current_database() as db_name, 1 as health_check;'),
        queryTimeoutPromise
      ]);

      if (hasTimedOut) {
        throw new Error(`Database connectivity check timed out`);
      }

      isConnected = true;
      const latencyMs = Date.now() - start;
      return {
        ok: true,
        latencyMs,
        database: res.rows[0]?.db_name || 'unknown'
      };
    } finally {
      if (queryTimer) clearTimeout(queryTimer);
    }
  } catch (err) {
    isConnected = false;
    return {
      ok: false,
      error: err.message || String(err)
    };
  } finally {
    if (timer) clearTimeout(timer);
    if (client) {
      try {
        client.release();
      } catch (_) {}
      client = null;
    }
  }
}

/**
 * Initializes the clean schema on the self-hosted PostgreSQL database.
 * Executes supabase_main_schema.sql if tables do not exist.
 */
export async function initPostgresDatabase() {
  try {
    if (isOptimizationTestMode()) {
      validateDatabaseConfigForTestMode(connectionString);
    }

    const client = await pool.connect();
    isConnected = true;

    // Defense-in-depth: In test mode, verify database and role directly from PostgreSQL metadata
    if (isOptimizationTestMode()) {
      const auditRes = await client.query('SELECT current_database() as db_name, current_user as role_name;');
      const activeDb = auditRes.rows[0]?.db_name;
      const activeRole = auditRes.rows[0]?.role_name;

      if (activeDb !== REQUIRED_TEST_DATABASE) {
        client.release();
        throw new Error(
          `[DATABASE-ISOLATION-FAIL-CLOSED] Refusing schema initialization! ` +
          `Active database is "${activeDb}", but optimization test mode requires "${REQUIRED_TEST_DATABASE}".`
        );
      }
      if (activeRole !== REQUIRED_TEST_DB_ROLE) {
        client.release();
        throw new Error(
          `[DATABASE-ISOLATION-FAIL-CLOSED] Refusing schema initialization! ` +
          `Active role is "${activeRole}", but optimization test mode requires dedicated role "${REQUIRED_TEST_DB_ROLE}".`
        );
      }
      console.log(`🛡️ [PostgreSQL] Verified isolated test database "${activeDb}" with test role "${activeRole}".`);
    } else {
      console.log('✅ [PostgreSQL] Connected successfully to self-hosted database on Hostinger VPS');
    }

    // 1. Ensure controlroom_store key-value table exists immediately for VPS persistence
    await client.query(`
      CREATE TABLE IF NOT EXISTS public.controlroom_store (
        key TEXT PRIMARY KEY,
        data JSONB NOT NULL DEFAULT '[]'::jsonb,
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);

    // Ensure bom_orders has contact_person and gst_no columns if table already exists
    try {
      await client.query(`
        DO $$
        BEGIN
          IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'bom_orders') THEN
            ALTER TABLE public.bom_orders ADD COLUMN IF NOT EXISTS invoice_no TEXT;
            ALTER TABLE public.bom_orders ADD COLUMN IF NOT EXISTS contact_person TEXT;
            ALTER TABLE public.bom_orders ADD COLUMN IF NOT EXISTS gst_no TEXT;
            ALTER TABLE public.bom_orders ADD COLUMN IF NOT EXISTS dispatch_printed BOOLEAN DEFAULT false;
            ALTER TABLE public.bom_orders ADD COLUMN IF NOT EXISTS dispatch_printed_at TIMESTAMPTZ;
            ALTER TABLE public.bom_orders ADD COLUMN IF NOT EXISTS dispatch_print_time_str TEXT;
            ALTER TABLE public.bom_orders ADD COLUMN IF NOT EXISTS dispatch_printed_date_str TEXT;
            ALTER TABLE public.bom_orders ADD COLUMN IF NOT EXISTS dispatch_printed_by TEXT;
            ALTER TABLE public.bom_orders ADD COLUMN IF NOT EXISTS dispatch_print_count INTEGER DEFAULT 0;
            ALTER TABLE public.bom_orders ADD COLUMN IF NOT EXISTS first_print_time_str TEXT;
            ALTER TABLE public.bom_orders ADD COLUMN IF NOT EXISTS second_print_time_str TEXT;
            ALTER TABLE public.bom_orders ADD COLUMN IF NOT EXISTS dispatch_print_history JSONB DEFAULT '[]'::jsonb;
            
            -- 1-to-1 Sync order values, items, and salesperson from source PI if missing
            IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'proforma_invoices') THEN
              UPDATE public.bom_orders b
              SET grand_total = COALESCE(NULLIF(p.grand_total, 0), b.grand_total),
                  sub_total = COALESCE(NULLIF(p.sub_total, 0), b.sub_total),
                  customer_name = COALESCE(NULLIF(b.customer_name, ''), NULLIF(p.customer_name, ''), b.customer_name),
                  company_name = COALESCE(NULLIF(b.company_name, ''), NULLIF(p.customer_name, ''), b.company_name),
                  sales_person = COALESCE(NULLIF(b.sales_person, ''), NULLIF(p.sales_person, ''), NULLIF(p.created_by, ''), 'Sales Department'),
                  sales_person_code = COALESCE(NULLIF(b.sales_person_code, ''), NULLIF(p.sales_person_code, ''), NULLIF(p.created_by_id, ''), ''),
                  items = CASE WHEN (b.items IS NULL OR jsonb_array_length(b.items) = 0 OR b.grand_total = 0) AND jsonb_array_length(p.items) > 0 THEN p.items ELSE b.items END
              FROM public.proforma_invoices p
              WHERE (b.source_pi_no = p.pi_no OR b.source_pi_no = p.id)
                AND (b.grand_total IS NULL OR b.grand_total = 0 OR b.sales_person IS NULL OR b.sales_person = '' OR b.sales_person = 'Sales Department' OR b.sales_person = 'Sales Executive');
            END IF;
          END IF;
        END $$;
      `);
    } catch (_) {}

    // Ensure public.proforma_invoices table, all columns, and the unique index exist unconditionally
    try {
      await client.query(`
        CREATE TABLE IF NOT EXISTS public.proforma_invoices (
          id TEXT PRIMARY KEY,
          pi_no TEXT NOT NULL,
          vendor TEXT,
          customer_name TEXT,
          contact_person TEXT,
          phone TEXT,
          email TEXT,
          gst_no TEXT,
          product_name TEXT,
          billing_address TEXT,
          billing_address_obj JSONB DEFAULT '{}'::jsonb,
          delivery_address TEXT,
          delivery_address_obj JSONB DEFAULT '{}'::jsonb,
          vehicle_no TEXT,
          signed_pi_doc TEXT,
          pi_date DATE DEFAULT CURRENT_DATE,
          delivery_date DATE,
          valid_until_date DATE,
          exp_date DATE,
          payment_terms TEXT,
          credit_days TEXT,
          remarks TEXT,
          transport_mode TEXT,
          transporter_name TEXT,
          destination TEXT,
          transport_scope TEXT,
          status TEXT DEFAULT 'Issued',
          status_type TEXT DEFAULT 'issued',
          sales_person TEXT,
          sales_person_code TEXT,
          sales_person_email TEXT,
          created_by TEXT,
          created_by_id TEXT,
          sub_total NUMERIC DEFAULT 0,
          gst_amount NUMERIC DEFAULT 0,
          cgst_amount NUMERIC DEFAULT 0,
          sgst_amount NUMERIC DEFAULT 0,
          grand_total NUMERIC DEFAULT 0,
          unit_value NUMERIC DEFAULT 0,
          quantity NUMERIC DEFAULT 1,
          kit_subtotal NUMERIC DEFAULT 0,
          items JSONB DEFAULT '[]'::jsonb,
          preset_groups JSONB DEFAULT '{}'::jsonb,
          same_as_billing BOOLEAN DEFAULT true,
          converted_bom_no TEXT,
          converted_bom_code TEXT,
          pdf_name TEXT,
          hsn TEXT DEFAULT '73089090',
          zoho_synced BOOLEAN DEFAULT false,
          zoho_estimate_id TEXT,
          zoho_estimate_no TEXT,
          zoho_sync_error TEXT,
          zoho_synced_at TIMESTAMPTZ,
          zoho_module TEXT DEFAULT 'Quotes',
          created_at TIMESTAMPTZ DEFAULT NOW(),
          updated_at TIMESTAMPTZ DEFAULT NOW()
        );

        -- Add any missing columns to existing public.proforma_invoices table
        ALTER TABLE public.proforma_invoices ADD COLUMN IF NOT EXISTS hsn TEXT DEFAULT '73089090';
        ALTER TABLE public.proforma_invoices ADD COLUMN IF NOT EXISTS vendor TEXT;
        ALTER TABLE public.proforma_invoices ADD COLUMN IF NOT EXISTS customer_name TEXT;
        ALTER TABLE public.proforma_invoices ADD COLUMN IF NOT EXISTS contact_person TEXT;
        ALTER TABLE public.proforma_invoices ADD COLUMN IF NOT EXISTS phone TEXT;
        ALTER TABLE public.proforma_invoices ADD COLUMN IF NOT EXISTS email TEXT;
        ALTER TABLE public.proforma_invoices ADD COLUMN IF NOT EXISTS gst_no TEXT;
        ALTER TABLE public.proforma_invoices ADD COLUMN IF NOT EXISTS product_name TEXT;
        ALTER TABLE public.proforma_invoices ADD COLUMN IF NOT EXISTS billing_address TEXT;
        ALTER TABLE public.proforma_invoices ADD COLUMN IF NOT EXISTS billing_address_obj JSONB DEFAULT '{}'::jsonb;
        ALTER TABLE public.proforma_invoices ADD COLUMN IF NOT EXISTS delivery_address TEXT;
        ALTER TABLE public.proforma_invoices ADD COLUMN IF NOT EXISTS delivery_address_obj JSONB DEFAULT '{}'::jsonb;
        ALTER TABLE public.proforma_invoices ADD COLUMN IF NOT EXISTS vehicle_no TEXT;
        ALTER TABLE public.proforma_invoices ADD COLUMN IF NOT EXISTS signed_pi_doc TEXT;
        ALTER TABLE public.proforma_invoices ADD COLUMN IF NOT EXISTS pi_date DATE DEFAULT CURRENT_DATE;
        ALTER TABLE public.proforma_invoices ADD COLUMN IF NOT EXISTS delivery_date DATE;
        ALTER TABLE public.proforma_invoices ADD COLUMN IF NOT EXISTS valid_until_date DATE;
        ALTER TABLE public.proforma_invoices ADD COLUMN IF NOT EXISTS exp_date DATE;
        ALTER TABLE public.proforma_invoices ADD COLUMN IF NOT EXISTS payment_terms TEXT;
        ALTER TABLE public.proforma_invoices ADD COLUMN IF NOT EXISTS credit_days TEXT;
        ALTER TABLE public.proforma_invoices ADD COLUMN IF NOT EXISTS remarks TEXT;
        ALTER TABLE public.proforma_invoices ADD COLUMN IF NOT EXISTS transport_mode TEXT;
        ALTER TABLE public.proforma_invoices ADD COLUMN IF NOT EXISTS transporter_name TEXT;
        ALTER TABLE public.proforma_invoices ADD COLUMN IF NOT EXISTS destination TEXT;
        ALTER TABLE public.proforma_invoices ADD COLUMN IF NOT EXISTS transport_scope TEXT;
        ALTER TABLE public.proforma_invoices ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'Issued';
        ALTER TABLE public.proforma_invoices ADD COLUMN IF NOT EXISTS status_type TEXT DEFAULT 'issued';
        ALTER TABLE public.proforma_invoices ADD COLUMN IF NOT EXISTS sales_person TEXT;
        ALTER TABLE public.proforma_invoices ADD COLUMN IF NOT EXISTS sales_person_code TEXT;
        ALTER TABLE public.proforma_invoices ADD COLUMN IF NOT EXISTS sales_person_email TEXT;
        ALTER TABLE public.proforma_invoices ADD COLUMN IF NOT EXISTS created_by TEXT;
        ALTER TABLE public.proforma_invoices ADD COLUMN IF NOT EXISTS created_by_id TEXT;
        ALTER TABLE public.proforma_invoices ADD COLUMN IF NOT EXISTS sub_total NUMERIC DEFAULT 0;
        ALTER TABLE public.proforma_invoices ADD COLUMN IF NOT EXISTS gst_amount NUMERIC DEFAULT 0;
        ALTER TABLE public.proforma_invoices ADD COLUMN IF NOT EXISTS cgst_amount NUMERIC DEFAULT 0;
        ALTER TABLE public.proforma_invoices ADD COLUMN IF NOT EXISTS sgst_amount NUMERIC DEFAULT 0;
        ALTER TABLE public.proforma_invoices ADD COLUMN IF NOT EXISTS grand_total NUMERIC DEFAULT 0;
        ALTER TABLE public.proforma_invoices ADD COLUMN IF NOT EXISTS unit_value NUMERIC DEFAULT 0;
        ALTER TABLE public.proforma_invoices ADD COLUMN IF NOT EXISTS quantity NUMERIC DEFAULT 1;
        ALTER TABLE public.proforma_invoices ADD COLUMN IF NOT EXISTS kit_subtotal NUMERIC DEFAULT 0;
        ALTER TABLE public.proforma_invoices ADD COLUMN IF NOT EXISTS items JSONB DEFAULT '[]'::jsonb;
        ALTER TABLE public.proforma_invoices ADD COLUMN IF NOT EXISTS preset_groups JSONB DEFAULT '{}'::jsonb;
        ALTER TABLE public.proforma_invoices ADD COLUMN IF NOT EXISTS same_as_billing BOOLEAN DEFAULT true;
        ALTER TABLE public.proforma_invoices ADD COLUMN IF NOT EXISTS converted_bom_no TEXT;
        ALTER TABLE public.proforma_invoices ADD COLUMN IF NOT EXISTS converted_bom_code TEXT;
        ALTER TABLE public.proforma_invoices ADD COLUMN IF NOT EXISTS pdf_name TEXT;
        ALTER TABLE public.proforma_invoices ADD COLUMN IF NOT EXISTS zoho_synced BOOLEAN DEFAULT false;
        ALTER TABLE public.proforma_invoices ADD COLUMN IF NOT EXISTS zoho_estimate_id TEXT;
        ALTER TABLE public.proforma_invoices ADD COLUMN IF NOT EXISTS zoho_estimate_no TEXT;
        ALTER TABLE public.proforma_invoices ADD COLUMN IF NOT EXISTS zoho_sync_error TEXT;
        ALTER TABLE public.proforma_invoices ADD COLUMN IF NOT EXISTS zoho_synced_at TIMESTAMPTZ;
        ALTER TABLE public.proforma_invoices ADD COLUMN IF NOT EXISTS zoho_module TEXT DEFAULT 'Quotes';
        ALTER TABLE public.proforma_invoices ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();
        ALTER TABLE public.proforma_invoices ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

        -- UNIQUE INDEX REQUIRED for ON CONFLICT (LOWER(TRIM(pi_no)))
        CREATE UNIQUE INDEX IF NOT EXISTS idx_proforma_invoices_pi_no_lower ON public.proforma_invoices (LOWER(TRIM(pi_no)));
        CREATE INDEX IF NOT EXISTS idx_proforma_invoices_customer ON public.proforma_invoices (customer_name);
        CREATE INDEX IF NOT EXISTS idx_proforma_invoices_created_at ON public.proforma_invoices (created_at DESC);
      `);
      console.log('✅ [PostgreSQL] public.proforma_invoices table & idx_proforma_invoices_pi_no_lower verified.');
    } catch (piTableErr) {
      console.warn('⚠️ [PostgreSQL proforma_invoices Table Warning]:', piTableErr.message);
    }

    // Auto-seed existing historical PIs into relational public.proforma_invoices if table is empty (disabled in test mode)
    if (!isOptimizationTestMode()) {
      try {
        const piCountRes = await client.query('SELECT COUNT(*) as count FROM public.proforma_invoices');
        const count = parseInt(piCountRes.rows[0]?.count || 0, 10);
        if (count === 0) {
          const piFiles = ['sales_pi_store.json', 'proforma_invoice_store.json'];
          const seedPis = new Map();
          for (const pf of piFiles) {
            const pPath = getStoreFilePath(pf);
            if (fs.existsSync(pPath)) {
              try {
                const list = JSON.parse(fs.readFileSync(pPath, 'utf8'));
                if (Array.isArray(list)) {
                  for (const item of list) {
                    if (item && (item.piNo || item.id)) {
                      const key = String(item.piNo || item.id).trim().toLowerCase();
                      if (!seedPis.has(key)) seedPis.set(key, item);
                    }
                  }
                }
              } catch (_) {}
            }
          }
          if (seedPis.size > 0) {
            console.log(`📦 [PostgreSQL] Seeding ${seedPis.size} Proforma Invoices into relational database...`);
            const { saveProformaInvoiceToDatabase } = await import('./piPersistence.js');
            for (const pi of seedPis.values()) {
              await saveProformaInvoiceToDatabase(pi, pool).catch(e => console.warn(`[PI Seed Warning ${pi.piNo}]:`, e.message));
            }
            console.log(`✅ [PostgreSQL] Successfully seeded ${seedPis.size} Proforma Invoices into public.proforma_invoices.`);
          }
        }
      } catch (seedErr) {
        console.warn('[PI Seed Error]:', seedErr.message);
      }
    } else {
      console.log('🛡️ [PostgreSQL] Optimization test mode: historical PI auto-seeding strictly disabled.');
    }

    // Safety reconciliation: Fix any falsely-converted PIs whose linked BOM has mismatched customer or items (disabled in test mode)
    if (!isOptimizationTestMode()) {
      try {
        await client.query(`
          UPDATE public.bom_orders b
          SET source_pi_no = null,
              updated_at = NOW()
          WHERE (b.source_pi_no ILIKE '%122%')
            AND NOT EXISTS (
              SELECT 1 FROM public.proforma_invoices p
              WHERE (LOWER(TRIM(p.pi_no)) = LOWER(TRIM(b.source_pi_no)) OR LOWER(TRIM(p.id)) = LOWER(TRIM(b.source_pi_no)))
                AND (
                  LOWER(TRIM(COALESCE(b.customer_name, ''))) = LOWER(TRIM(COALESCE(p.customer_name, '')))
                  OR LOWER(TRIM(COALESCE(b.company_name, ''))) = LOWER(TRIM(COALESCE(p.customer_name, '')))
                )
            );
        `);

        await client.query(`
          UPDATE public.proforma_invoices p
          SET status = 'Issued',
              status_type = 'issued',
              converted_bom_no = null,
              converted_bom_code = null,
              updated_at = NOW()
          WHERE (p.pi_no ILIKE '%122%' OR p.id ILIKE '%122%')
            AND p.status = 'Converted to BOM'
            AND NOT EXISTS (
              SELECT 1 FROM public.bom_orders b
              WHERE (LOWER(TRIM(b.source_pi_no)) = LOWER(TRIM(p.pi_no)) OR LOWER(TRIM(b.source_pi_no)) = LOWER(TRIM(p.id)))
                AND (
                  LOWER(TRIM(COALESCE(b.customer_name, ''))) = LOWER(TRIM(COALESCE(p.customer_name, '')))
                  OR LOWER(TRIM(COALESCE(b.company_name, ''))) = LOWER(TRIM(COALESCE(p.customer_name, '')))
                )
            );
        `);
        console.log('✅ [PostgreSQL] Verified PI/BOM conversion link integrity.');
      } catch (auditErr) {
        console.warn('[PI/BOM Integrity Audit Notice]:', auditErr.message);
      }
    }

    // Ensure public.leads table and CRM columns (location, product_requirement, etc.) exist
    try {
      await client.query(`
        CREATE TABLE IF NOT EXISTS public.leads (
          id TEXT PRIMARY KEY,
          lead_number TEXT UNIQUE,
          company_name TEXT NOT NULL,
          contact_person TEXT,
          designation TEXT,
          phone TEXT,
          whatsapp TEXT,
          email TEXT,
          source TEXT DEFAULT 'Manual',
          status TEXT DEFAULT 'New',
          assigned_salesperson TEXT,
          estimated_kw NUMERIC DEFAULT 0,
          category TEXT,
          notes TEXT,
          created_at TIMESTAMPTZ DEFAULT NOW(),
          updated_at TIMESTAMPTZ DEFAULT NOW()
        );

        ALTER TABLE public.leads 
          ADD COLUMN IF NOT EXISTS location TEXT,
          ADD COLUMN IF NOT EXISTS product_requirement TEXT,
          ADD COLUMN IF NOT EXISTS lead_created_by_id TEXT,
          ADD COLUMN IF NOT EXISTS lead_created_by_name TEXT,
          ADD COLUMN IF NOT EXISTS assigned_by_user_id TEXT,
          ADD COLUMN IF NOT EXISTS assigned_by_name TEXT,
          ADD COLUMN IF NOT EXISTS assigned_by_role TEXT,
          ADD COLUMN IF NOT EXISTS assigned_to_user_id TEXT,
          ADD COLUMN IF NOT EXISTS assigned_to_name TEXT,
          ADD COLUMN IF NOT EXISTS assigned_to_role TEXT,
          ADD COLUMN IF NOT EXISTS assigned_at TIMESTAMPTZ,
          ADD COLUMN IF NOT EXISTS priority TEXT DEFAULT 'MEDIUM',
          ADD COLUMN IF NOT EXISTS next_followup_date TIMESTAMPTZ,
          ADD COLUMN IF NOT EXISTS external_enquiry_id TEXT,
          ADD COLUMN IF NOT EXISTS external_payload JSONB,
          ADD COLUMN IF NOT EXISTS last_qualifying_activity_at TIMESTAMPTZ,
          ADD COLUMN IF NOT EXISTS last_activity_at TIMESTAMPTZ,
          ADD COLUMN IF NOT EXISTS last_activity_type TEXT,
          ADD COLUMN IF NOT EXISTS is_unattended_24h BOOLEAN DEFAULT false,
          ADD COLUMN IF NOT EXISTS is_unattended_2h BOOLEAN DEFAULT false,
          ADD COLUMN IF NOT EXISTS is_unattended_48h BOOLEAN DEFAULT false,
          ADD COLUMN IF NOT EXISTS unattended_alert_sent_at TIMESTAMPTZ,
          ADD COLUMN IF NOT EXISTS escalation_alert_sent_at TIMESTAMPTZ,
          ADD COLUMN IF NOT EXISTS converted_customer_id TEXT,
          ADD COLUMN IF NOT EXISTS converted_customer_code TEXT;

        CREATE TABLE IF NOT EXISTS public.lead_assignment_history (
          id TEXT PRIMARY KEY,
          lead_id TEXT NOT NULL REFERENCES public.leads(id) ON DELETE RESTRICT,
          assigned_by_user_id TEXT NOT NULL,
          assigned_by_name TEXT NOT NULL,
          assigned_by_role TEXT NOT NULL,
          assigned_to_user_id TEXT NOT NULL,
          assigned_to_name TEXT NOT NULL,
          assigned_to_role TEXT NOT NULL,
          previous_assigned_to_user_id TEXT,
          previous_assigned_to_name TEXT,
          assignment_reason TEXT,
          assignment_type TEXT NOT NULL DEFAULT 'INITIAL',
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );

        CREATE TABLE IF NOT EXISTS public.lead_activities (
          id TEXT PRIMARY KEY,
          lead_id TEXT NOT NULL REFERENCES public.leads(id) ON DELETE RESTRICT,
          activity_type TEXT NOT NULL,
          is_qualifying_activity BOOLEAN NOT NULL DEFAULT false,
          summary TEXT NOT NULL,
          customer_response TEXT,
          call_duration_seconds INT,
          conducted_by_user_id TEXT NOT NULL,
          conducted_by_name TEXT NOT NULL,
          conducted_by_role TEXT NOT NULL,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );

        CREATE TABLE IF NOT EXISTS public.lead_status_history (
          id TEXT PRIMARY KEY,
          lead_id TEXT NOT NULL REFERENCES public.leads(id) ON DELETE RESTRICT,
          previous_status TEXT,
          new_status TEXT NOT NULL,
          remarks TEXT,
          updated_by_user_id TEXT NOT NULL,
          updated_by_name TEXT NOT NULL,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );

        CREATE TABLE IF NOT EXISTS public.lead_followups (
          id TEXT PRIMARY KEY,
          lead_id TEXT NOT NULL REFERENCES public.leads(id) ON DELETE RESTRICT,
          scheduled_at TIMESTAMPTZ NOT NULL,
          notes TEXT,
          status TEXT NOT NULL DEFAULT 'PENDING',
          assigned_salesperson_id TEXT NOT NULL,
          assigned_salesperson_name TEXT NOT NULL,
          completed_at TIMESTAMPTZ,
          outcome_remarks TEXT,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );

        CREATE TABLE IF NOT EXISTS public.lead_inactivity_incidents (
          id TEXT PRIMARY KEY,
          lead_id TEXT NOT NULL REFERENCES public.leads(id) ON DELETE RESTRICT,
          salesperson_id TEXT NOT NULL,
          salesperson_name TEXT NOT NULL,
          incident_type TEXT NOT NULL,
          assigned_at TIMESTAMPTZ NOT NULL,
          alerted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          resolved_at TIMESTAMPTZ,
          resolved_by_user_id TEXT,
          resolution_type TEXT,
          details JSONB
        );

        CREATE UNIQUE INDEX IF NOT EXISTS idx_lead_inactivity_unique_incident 
          ON public.lead_inactivity_incidents(lead_id, incident_type, salesperson_id, assigned_at);

        DO $$
        BEGIN
          IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'quotations') THEN
            ALTER TABLE public.quotations ADD COLUMN IF NOT EXISTS lead_id TEXT;
          END IF;
        END $$;
      `);
      console.log('✅ [PostgreSQL] Ensured public.leads columns (location, etc.) and CRM tables exist.');
    } catch (leadsErr) {
      console.warn('[PostgreSQL Leads Schema Notice]:', leadsErr.message);
    }

    // Ensure all critical stores are seeded into PostgreSQL so they are permanently preserved in the VPS database (disabled in test mode)
    if (!isOptimizationTestMode()) {
      const storesToSeed = [
        'bom_store',
        'employees_store',
        'po_store',
        'grn_store',
        'raw_materials_store',
        'item_store',
        'workorder_store',
        'vrm_prod_workorders',
        'vendor_store',
        'presets_store',
        'company_branding_store',
        'invoice_store',
        'proforma_invoice_store',
        'sales_pi_store',
        'payment_store',
        'customer_store',
        'crm_customers'
      ];

      for (const storeKey of storesToSeed) {
        const checkRes = await client.query(`SELECT key FROM controlroom_store WHERE key = $1`, [storeKey]);
        if (checkRes.rows.length === 0) {
          const filePath = getStoreFilePath(`${storeKey}.json`);
          if (fs.existsSync(filePath)) {
            try {
              const raw = fs.readFileSync(filePath, 'utf8');
              const parsed = JSON.parse(raw);
              const hasData = Array.isArray(parsed) ? parsed.length > 0 : (parsed && typeof parsed === 'object' && Object.keys(parsed).length > 0);
              if (hasData) {
                await client.query(`
                  INSERT INTO controlroom_store (key, data, updated_at)
                  VALUES ($1, $2, NOW())
                  ON CONFLICT (key) DO NOTHING
                `, [storeKey, JSON.stringify(parsed)]);
                console.log(`✅ [PostgreSQL] Seeded ${storeKey} into VPS database`);
              }
            } catch (_) {}
          }
        }
      }
    } else {
      console.log('🛡️ [PostgreSQL] Optimization test mode: legacy business data seeding into controlroom_store strictly disabled.');
    }

    // 2. Ensure public.leaves has all required columns (used for key-value store & session registry)
    try {
      await client.query(`
        CREATE TABLE IF NOT EXISTS public.leaves (
          id BIGSERIAL PRIMARY KEY,
          employee TEXT NOT NULL,
          reason TEXT,
          status TEXT DEFAULT 'active',
          dates TIMESTAMPTZ DEFAULT NOW(),
          duration TEXT DEFAULT '1',
          type TEXT DEFAULT 'Store'
        );
        ALTER TABLE public.leaves ADD COLUMN IF NOT EXISTS reason TEXT;
        ALTER TABLE public.leaves ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'active';
        ALTER TABLE public.leaves ADD COLUMN IF NOT EXISTS dates TIMESTAMPTZ DEFAULT NOW();
        ALTER TABLE public.leaves ADD COLUMN IF NOT EXISTS duration TEXT DEFAULT '1';
        ALTER TABLE public.leaves ADD COLUMN IF NOT EXISTS type TEXT DEFAULT 'Store';
      `);
    } catch (_) {}

    // 3. Check if normalized relational tables already exist
    try {
      const checkRes = await client.query(`
        SELECT to_regclass('public.customers') as customers_exist;
      `);

      if (!checkRes.rows[0]?.customers_exist) {
        console.log('📦 [PostgreSQL] Initializing clean database tables from schema...');
        const schemaPath = path.resolve(__dirname, '../supabase_main_schema.sql');
        if (fs.existsSync(schemaPath)) {
          let schemaSql = fs.readFileSync(schemaPath, 'utf8');
          // Clean out Supabase-specific extensions/policies and storage bucket statements that are not needed on self-hosted PG
          schemaSql = schemaSql.replace(/CREATE EXTENSION IF NOT EXISTS [^;]+;/gi, '');
          schemaSql = schemaSql.replace(/ALTER TABLE [^;]+ ENABLE ROW LEVEL SECURITY;/gi, '');
          schemaSql = schemaSql.replace(/DROP POLICY [^;]+;/gi, '');
          schemaSql = schemaSql.replace(/CREATE POLICY [\s\S]*?;/gi, '');
          schemaSql = schemaSql.replace(/INSERT INTO storage\.buckets[\s\S]*?;/gi, '');
          schemaSql = schemaSql.replace(/DROP POLICY [^;]+ ON storage\.[^;]+;/gi, '');

          await client.query(schemaSql);
          console.log('✅ [PostgreSQL] Clean relational tables created successfully.');
        }
      } else {
        console.log('✅ [PostgreSQL] Tables verified. Database is ready.');
      }
    } catch (schemaErr) {
      console.warn('⚠️ [PostgreSQL Schema Notice]:', schemaErr.message);
    }

    client.release();
    return true;
  } catch (err) {
    console.warn('⚠️ [PostgreSQL Notice] PostgreSQL not active yet or connection error:', err.message);
    console.warn('   (The server will safely run with local disk persistence until PostgreSQL is started)');
    isConnected = false;
    return false;
  }
}

/**
 * Local fluent database client adapter for Hostinger VPS.
 * Provides a drop-in query builder interface (.from(table).select().eq()...)
 * that executes SQL against PostgreSQL or safely falls back to local server stores.
 */
export function createLocalDbClient(memoryStore = {}) {
  return {
    from(tableName) {
      const state = {
        table: tableName,
        action: 'select',
        columns: '*',
        conditions: [],
        orderBy: null,
        limitCount: null,
        insertData: null,
        updateData: null,
        upsertData: null,
        conflictTarget: 'id'
      };

      const builder = {
        select(cols = '*') {
          state.action = 'select';
          state.columns = cols;
          return builder;
        },
        eq(column, value) {
          state.conditions.push({ type: 'eq', column, value });
          return builder;
        },
        neq(column, value) {
          state.conditions.push({ type: 'neq', column, value });
          return builder;
        },
        not(column, operator, value) {
          state.conditions.push({ type: 'not', column, operator, value });
          return builder;
        },
        filter(column, operator, value) {
          state.conditions.push({ type: 'filter', column, operator, value });
          return builder;
        },
        in(column, values) {
          state.conditions.push({ type: 'in', column, values });
          return builder;
        },
        or(conditionStr) {
          state.conditions.push({ type: 'raw_or', condition: conditionStr });
          return builder;
        },
        range(from, to) {
          state.limitCount = (to - from) + 1;
          return builder;
        },
        order(column, { ascending = true } = {}) {
          state.orderBy = { column, direction: ascending ? 'ASC' : 'DESC' };
          return builder;
        },
        limit(n) {
          state.limitCount = n;
          return builder;
        },
        insert(data) {
          state.action = 'insert';
          state.insertData = Array.isArray(data) ? data : [data];
          return builder;
        },
        upsert(data, options = {}) {
          state.action = 'upsert';
          state.upsertData = Array.isArray(data) ? data : [data];
          if (options.onConflict) state.conflictTarget = options.onConflict;
          return builder;
        },
        update(data) {
          state.action = 'update';
          state.updateData = data;
          return builder;
        },
        delete() {
          state.action = 'delete';
          return builder;
        },
        async single() {
          const res = await builder.then(r => r);
          if (res.error) return { data: null, error: res.error };
          return { data: Array.isArray(res.data) ? res.data[0] || null : res.data, error: null };
        },

        // Execution via Promise then()
        async then(resolve, reject) {
          try {
            // 1. Attempt SQL execution directly against PostgreSQL
            const res = await executeSql(state);
            if (res) {
              if (res.error) {
                // If table error or PG error, log warning and attempt fallback
                console.warn(`[LocalDb Query Notice on ${state.table}]:`, res.error.message);
              } else {
                isConnected = true;
                return resolve(res);
              }
            }

            // 2. Safe Fallback to server memoryStore / disk if DB not connected or errored
            const fallbackRes = executeFallback(state, memoryStore);
            return resolve(fallbackRes);
          } catch (err) {
            console.error(`[LocalDb Error on ${state.table}]:`, err.message);
            const fallbackRes = executeFallback(state, memoryStore);
            return resolve(fallbackRes);
          }
        }
      };

      return builder;
    }
  };
}

/**
 * Execute query against self-hosted PostgreSQL
 */
async function executeSql(state) {
  try {
    const table = state.table;
    const client = await pool.connect();
    try {
      if (state.action === 'select') {
        let sql = `SELECT ${formatColumns(state.columns)} FROM public."${table}"`;
        const params = [];
        const whereClauses = [];

        state.conditions.forEach(cond => {
          if (cond.type === 'eq') {
            params.push(cond.value);
            whereClauses.push(`"${cond.column}" = $${params.length}`);
          } else if (cond.type === 'in') {
            params.push(cond.values);
            whereClauses.push(`"${cond.column}" = ANY($${params.length})`);
          }
        });

        if (whereClauses.length > 0) {
          sql += ` WHERE ${whereClauses.join(' AND ')}`;
        }
        if (state.orderBy) {
          sql += ` ORDER BY "${state.orderBy.column}" ${state.orderBy.direction}`;
        }
        if (state.limitCount) {
          sql += ` LIMIT ${state.limitCount}`;
        }

        const result = await client.query(sql, params);
        return { data: result.rows, error: null };
      }

      if (state.action === 'delete') {
        let sql = `DELETE FROM public."${table}"`;
        const params = [];
        const whereClauses = [];

        state.conditions.forEach(cond => {
          if (cond.type === 'eq') {
            params.push(cond.value);
            whereClauses.push(`"${cond.column}" = $${params.length}`);
          } else if (cond.type === 'in') {
            params.push(cond.values);
            whereClauses.push(`"${cond.column}" = ANY($${params.length})`);
          }
        });

        if (whereClauses.length > 0) {
          sql += ` WHERE ${whereClauses.join(' AND ')}`;
        }

        await client.query(sql, params);
        return { data: null, error: null };
      }

      if (state.action === 'upsert' && state.upsertData && state.upsertData.length > 0) {
        await client.query('BEGIN');
        try {
          for (const row of state.upsertData) {
            const keys = Object.keys(row).filter(k => row[k] !== undefined);
            if (keys.length === 0) continue;
            const cols = keys.map(k => `"${k}"`).join(', ');
            const jsonbCols = new Set([
              'items', 'payments', 'dispatch_packing', 'accounts_verification', 
              'preset_groups', 'billing_address_obj', 'delivery_address_obj', 
              'dispatch_packing_media', 'vehicle_loading', 'data'
            ]);
            const placeholders = keys.map((k, i) => {
              return jsonbCols.has(k) ? `$${i + 1}::jsonb` : `$${i + 1}`;
            }).join(', ');
            const updateSet = keys
              .filter(k => k !== state.conflictTarget)
              .map(k => `"${k}" = EXCLUDED."${k}"`)
              .join(', ');

            const values = keys.map(k => {
              const v = row[k];
              return typeof v === 'object' && v !== null ? JSON.stringify(v) : v;
            });

            const sql = `
              INSERT INTO public."${table}" (${cols})
              VALUES (${placeholders})
              ON CONFLICT ("${state.conflictTarget}") 
              DO UPDATE SET ${updateSet || 'updated_at = NOW()'}
            `;

            await client.query(sql, values);
          }
          await client.query('COMMIT');
          return { data: state.upsertData, error: null };
        } catch (txErr) {
          await client.query('ROLLBACK').catch(() => null);
          throw txErr;
        }
      }

      if (state.action === 'update' && state.updateData) {
        const keys = Object.keys(state.updateData).filter(k => state.updateData[k] !== undefined);
        const params = [];
        const setClauses = keys.map(k => {
          const val = state.updateData[k];
          params.push(typeof val === 'object' && val !== null ? JSON.stringify(val) : val);
          return `"${k}" = $${params.length}`;
        });

        const whereClauses = [];
        state.conditions.forEach(cond => {
          if (cond.type === 'eq') {
            params.push(cond.value);
            whereClauses.push(`"${cond.column}" = $${params.length}`);
          }
        });

        let sql = `UPDATE public."${table}" SET ${setClauses.join(', ')}`;
        if (whereClauses.length > 0) {
          sql += ` WHERE ${whereClauses.join(' AND ')}`;
        }

        const result = await client.query(sql, params);
        return { data: result.rows, error: null };
      }

      return { data: [], error: null };
    } finally {
      client.release();
    }
  } catch (err) {
    console.error(`[executeSql Error on ${state.table}]:`, err.message);
    return { data: null, error: err };
  }
}

function formatColumns(cols) {
  if (!cols || cols === '*') return '*';
  // If plain columns, return as is
  return cols;
}

/**
 * In-memory / disk fallback execution
 */
function executeFallback(state, memoryStore) {
  const storeKey = state.table;
  let items = Array.isArray(memoryStore[storeKey]) ? [...memoryStore[storeKey]] : [];

  if (state.action === 'select') {
    state.conditions.forEach(cond => {
      if (cond.type === 'eq') {
        items = items.filter(it => it && (it[cond.column] === cond.value || String(it[cond.column]) === String(cond.value)));
      } else if (cond.type === 'in') {
        const set = new Set(cond.values.map(String));
        items = items.filter(it => it && set.has(String(it[cond.column])));
      }
    });

    if (state.limitCount) {
      items = items.slice(0, state.limitCount);
    }

    return { data: items, error: null };
  }

  if (state.action === 'upsert' && state.upsertData) {
    if (!Array.isArray(memoryStore[storeKey])) memoryStore[storeKey] = [];
    state.upsertData.forEach(newRow => {
      const idx = memoryStore[storeKey].findIndex(r => r && (r.id === newRow.id || r[state.conflictTarget] === newRow[state.conflictTarget]));
      if (idx >= 0) {
        memoryStore[storeKey][idx] = { ...memoryStore[storeKey][idx], ...newRow };
      } else {
        memoryStore[storeKey].unshift(newRow);
      }
    });
    return { data: state.upsertData, error: null };
  }

  if (state.action === 'delete') {
    if (Array.isArray(memoryStore[storeKey])) {
      state.conditions.forEach(cond => {
        if (cond.type === 'eq') {
          memoryStore[storeKey] = memoryStore[storeKey].filter(it => it && it[cond.column] !== cond.value && String(it[cond.column]) !== String(cond.value));
        } else if (cond.type === 'in') {
          const set = new Set(cond.values.map(String));
          memoryStore[storeKey] = memoryStore[storeKey].filter(it => it && !set.has(String(it[cond.column])));
        }
      });
    }
    return { data: null, error: null };
  }

  return { data: [], error: null };
}
