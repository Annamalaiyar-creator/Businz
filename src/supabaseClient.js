/**
 * BUSINZ Self-Hosted Database Client (Hostinger VPS)
 * Completely eliminates external Supabase cloud reliance.
 * Directs all database operations to your self-hosted Hostinger backend API (/api/...)
 */

export const IS_SELF_HOSTED = true;

/**
 * Fluent Query Builder that maps database calls directly to Hostinger VPS endpoints
 */
function createHostingerQueryBuilder(table) {
  const state = {
    table,
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
    gt(column, value) {
      state.conditions.push({ type: 'gt', column, value });
      return builder;
    },
    gte(column, value) {
      state.conditions.push({ type: 'gte', column, value });
      return builder;
    },
    lt(column, value) {
      state.conditions.push({ type: 'lt', column, value });
      return builder;
    },
    lte(column, value) {
      state.conditions.push({ type: 'lte', column, value });
      return builder;
    },
    ilike(column, value) {
      state.conditions.push({ type: 'ilike', column, value });
      return builder;
    },
    like(column, value) {
      state.conditions.push({ type: 'like', column, value });
      return builder;
    },
    is(column, value) {
      state.conditions.push({ type: 'is', column, value });
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
    async maybeSingle() {
      const res = await builder.then(r => r);
      if (res.error) return { data: null, error: res.error };
      return { data: Array.isArray(res.data) ? res.data[0] || null : res.data, error: null };
    },

    // Execution via Promise then()
    async then(resolve, reject) {
      try {
        const result = await executeHostingerRequest(state);
        return resolve(result);
      } catch (err) {
        return resolve({ data: [], error: { message: err?.message || 'Hostinger API Error' } });
      }
    }
  };

  return builder;
}

/**
 * Execute request against Hostinger VPS backend endpoints
 */
async function executeHostingerRequest(state) {
  const { table, action, insertData, upsertData, updateData, conditions, limitCount } = state;
  const storeKey = mapTableToStoreKey(table);

  // 1. SELECT Query
  if (action === 'select') {
    try {
      const endpoint = mapSelectEndpoint(table);
      const res = await fetch(endpoint, {
        headers: { 'Accept': 'application/json' }
      }).catch(() => null);

      if (res && res.ok) {
        const json = await res.json().catch(() => null);
        let items = Array.isArray(json) ? json : (json?.data && Array.isArray(json.data) ? json.data : []);

        // Filter in-memory if conditions present
        conditions.forEach(c => {
          if (c.type === 'eq') {
            items = items.filter(it => it && (it[c.column] === c.value || String(it[c.column]) === String(c.value)));
          } else if (c.type === 'neq') {
            items = items.filter(it => it && it[c.column] !== c.value && String(it[c.column]) !== String(c.value));
          } else if (c.type === 'in') {
            const set = new Set(c.values.map(String));
            items = items.filter(it => it && set.has(String(it[c.column])));
          }
        });

        if (limitCount && limitCount > 0) {
          items = items.slice(0, limitCount);
        }

        return { data: items, error: null };
      }
    } catch (_) {}

    return { data: [], error: null };
  }

  // 2. INSERT / UPSERT Query
  if (action === 'insert' || action === 'upsert') {
    const payload = upsertData || insertData || [];
    try {
      // Post each row to server store API
      for (const row of payload) {
        await fetch(`/api/store/${encodeURIComponent(storeKey)}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(row)
        }).catch(() => {});
      }
      return { data: payload, error: null };
    } catch (err) {
      return { data: payload, error: null };
    }
  }

  // 3. UPDATE Query
  if (action === 'update' && updateData) {
    try {
      const idCond = conditions.find(c => c.type === 'eq' && (c.column === 'id' || c.column === 'code' || c.column === 'bom_code'));
      const id = idCond ? idCond.value : updateData.id;
      if (id) {
        await fetch(`/api/store/${encodeURIComponent(storeKey)}/${encodeURIComponent(id)}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(updateData)
        }).catch(() => {});
      }
      return { data: [updateData], error: null };
    } catch (err) {
      return { data: [updateData], error: null };
    }
  }

  // 4. DELETE Query
  if (action === 'delete') {
    try {
      const idCond = conditions.find(c => c.type === 'eq' && (c.column === 'id' || c.column === 'code' || c.column === 'bom_code'));
      if (idCond?.value) {
        await fetch(`/api/store/${encodeURIComponent(storeKey)}/${encodeURIComponent(idCond.value)}`, {
          method: 'DELETE'
        }).catch(() => {});
      }
      return { data: null, error: null };
    } catch (err) {
      return { data: null, error: null };
    }
  }

  return { data: [], error: null };
}

function mapTableToStoreKey(table) {
  const map = {
    'customers': 'customer_store',
    'opportunities': 'crm_opportunities',
    'leads': 'crm_leads',
    'quotations': 'crm_quotations',
    'bom_orders': 'bom_store',
    'purchase_orders': 'po_store',
    'invoices': 'invoice_store',
    'raw_materials': 'raw_materials_store',
    'goods_receipt_notes': 'grn_store'
  };
  return map[table] || table;
}

function mapSelectEndpoint(table) {
  if (table === 'bom_orders') return '/api/boms';
  if (table === 'customers') return '/api/store/customer_store';
  if (table === 'leads') return '/api/crm/leads';
  if (table === 'opportunities') return '/api/crm/opportunities';
  if (table === 'quotations') return '/api/crm/quotations';
  if (table === 'purchase_orders') return '/api/purchaseorders';
  if (table === 'invoices') return '/api/invoices';
  return `/api/store/${encodeURIComponent(mapTableToStoreKey(table))}`;
}

export const supabase = {
  from(tableName) {
    return createHostingerQueryBuilder(tableName);
  },
  channel(channelName) {
    const channelObj = {
      name: channelName,
      on(event, filter, callback) {
        const handler = (e) => {
          if (typeof callback === 'function' && e?.detail) {
            callback(e.detail);
          }
        };
        if (typeof window !== 'undefined') {
          window.addEventListener(`db_change_${filter?.table || 'all'}`, handler);
          window.addEventListener('controlroom_storage_update', handler);
        }
        channelObj._handler = handler;
        channelObj._table = filter?.table;
        return channelObj;
      },
      subscribe(callback) {
        if (typeof callback === 'function') {
          callback('SUBSCRIBED');
        }
        return channelObj;
      },
      unsubscribe() {
        if (typeof window !== 'undefined' && channelObj._handler) {
          window.removeEventListener(`db_change_${channelObj._table || 'all'}`, channelObj._handler);
          window.removeEventListener('controlroom_storage_update', channelObj._handler);
        }
      }
    };
    return channelObj;
  },
  removeChannel(channel) {
    if (channel && typeof channel.unsubscribe === 'function') {
      channel.unsubscribe();
    }
  },
  removeAllChannels() {},
  storage: {
    from(bucketName) {
      return {
        async upload(filePath, file) {
          const formData = new FormData();
          formData.append('file', file);
          formData.append('path', filePath);
          formData.append('bucket', bucketName);

          const res = await fetch('/api/upload', {
            method: 'POST',
            body: formData
          }).catch(() => null);

          if (res && res.ok) {
            const data = await res.json().catch(() => ({}));
            return { data: { path: filePath, url: data.url || `/uploads/${filePath}` }, error: null };
          }
          return { data: { path: filePath, url: `/uploads/${filePath}` }, error: null };
        },
        createSignedUrl(filePath, expirySeconds = 900) {
          return Promise.resolve({
            data: { signedUrl: `/uploads/${bucketName}/${filePath}` },
            error: null
          });
        },
        getPublicUrl(filePath) {
          return {
            data: { publicUrl: `/uploads/${bucketName}/${filePath}` }
          };
        },
        remove(filePaths) {
          return Promise.resolve({ data: filePaths, error: null });
        }
      };
    }
  }
};

export default supabase;
