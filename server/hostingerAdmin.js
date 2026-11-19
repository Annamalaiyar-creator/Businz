/**
 * Server-only Database Admin for Hostinger VPS
 * Self-hosted PostgreSQL admin operations.
 */
import { pool, query, isDbConnected, createLocalDbClient } from './db.js';

const localDbClient = createLocalDbClient();

export const hostingerAdmin = {
  isSelfHosted: true,
  query,
  pool,
  isDbConnected,
  from: (tableName) => localDbClient.from(tableName),
  storage: {
    from() {
      return {
        upload: () => Promise.resolve({ data: {}, error: null }),
        createSignedUrl: (path) => Promise.resolve({ data: { signedUrl: `/api/uploads/bom-documents/${path}` }, error: null }),
        remove: () => Promise.resolve({ data: [], error: null })
      };
    }
  }
};

export const supabaseAdmin = hostingerAdmin;
export default hostingerAdmin;
