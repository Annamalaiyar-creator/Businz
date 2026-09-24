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
      const selectBuilder = rawSelect(...args);
      return selectBuilder.neq('customer_name', 'Customer');
    };
  }
  return query;
};

export const supabase = rawSupabase;
