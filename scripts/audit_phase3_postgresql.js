import { query } from '../server/db.js';

async function auditDatabase() {
  console.log('===============================================================');
  console.log('       BUSINZ Phase 3: PostgreSQL Database Performance Audit    ');
  console.log('===============================================================\n');

  // 1. Database Connection & Basic Info
  const dbInfo = await query('SELECT current_database(), current_user, version()');
  console.log(`📌 Connected Database: ${dbInfo.rows[0].current_database} (User: ${dbInfo.rows[0].current_user})`);
  console.log(`📌 Version: ${dbInfo.rows[0].version.split(' ')[0]} ${dbInfo.rows[0].version.split(' ')[1]}\n`);

  // 2. Table Sizes, Row Counts & Index Sizes
  console.log('--- 1. Table Statistics (Size & Estimated Row Counts) ---');
  const tableStats = await query(`
    SELECT
      relname AS table_name,
      n_live_tup AS estimated_rows,
      pg_size_pretty(pg_total_relation_size(relid)) AS total_size,
      pg_size_pretty(pg_relation_size(relid)) AS data_size,
      pg_size_pretty(pg_indexes_size(relid)) AS index_size
    FROM pg_stat_user_tables
    ORDER BY pg_total_relation_size(relid) DESC;
  `);

  console.table(tableStats.rows);

  // 3. Inspect controlroom_store
  console.log('\n--- 2. Inspecting controlroom_store Keys & Payload Sizes ---');
  const crKeys = await query(`
    SELECT
      key,
      pg_size_pretty(length(data::text)::bigint) AS raw_json_size,
      length(data::text) AS raw_bytes,
      jsonb_typeof(data) AS json_type,
      CASE
        WHEN jsonb_typeof(data) = 'array' THEN jsonb_array_length(data)
        ELSE 1
      END AS item_count,
      updated_at
    FROM controlroom_store
    ORDER BY length(data::text) DESC;
  `);
  console.table(crKeys.rows.map(r => ({
    key: r.key,
    size: r.raw_json_size,
    type: r.json_type,
    items: r.item_count,
    updated_at: r.updated_at
  })));

  // 4. Inspect public.leaves (Legacy Store)
  console.log('\n--- 3. Inspecting public.leaves Legacy Storage Operations ---');
  const leavesStats = await query(`
    SELECT
      employee AS store_key,
      COUNT(*) AS record_count,
      pg_size_pretty(SUM(length(COALESCE(reason, '')))::bigint) AS total_reason_size,
      MAX(dates) AS latest_date
    FROM public.leaves
    GROUP BY employee
    ORDER BY SUM(length(COALESCE(reason, ''))) DESC;
  `);
  console.table(leavesStats.rows);

  // 5. Inspect BOM Orders & Document Storage
  console.log('\n--- 4. Inspecting BOM Storage & Document Payloads ---');
  const bomStoreRow = await query(`
    SELECT
      key,
      length(data::text) AS total_bytes,
      pg_size_pretty(length(data::text)::bigint) AS pretty_size,
      jsonb_array_length(data) AS bom_count
    FROM controlroom_store
    WHERE key = 'bom_store';
  `);
  if (bomStoreRow.rows.length > 0) {
    const row = bomStoreRow.rows[0];
    console.log(`   bom_store in controlroom_store: ${row.bom_count} BOMs, Size: ${row.pretty_size} (${row.total_bytes} bytes)`);

    // Check document attachments in bom_store
    const bomDocAudit = await query(`
      SELECT
        (item->>'bomCode') AS bom_code,
        (item->>'customerName') AS customer_name,
        length(COALESCE(item->>'paymentProof', '')) AS payment_proof_bytes,
        length(COALESCE(item->>'addressProof', '')) AS address_proof_bytes,
        length(COALESCE(item->>'dispatchAttachment', '')) AS dispatch_attach_bytes,
        length(item::text) AS total_bom_bytes
      FROM controlroom_store,
      LATERAL jsonb_array_elements(data) AS item
      WHERE key = 'bom_store'
      ORDER BY length(item::text) DESC
      LIMIT 10;
    `);
    console.log('\n   Top 10 Largest BOM Orders:');
    console.table(bomDocAudit.rows);
  }

  // 6. Inspect Proforma Invoices & Invoices
  console.log('\n--- 5. Inspecting Proforma Invoices & Invoices ---');
  try {
    const piStats = await query(`
      SELECT COUNT(*) AS total_pis, pg_size_pretty(pg_total_relation_size('public.proforma_invoices')) AS table_size
      FROM public.proforma_invoices;
    `);
    console.log(`   public.proforma_invoices: ${piStats.rows[0].total_pis} records, Size: ${piStats.rows[0].table_size}`);
  } catch (e) {
    console.log('   public.proforma_invoices query notice:', e.message);
  }

  try {
    const invStats = await query(`
      SELECT key, pg_size_pretty(length(data::text)::bigint) AS size, jsonb_array_length(data) AS count
      FROM controlroom_store WHERE key = 'invoice_store';
    `);
    if (invStats.rows.length > 0) {
      console.log(`   invoice_store: ${invStats.rows[0].count} invoices, Size: ${invStats.rows[0].size}`);
    }
  } catch (e) {
    console.log('   invoice_store notice:', e.message);
  }

  // 7. Check Existing Indexes on User Tables
  console.log('\n--- 6. Existing Indexes on Tables ---');
  const indexList = await query(`
    SELECT
      tablename,
      indexname,
      indexdef
    FROM pg_indexes
    WHERE schemaname = 'public'
    ORDER BY tablename, indexname;
  `);
  console.table(indexList.rows.map(r => ({
    table: r.tablename,
    index: r.indexname,
    definition: r.definition
  })));

  process.exit(0);
}

auditDatabase().catch(err => {
  console.error('Audit failed:', err);
  process.exit(1);
});
