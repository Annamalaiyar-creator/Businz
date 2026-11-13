import { fileURLToPath } from 'url';

/**
 * Disabled no-op stub: VRMS/BOM/26-27/556..559 are assigned to active production orders,
 * so legacy VRM-BOM-1132/1166/1198/1227 records must NOT be renumbered onto them.
 */
export async function renumberBoms554And555() {
  return { disabled: true, pgUpdated: 0, crStoreUpdated: 0, diskUpdated: 0 };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  renumberBoms554And555().then((res) => {
    console.log('renumberBoms554And555 disabled:', res);
    process.exit(0);
  });
}
