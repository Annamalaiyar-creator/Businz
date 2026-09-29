import { createClient } from '@supabase/supabase-js';

const DEFAULT_SUPABASE_URL = 'https://qhxaqrclvdfkswdavvjd.supabase.co';
const DEFAULT_SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFoeGFxcmNsdmRma3N3ZGF2dmpkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTAxNDc2MzgsImV4cCI6MjEwNTcyMzYzOH0.5eTHE3fVU5L0wvNr-xFcidfqgBTqVSpGFhiBvZcKfec';

const env = (typeof import.meta !== 'undefined' && import.meta.env) ? import.meta.env : (typeof process !== 'undefined' && process.env ? process.env : {});
const SUPABASE_URL = env.VITE_SUPABASE_URL || DEFAULT_SUPABASE_URL;
const SUPABASE_ANON_KEY = env.VITE_SUPABASE_ANON_KEY || DEFAULT_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.error('[BUSINZ Config Error] Supabase environment configuration is missing.');
  throw new Error('Supabase environment configuration is missing.');
}

const rawSupabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Bulletproof client-level firewall interceptor on bom_orders to block all mock/dummy Customer records
const rawFrom = rawSupabase.from.bind(rawSupabase);
rawSupabase.from = (table) => {
  const query = rawFrom(table);
  if (table === 'bom_orders') {
    const rawUpsert = query.upsert.bind(query);
    query.upsert = (values, options) => {
      if (Array.isArray(values)) {
        if (values.length > 5) {
          console.warn(`[Supabase Firewall] Blocked mass array upsert of ${values.length} rows to public.bom_orders to prevent excessive PostgREST egress.`);
          return Promise.resolve({ data: [], error: null });
        }
        const clean = values.filter(v => v && !((v.customer_name === 'Customer' || v.customerName === 'Customer') && !v.source_pi_no && !v.sourcePiNo));
        if (clean.length === 0) return Promise.resolve({ data: [], error: null });
        return rawUpsert(clean, options);
      } else if (values && typeof values === 'object') {
        if ((values.customer_name === 'Customer' || values.customerName === 'Customer') && !values.source_pi_no && !values.sourcePiNo) {
          return Promise.resolve({ data: null, error: null });
        }
        return rawUpsert(values, options);
      }
      return rawUpsert(values, options);
    };

    const rawInsert = query.insert.bind(query);
    query.insert = (values, options) => {
      if (Array.isArray(values)) {
        if (values.length > 5) {
          console.warn(`[Supabase Firewall] Blocked mass array insert of ${values.length} rows to public.bom_orders to prevent excessive PostgREST egress.`);
          return Promise.resolve({ data: [], error: null });
        }
        const clean = values.filter(v => v && !((v.customer_name === 'Customer' || v.customerName === 'Customer') && !v.source_pi_no && !v.sourcePiNo));
        if (clean.length === 0) return Promise.resolve({ data: [], error: null });
        return rawInsert(clean, options);
      } else if (values && typeof values === 'object') {
        if ((values.customer_name === 'Customer' || values.customerName === 'Customer') && !values.source_pi_no && !values.sourcePiNo) {
          return Promise.resolve({ data: null, error: null });
        }
        return rawInsert(values, options);
      }
      return rawInsert(values, options);
    };

    const rawSelect = query.select.bind(query);
    query.select = (...args) => {
      // Egress Protection: If select is wildcard or empty, project only lightweight columns (never heavy _extra_data)
      if (!args[0] || args[0] === '*' || args[0].trim() === '') {
        args[0] = 'id, code, bom_code, source_pi_no, date, delivery_date, customer_name, company_name, mobile, email, status, sales_confirmed, sales_confirmed_at, sales_person, sales_person_code, created_by, created_by_id, sub_total, gst_amount, cgst_amount, sgst_amount, grand_total, balance_amount, partial_amount, credit_days, credit_due_date, payment_type, remarks, stock_blocked, stock_blocked_at, invoice_confirmed, invoice_deducted, stock_deducted, preset_name, preset_kit_price, preset_set_count, transport_mode, transport_scope, transporter_name, vehicle_no, lr_no, items, payments, dispatch_packing, accounts_verified:accounts_verification->verified, accounts_verified_by:accounts_verification->verifiedBy, accounts_payment_status:accounts_verification->paymentStatus, accounts_payment_date:accounts_verification->paymentDate, accounts_total_amount:accounts_verification->totalAmount, created_at, updated_at';
      }
      const selectBuilder = rawSelect(...args);
      return selectBuilder.neq('customer_name', 'Customer');
    };
  }

  if (table === 'invoices') {
    const rawUpsert = query.upsert.bind(query);
    query.upsert = (values, options) => {
      if (Array.isArray(values)) {
        if (values.length > 5) {
          console.warn(`[Supabase Firewall] Blocked mass array upsert of ${values.length} rows to public.invoices to prevent excessive PostgREST egress.`);
          return Promise.resolve({ data: [], error: null });
        }
        return rawUpsert(values, options);
      }
      return rawUpsert(values, options);
    };

    const rawInsert = query.insert.bind(query);
    query.insert = (values, options) => {
      if (Array.isArray(values)) {
        if (values.length > 5) {
          console.warn(`[Supabase Firewall] Blocked mass array insert of ${values.length} rows to public.invoices to prevent excessive PostgREST egress.`);
          return Promise.resolve({ data: [], error: null });
        }
        return rawInsert(values, options);
      }
      return rawInsert(values, options);
    };

    const rawSelect = query.select.bind(query);
    query.select = (...args) => {
      // Egress Protection: If select is wildcard or empty, project only required invoice columns
      if (!args[0] || args[0] === '*' || args[0].trim() === '') {
        args[0] = 'id, inv_no, preset_name, inv_amt, vendor, bom_code, zoho_id, status, pay, synced_to_zoho, created_at, updated_at';
      }
      return rawSelect(...args);
    };
  }
  return query;
};

export const supabase = rawSupabase;
