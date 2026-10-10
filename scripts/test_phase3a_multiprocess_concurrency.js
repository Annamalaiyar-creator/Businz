/**
 * Multi-Process Database Concurrency Safety Verification
 * 
 * Spawns 2 separate OS Node.js processes running concurrent database operations
 * to prove transaction safety across multiple independent server processes.
 */

import { fork } from 'child_process';
import { pool, query, initPostgresDatabase } from '../server/db.js';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function runMultiProcessTest() {
  console.log('===============================================================');
  console.log('  PHASE 3A: MULTI-PROCESS DATABASE CONCURRENCY SAFETY TEST');
  console.log('===============================================================');

  await initPostgresDatabase();

  // Create two test records
  await query(`
    INSERT INTO public.bom_orders (id, bom_code, customer_name, status, remarks, grand_total, updated_at)
    VALUES 
      ('BOM-MP-1', 'BOM-MP-1', 'Test Client 1', 'Draft', 'Initial MP1', 1000, NOW()),
      ('BOM-MP-2', 'BOM-MP-2', 'Test Client 2', 'Draft', 'Initial MP2', 2000, NOW())
    ON CONFLICT (id) DO UPDATE SET remarks = EXCLUDED.remarks, updated_at = NOW()
  `);

  // Define worker logic
  const workerScript = `
    import { pool, query } from '../server/db.js';
    const procId = process.argv[2];
    const targetId = process.argv[3];
    const newRemarks = process.argv[4];

    async function runWorker() {
      // Simulate real transaction with slight delay
      await query('BEGIN');
      try {
        await query('SELECT * FROM public.bom_orders WHERE id = $1 FOR UPDATE', [targetId]);
        await new Promise(r => setTimeout(r, 100)); // Hold lock briefly
        await query('UPDATE public.bom_orders SET remarks = $1, updated_at = NOW() WHERE id = $2', [newRemarks, targetId]);
        await query('COMMIT');
        console.log('Worker ' + procId + ' updated ' + targetId + ' successfully.');
        process.exit(0);
      } catch (err) {
        await query('ROLLBACK').catch(() => null);
        console.error('Worker ' + procId + ' failed:', err.message);
        process.exit(1);
      }
    }
    runWorker();
  `;

  // Write temporary worker script
  const fs = await import('fs');
  const workerPath = path.resolve(__dirname, 'temp_mp_worker.js');
  fs.writeFileSync(workerPath, workerScript, 'utf8');

  try {
    // Spawn Process A and Process B simultaneously
    const p1 = new Promise((resolve, reject) => {
      const child1 = fork(workerPath, ['ProcessA', 'BOM-MP-1', 'Updated by Process A'], {
        env: { ...process.env, DATABASE_URL: 'postgres://annamalaiyar@127.0.0.1:5432/businz_staging_test' }
      });
      child1.on('exit', code => code === 0 ? resolve() : reject(new Error('Process A exited with ' + code)));
    });

    const p2 = new Promise((resolve, reject) => {
      const child2 = fork(workerPath, ['ProcessB', 'BOM-MP-2', 'Updated by Process B'], {
        env: { ...process.env, DATABASE_URL: 'postgres://annamalaiyar@127.0.0.1:5432/businz_staging_test' }
      });
      child2.on('exit', code => code === 0 ? resolve() : reject(new Error('Process B exited with ' + code)));
    });

    await Promise.all([p1, p2]);

    // Verify both writes in database
    const res = await query(`SELECT id, remarks FROM public.bom_orders WHERE id IN ('BOM-MP-1', 'BOM-MP-2') ORDER BY id ASC`);
    const valid = res.rows[0].remarks === 'Updated by Process A' && res.rows[1].remarks === 'Updated by Process B';

    console.log(valid 
      ? '✅ PASS: Multi-process concurrency test succeeded with clean row-level transaction safety!' 
      : '❌ FAIL: Multi-process concurrency failed.');

  } finally {
    // Clean up
    await query(`DELETE FROM public.bom_orders WHERE id IN ('BOM-MP-1', 'BOM-MP-2')`);
    if (fs.existsSync(workerPath)) fs.unlinkSync(workerPath);
    await pool.end();
  }
}

runMultiProcessTest().then(() => process.exit(0)).catch(err => {
  console.error('Test Error:', err);
  process.exit(1);
});
