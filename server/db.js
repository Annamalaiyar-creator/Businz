import pkg from 'pg';
const { Pool } = pkg;
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// PostgreSQL connection config for Hostinger VPS (Self-hosted)
const connectionString = process.env.DATABASE_URL || 
  process.env.PG_CONNECTION_STRING || 
  `postgres://${process.env.PGUSER || 'postgres'}:${encodeURIComponent(process.env.PGPASSWORD || 'postgres')}@${process.env.PGHOST || '127.0.0.1'}:${process.env.PGPORT || 5432}/${process.env.PGDATABASE || 'businz'}`;

export const pool = new Pool({
  connectionString,
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
  console.warn('[PostgreSQL Pool Warning]:', err.message);
  isConnected = false;
});

export async function query(text, params) {
  return pool.query(text, params);
}

export function isDbConnected() {
  return isConnected;
}

/**
 * Initializes the clean schema on the self-hosted PostgreSQL database.
 * Executes supabase_main_schema.sql if tables do not exist.
 */
export async function initPostgresDatabase() {
  try {
    const client = await pool.connect();
    isConnected = true;
    console.log('✅ [PostgreSQL] Connected successfully to self-hosted database on Hostinger VPS');

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
            ALTER TABLE public.bom_orders ADD COLUMN IF NOT EXISTS contact_person TEXT;
            ALTER TABLE public.bom_orders ADD COLUMN IF NOT EXISTS gst_no TEXT;
            
            -- Fix BOM-659 to restore accurate PI company, contact, transport, and address details
            UPDATE public.bom_orders
            SET customer_name = 'Teorainn Solar Pvt Ltd',
                company_name = 'Teorainn Solar Pvt Ltd',
                contact_person = 'Incheon Kia',
                gst_no = '32AAECI9544G1ZK',
                email = 'admin@teorainnsolar.com',
                payment_type = '100% Paid',
                transporter_name = 'A2B',
                transport_mode = 'Transport',
                transport_scope = 'VRM Structures',
                billing_address = 'Incheon Kia 32AAECI9544G1ZK, Muvattupuzha, Kerala PIN: 682316',
                billing_address_obj = '{"street": "Incheon Kia 32AAECI9544G1ZK", "address": "Incheon Kia 32AAECI9544G1ZK", "city": "Muvattupuzha", "state": "Kerala", "pincode": "682316"}'::jsonb,
                delivery_address = 'Incheon Kia 32AAECI9544G1ZK, Muvattupuzha, Kerala PIN: 682316',
                delivery_address_obj = '{"street": "Incheon Kia 32AAECI9544G1ZK", "address": "Incheon Kia 32AAECI9544G1ZK", "city": "Muvattupuzha", "state": "Kerala", "pincode": "682316"}'::jsonb
            WHERE (bom_code = 'BOM-659' OR id = 'BOM-659');

            -- Automatically sync order values, items, and salesperson from source PI if missing
            IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'proforma_invoices') THEN
              UPDATE public.bom_orders b
              SET grand_total = COALESCE(NULLIF(p.grand_total, 0), b.grand_total),
                  sub_total = COALESCE(NULLIF(p.sub_total, 0), b.sub_total),
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

    // Ensure all critical stores are seeded into PostgreSQL so they are permanently preserved in the VPS database
    const storesToSeed = [
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
        const filePath = path.resolve(__dirname, `${storeKey}.json`);
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

    // 2. Check if normalized relational tables already exist
    try {
      const checkRes = await client.query(`
        SELECT to_regclass('public.customers') as customers_exist;
      `);

      if (!checkRes.rows[0]?.customers_exist) {
        console.log('📦 [PostgreSQL] Initializing clean database tables from schema...');
        const schemaPath = path.resolve(__dirname, '../supabase_main_schema.sql');
        if (fs.existsSync(schemaPath)) {
          let schemaSql = fs.readFileSync(schemaPath, 'utf8');
          // Clean out Supabase-specific extensions/policies that are not needed on self-hosted PG
          schemaSql = schemaSql.replace(/CREATE EXTENSION IF NOT EXISTS [^;]+;/gi, '');
          schemaSql = schemaSql.replace(/ALTER TABLE [^;]+ ENABLE ROW LEVEL SECURITY;/gi, '');
          schemaSql = schemaSql.replace(/DROP POLICY [^;]+;/gi, '');
          schemaSql = schemaSql.replace(/CREATE POLICY [\s\S]*?;/gi, '');

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
            // 1. If PostgreSQL is connected, attempt SQL execution
            if (isConnected) {
              const res = await executeSql(state);
              if (res) {
                return resolve(res);
              }
            }

            // 2. Safe Fallback to server memoryStore / disk
            const fallbackRes = executeFallback(state, memoryStore);
            return resolve(fallbackRes);
          } catch (err) {
            console.warn(`[LocalDb Error on ${state.table}]:`, err.message);
            // Graceful fallback on error
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
        for (const row of state.upsertData) {
          const keys = Object.keys(row).filter(k => row[k] !== undefined);
          if (keys.length === 0) continue;
          const cols = keys.map(k => `"${k}"`).join(', ');
          const placeholders = keys.map((_, i) => `$${i + 1}`).join(', ');
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
        return { data: state.upsertData, error: null };
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

      return null;
    } finally {
      client.release();
    }
  } catch (err) {
    console.warn(`[executeSql Warning on ${state.table}]:`, err.message);
    return null;
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
