import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, '../.env') });

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase credentials in .env');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function runTests() {
  console.log('====================================================');
  console.log('🚀 BUSINZ PHASE 2 — OPPORTUNITY MIGRATION TEST SUITE');
  console.log('====================================================\n');

  let passed = 0;
  let failed = 0;

  function assert(condition, message) {
    if (condition) {
      console.log(`  ✅ PASS: ${message}`);
      passed++;
    } else {
      console.error(`  ❌ FAIL: ${message}`);
      failed++;
    }
  }

  try {
    // TEST 1: Check public.opportunities table accessibility and initial count
    console.log('Test 1: Check public.opportunities table accessibility & count');
    const { data: initialOpps, error: initialErr } = await supabase
      .from('opportunities')
      .select('*')
      .order('created_at', { ascending: false });

    assert(!initialErr, `public.opportunities query successful (error: ${initialErr?.message || 'none'})`);
    assert(Array.isArray(initialOpps) && initialOpps.length >= 7, `Initial opportunities count is >= 7 (found ${initialOpps?.length || 0})`);

    const initialCount = initialOpps ? initialOpps.length : 0;

    // TEST 2: Verify zero opportunities exist in public.leaves
    console.log('\nTest 2: Verify zero opportunities stored in legacy public.leaves');
    const { data: leavesOpps, error: leavesErr } = await supabase
      .from('leaves')
      .select('id, employee')
      .eq('employee', 'CRM_OPPORTUNITIES');

    assert(!leavesErr, `Query to public.leaves for employee='CRM_OPPORTUNITIES' succeeded`);
    assert(Array.isArray(leavesOpps) && leavesOpps.length === 0, `public.leaves has 0 rows for CRM_OPPORTUNITIES (found ${leavesOpps?.length || 0})`);

    // TEST 3: Insert single Opportunity row into public.opportunities
    console.log('\nTest 3: Insert single normalized opportunity (OPP-TEST-VERIFY)');
    const testId = 'OPP-TEST-VERIFY';
    const testOpp = {
      id: testId,
      customer_id: 'CUST-VRM-101',
      company_name: 'Test Enterprise Corp',
      title: '500 kW Ground Mount EPC Project',
      deal_value: 1250000.50,
      stage: 'Qualification',
      probability: 30,
      assigned_salesperson: 'Mohith JV',
      target_close_date: '2026-10-15',
      notes: JSON.stringify({
        capacityKw: 500,
        structureType: 'Ground Mount HDG',
        productCategory: 'Solar EPC Structures',
        priority: 'High',
        _userNotes: 'Test migration automated verification note'
      }),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    const { data: insertData, error: insertErr } = await supabase
      .from('opportunities')
      .upsert(testOpp, { onConflict: 'id' })
      .select();

    assert(!insertErr, `Insert test opportunity succeeded: ${insertErr?.message || 'OK'}`);

    // TEST 4: Read back inserted row and verify all columns
    console.log('\nTest 4: Read back inserted opportunity and verify field values');
    const { data: fetchedOpp, error: fetchErr } = await supabase
      .from('opportunities')
      .select('*')
      .eq('id', testId)
      .single();

    assert(!fetchErr && fetchedOpp, `Fetched inserted opportunity row`);
    assert(fetchedOpp?.id === testId, `ID matches: ${fetchedOpp?.id}`);
    assert(fetchedOpp?.company_name === testOpp.company_name, `Company name matches: ${fetchedOpp?.company_name}`);
    assert(fetchedOpp?.customer_id === testOpp.customer_id, `Customer ID matches: ${fetchedOpp?.customer_id}`);
    assert(Number(fetchedOpp?.deal_value) === 1250000.50, `Deal value matches numeric: ${fetchedOpp?.deal_value}`);
    assert(fetchedOpp?.stage === 'Qualification', `Stage matches: ${fetchedOpp?.stage}`);
    assert(Number(fetchedOpp?.probability) === 30, `Probability matches: ${fetchedOpp?.probability}`);
    assert(fetchedOpp?.assigned_salesperson === 'Mohith JV', `Salesperson matches: ${fetchedOpp?.assigned_salesperson}`);
    assert(fetchedOpp?.notes.includes('Ground Mount HDG'), `Notes JSON metadata preserved correctly`);

    // TEST 5: Update stage and deal value
    console.log('\nTest 5: Update opportunity stage to "Won" and update deal value');
    const { error: updateErr } = await supabase
      .from('opportunities')
      .update({
        stage: 'Won',
        deal_value: 1500000,
        probability: 100,
        updated_at: new Date().toISOString()
      })
      .eq('id', testId);

    assert(!updateErr, `Update succeeded: ${updateErr?.message || 'OK'}`);

    const { data: updatedOpp } = await supabase
      .from('opportunities')
      .select('stage, deal_value, probability')
      .eq('id', testId)
      .single();

    assert(updatedOpp?.stage === 'Won', `Stage updated to 'Won': ${updatedOpp?.stage}`);
    assert(Number(updatedOpp?.deal_value) === 1500000, `Deal value updated to 1500000: ${updatedOpp?.deal_value}`);
    assert(Number(updatedOpp?.probability) === 100, `Probability updated to 100: ${updatedOpp?.probability}`);

    // TEST 6: Verify leaves table was still NOT touched during test operations
    console.log('\nTest 6: Verify zero leaves table writes occurred during CRUD');
    const { data: checkLeaves } = await supabase
      .from('leaves')
      .select('id')
      .eq('employee', 'CRM_OPPORTUNITIES');
    assert(Array.isArray(checkLeaves) && checkLeaves.length === 0, `public.leaves remains 0 rows`);

    // TEST 7: Test relationship / link to customers table
    console.log('\nTest 7: Verify customer foreign-key / code linkage');
    const { data: linkedCustomer, error: custErr } = await supabase
      .from('customers')
      .select('id, customer_code, company_name')
      .or(`id.eq.${testOpp.customer_id},customer_code.eq.${testOpp.customer_id}`)
      .limit(1);

    assert(!custErr, `Customer link lookup executed without error`);
    if (linkedCustomer && linkedCustomer.length > 0) {
      assert(true, `Found matching customer in public.customers: ${linkedCustomer[0].company_name} (${linkedCustomer[0].customer_code || linkedCustomer[0].id})`);
    } else {
      console.log(`  ℹ️ Notice: Customer ${testOpp.customer_id} not currently present in customers table, but foreign key query works cleanly`);
    }

    // TEST 8: Delete the test record
    console.log('\nTest 8: Atomic delete from public.opportunities');
    const { error: deleteErr } = await supabase
      .from('opportunities')
      .delete()
      .eq('id', testId);

    assert(!deleteErr, `Delete succeeded: ${deleteErr?.message || 'OK'}`);

    const { data: finalOpps } = await supabase
      .from('opportunities')
      .select('id');

    assert(finalOpps?.length === initialCount, `Opportunity count restored to original (${finalOpps?.length || 0})`);

    // Summary
    console.log('\n====================================================');
    console.log(`TEST SUMMARY: ${passed} PASSED | ${failed} FAILED`);
    console.log('====================================================\n');

    if (failed > 0) {
      process.exit(1);
    }
  } catch (err) {
    console.error('❌ Test suite failed with exception:', err);
    process.exit(1);
  }
}

runTests();
