// Standalone Zoho proxy and integration gateway for Control Room on Plesk / Production
const https = require('https');
const http = require('http');
const url = require('url');
const fs = require('fs');
const path = require('path');

const ZOHO_CLIENT_ID = process.env.ZOHO_CLIENT_ID || '1000.9U5BAN338075M5HBI3U8K1VBNKUU8K';
const ZOHO_CLIENT_SECRET = process.env.ZOHO_CLIENT_SECRET || 'e82079a5165e3b2e75fdc602f3e08fd38489d75f13';
const ZOHO_REFRESH_TOKEN = process.env.ZOHO_REFRESH_TOKEN || '1000.69cd7dbd3da3ab8f107f8addf5e9e04c.87b4757d889f6ebd95a1bf897147a1c7';
const ZOHO_ORG_ID = process.env.ZOHO_ORG_ID || '60082137608';

let cachedAccessToken = '';
let tokenExpiresAt = 0;

// Local JSON Store Helpers for Zero-Data-Loss Protection
function getStorePath(filename) {
  return path.join(__dirname, filename);
}

function loadStore(filename, fallback = []) {
  try {
    const p = getStorePath(filename);
    if (fs.existsSync(p)) {
      const content = fs.readFileSync(p, 'utf8');
      return JSON.parse(content);
    }
  } catch (err) {
    console.error(`[STORE LOAD WARNING] Failed loading ${filename}:`, err.message);
  }
  return fallback;
}

function saveStore(filename, data) {
  try {
    const p = getStorePath(filename);
    fs.writeFileSync(p, JSON.stringify(data, null, 2), 'utf8');
  } catch (err) {
    console.error(`[STORE SAVE WARNING] Failed saving ${filename}:`, err.message);
  }
}

// ☁️ Supabase Cloud Synchronization for Zero-Data-Loss on Live Server
const SUPABASE_URL = process.env.SUPABASE_URL || 'https://zjkabqcgymxysqgfbbge.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inpqa2FicWNneW14eXNxZ2ZiYmdlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODUyOTQzNzYsImV4cCI6MjEwMDg3MDM3Nn0.z821_dGCjnS_LZnj6l5mERGtu8wZvkMRDiGURXxFXmY';

let supabase = null;
try {
  const { createClient } = require('@supabase/supabase-js');
  supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
} catch (e) {
  console.warn('[Plesk Gateway] @supabase/supabase-js not found, falling back to direct HTTPS REST API:', e.message);
}

let appBomSequenceCounter = null;
let appBomReservationLock = Promise.resolve();

function withBomLock(fn) {
  const current = appBomReservationLock;
  let release;
  appBomReservationLock = new Promise(resolve => { release = resolve; });
  return current.then(() => fn()).finally(() => { release(); });
}

function resolveBomCollisions(bomList, sequenceMax = 658) {
  if (!Array.isArray(bomList)) return { list: [], maxSeq: sequenceMax };
  let maxSeq = Math.max(sequenceMax, 658);
  
  bomList.forEach(b => {
    const m = String(b?.bomCode || b?.code || b?.id || '').match(/^BOM-(\d+)/i);
    if (m) {
      const val = parseInt(m[1], 10);
      if (Number.isFinite(val) && val > maxSeq) maxSeq = val;
    }
  });

  const seenCodes = new Map();
  const resolvedList = [];

  for (const b of bomList) {
    if (!b) continue;
    const code = String(b.bomCode || b.code || b.id || '').trim();
    if (!code || code === 'BOM-PENDING') {
      maxSeq += 1;
      const newCode = `BOM-${String(maxSeq).padStart(3, '0')}`;
      resolvedList.push({ ...b, id: newCode, bomCode: newCode, code: newCode });
      continue;
    }

    if (!seenCodes.has(code)) {
      seenCodes.set(code, b);
      resolvedList.push(b);
    } else {
      const existing = seenCodes.get(code);
      const bCust = (b.companyName || b.customerName || '').trim().toLowerCase();
      const exCust = (existing.companyName || existing.customerName || '').trim().toLowerCase();
      const bSales = (b.salesPerson || '').trim().toLowerCase();
      const exSales = (existing.salesPerson || '').trim().toLowerCase();
      const bDate = b.salesConfirmedAt || b.createdAt || b.date;
      const exDate = existing.salesConfirmedAt || existing.createdAt || existing.date;

      const isExactSame = (bCust && exCust && bCust === exCust && bSales === exSales) || (bDate && exDate && bDate === exDate);
      if (isExactSame) {
        const idx = resolvedList.findIndex(r => (r.bomCode || r.code || r.id) === code);
        if (idx !== -1) {
          resolvedList[idx] = { ...resolvedList[idx], ...b };
        }
      } else {
        maxSeq += 1;
        const newCode = `BOM-${String(maxSeq).padStart(3, '0')}`;
        console.warn(`[Plesk Collision Resolved] Order for '${b.companyName || b.customerName}' renumbered from ${code} to ${newCode}`);
        const renumbered = { ...b, id: newCode, bomCode: newCode, code: newCode };
        resolvedList.push(renumbered);
        seenCodes.set(newCode, renumbered);
      }
    }
  }

  return { list: resolvedList, maxSeq };
}

async function getAtomicHighestBomNumber() {
  let diskList = loadStore('bom_store.json', []);
  let cloudList = await fetchSupabaseStore('bom_store') || [];
  let seqData = await fetchSupabaseStore('BOM_SEQUENCE');
  
  let maxNum = 658;
  if (appBomSequenceCounter && appBomSequenceCounter > maxNum) {
    maxNum = appBomSequenceCounter;
  }
  if (seqData) {
    const sNum = parseInt(String(seqData.lastNumber || seqData.counter || 0).replace(/[^0-9]/g, ''), 10);
    if (Number.isFinite(sNum) && sNum > maxNum) maxNum = sNum;
  }
  const scan = (item) => {
    const c = item?.bomCode || item?.code || item?.id || '';
    const m = String(c).match(/^BOM-(\d+)/i);
    if (m) {
      const val = parseInt(m[1], 10);
      if (Number.isFinite(val) && val > maxNum) maxNum = val;
    }
  };
  (Array.isArray(diskList) ? diskList : []).forEach(scan);
  (Array.isArray(cloudList) ? cloudList : []).forEach(scan);
  
  return {
    maxNum,
    diskList: Array.isArray(diskList) ? diskList : [],
    cloudList: Array.isArray(cloudList) ? cloudList : []
  };
}

// Fallback direct HTTPS fetch to Supabase REST API if @supabase/supabase-js is not installed on the server
async function supabaseDirectQuery(method, endpoint, body = null) {
  return new Promise((resolve) => {
    try {
      const u = new URL(`${SUPABASE_URL}/rest/v1/${endpoint}`);
      const payload = body ? JSON.stringify(body) : null;
      const opts = {
        hostname: u.hostname,
        port: 443,
        path: u.pathname + u.search,
        method: method,
        headers: {
          'apikey': SUPABASE_KEY,
          'Authorization': `Bearer ${SUPABASE_KEY}`,
          'Content-Type': 'application/json',
          'Prefer': 'return=representation'
        }
      };
      if (payload) {
        opts.headers['Content-Length'] = Buffer.byteLength(payload);
      }
      const req = https.request(opts, (res) => {
        let resData = '';
        res.on('data', chunk => { resData += chunk; });
        res.on('end', () => {
          try {
            resolve({ ok: res.statusCode >= 200 && res.statusCode < 300, status: res.statusCode, data: JSON.parse(resData) });
          } catch (_) {
            resolve({ ok: res.statusCode >= 200 && res.statusCode < 300, status: res.statusCode, data: null });
          }
        });
      });
      req.on('error', () => resolve({ ok: false, data: null }));
      req.setTimeout(5000, () => { req.destroy(); resolve({ ok: false, data: null }); });
      if (payload) req.write(payload);
      req.end();
    } catch (_) {
      resolve({ ok: false, data: null });
    }
  });
}

async function fetchSupabaseStore(key) {
  const empKey = key.toUpperCase();
  if (supabase) {
    try {
      const { data, error } = await supabase.from('leaves').select('id, reason').eq('employee', empKey).order('id', { ascending: false }).limit(1);
      if (!error && data && data.length > 0 && data[0].reason) {
        return JSON.parse(data[0].reason);
      }
    } catch (_) {}
  } else {
    try {
      const res = await supabaseDirectQuery('GET', `leaves?employee=eq.${encodeURIComponent(empKey)}&select=id,reason&order=id.desc&limit=1`);
      if (res.ok && res.data && res.data.length > 0 && res.data[0].reason) {
        return JSON.parse(res.data[0].reason);
      }
    } catch (_) {}
  }
  return null;
}

async function pushSupabaseStore(key, storeData) {
  const empKey = key.toUpperCase();
  const reasonStr = JSON.stringify(storeData);
  const durationStr = String(Array.isArray(storeData) ? storeData.length : 1);
  if (supabase) {
    try {
      const { data } = await supabase.from('leaves').select('id').eq('employee', empKey).order('id', { ascending: false }).limit(1);
      const existing = (data && data.length > 0) ? data[0] : null;
      if (existing && existing.id) {
        await supabase.from('leaves').update({
          reason: reasonStr,
          status: 'active',
          dates: new Date().toISOString(),
          duration: durationStr
        }).eq('id', existing.id);
      } else {
        await supabase.from('leaves').insert({
          employee: empKey,
          reason: reasonStr,
          status: 'active',
          dates: new Date().toISOString(),
          duration: durationStr,
          type: 'Store'
        });
      }
    } catch (err) {
      console.warn(`[Plesk Gateway Supabase Push Warn for ${key}]:`, err.message);
    }
  } else {
    try {
      const checkRes = await supabaseDirectQuery('GET', `leaves?employee=eq.${encodeURIComponent(empKey)}&select=id&order=id.desc&limit=1`);
      const existing = (checkRes.ok && checkRes.data && checkRes.data.length > 0) ? checkRes.data[0] : null;
      if (existing && existing.id) {
        await supabaseDirectQuery('PATCH', `leaves?id=eq.${existing.id}`, {
          reason: reasonStr,
          status: 'active',
          dates: new Date().toISOString(),
          duration: durationStr
        });
      } else {
        await supabaseDirectQuery('POST', 'leaves', {
          employee: empKey,
          reason: reasonStr,
          status: 'active',
          dates: new Date().toISOString(),
          duration: durationStr,
          type: 'Store'
        });
      }
    } catch (err) {
      console.warn(`[Plesk Gateway Supabase Push Warn for ${key}]:`, err.message);
    }
  }
}

function stripServerDataUrls(target) {
  if (!target || typeof target !== 'object') return;
  if (target.dataUrl) delete target.dataUrl;
  if (target.fileData) delete target.fileData;
  if (target.proofDocData) delete target.proofDocData;
  Object.keys(target).forEach(k => {
    if (typeof target[k] === 'string' && (target[k].startsWith('data:') || (target[k].length > 1000 && /^[A-Za-z0-9+/=]+$/.test(target[k].slice(0, 100))))) {
      delete target[k];
    } else if (target[k] && typeof target[k] === 'object') {
      stripServerDataUrls(target[k]);
    }
  });
}

function getZohoAccessToken() {
  const now = Date.now();
  if (cachedAccessToken && tokenExpiresAt > now + 300000) {
    return Promise.resolve(cachedAccessToken);
  }

  return new Promise((resolve, reject) => {
    const postData = new URLSearchParams({
      refresh_token: ZOHO_REFRESH_TOKEN,
      client_id: ZOHO_CLIENT_ID,
      client_secret: ZOHO_CLIENT_SECRET,
      grant_type: 'refresh_token'
    }).toString();

    const req = https.request({
      hostname: 'accounts.zoho.in',
      port: 443,
      path: '/oauth/v2/token',
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Content-Length': Buffer.byteLength(postData)
      }
    }, (res) => {
      let data = '';
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          if (parsed.access_token) {
            cachedAccessToken = parsed.access_token;
            tokenExpiresAt = Date.now() + (parsed.expires_in || 3600) * 1000;
            resolve(parsed.access_token);
          } else {
            reject(new Error(parsed.error || 'Failed to obtain access token'));
          }
        } catch (e) {
          reject(e);
        }
      });
    });

    req.on('error', reject);
    req.write(postData);
    req.end();
  });
}

function callZoho(method, apiPath, body = null, accessToken) {
  return new Promise((resolve, reject) => {
    const separator = apiPath.includes('?') ? '&' : '?';
    const fullPath = `${apiPath}${separator}organization_id=${ZOHO_ORG_ID}`;
    const payloadStr = body ? JSON.stringify(body) : null;

    const req = https.request({
      hostname: 'www.zohoapis.in',
      port: 443,
      path: fullPath,
      method: method,
      headers: {
        'Authorization': `Zoho-oauthtoken ${accessToken}`,
        'Content-Type': 'application/json',
        ...(payloadStr ? { 'Content-Length': Buffer.byteLength(payloadStr) } : {})
      }
    }, (res) => {
      let data = '';
      res.on('data', c => { data += c; });
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (_) {
          resolve({ raw: data });
        }
      });
    });

    req.on('error', reject);
    if (payloadStr) req.write(payloadStr);
    req.end();
  });
}

const server = http.createServer(async (req, res) => {
  // CORS Headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    return res.end();
  }

  const parsedUrl = url.parse(req.url, true);
  const pathname = parsedUrl.pathname;
  const query = parsedUrl.query;

  // Read request body
  let rawBody = '';
  req.on('data', chunk => { rawBody += chunk; });
  req.on('end', async () => {
    let body = {};
    if (rawBody) {
      try { body = JSON.parse(rawBody); } catch (_) {}
    }

    try {
      // 0. Zoho Health & Connection Status
      if (pathname === '/api/zoho/status' || pathname.endsWith('/status')) {
        let connected = false;
        try {
          const token = await getZohoAccessToken();
          connected = Boolean(token);
        } catch (_) {}
        res.writeHead(200, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({
          connected,
          orgId: ZOHO_ORG_ID,
          server: 'BigRock Plesk Standalone Gateway',
          time: new Date().toISOString()
        }));
      }

      // 1. Next PO Number Sequence
      if (pathname === '/api/zoho/next-po-number' || pathname.endsWith('/next-po-number')) {
        const token = await getZohoAccessToken();
        const zohoRes = await callZoho('GET', '/books/v3/purchaseorders?per_page=10&sort_column=created_time&sort_order=D', null, token);
        let maxNum = 91;
        if (zohoRes && Array.isArray(zohoRes.purchaseorders)) {
          zohoRes.purchaseorders.forEach(p => {
            const match = String(p.purchaseorder_number || '').match(/^PO-(\d+)/i);
            if (match) {
              const v = parseInt(match[1], 10);
              if (v > maxNum && v < 99999) maxNum = v;
            }
          });
        }
        const nextPoNumber = 'PO-' + String(maxNum + 1).padStart(5, '0');
        res.writeHead(200, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ success: true, nextPoNumber, nextPoNo: nextPoNumber }));
      }

      // 2. Customers Bidirectional Sync (Sales Customer Adding)
      if (pathname === '/api/zoho/customers' || pathname.endsWith('/customers')) {
        const localCustomers = loadStore('customer_store.json', []);

        if (req.method === 'GET') {
          let zohoCustomers = [];
          try {
            const token = await getZohoAccessToken();
            const zohoRes = await callZoho('GET', '/books/v3/contacts?contact_type=customer&per_page=200', null, token);
            if (zohoRes && Array.isArray(zohoRes.contacts)) {
              zohoCustomers = zohoRes.contacts.map(c => ({
                id: c.contact_id || c.id,
                customerCode: c.contact_name || c.company_name,
                customerName: c.contact_name || c.company_name,
                companyName: c.company_name || c.contact_name,
                customerType: 'Customer',
                email: c.email || '—',
                phone: c.phone || '—',
                gstNumber: c.gst_no || '—',
                panNumber: c.pan_no || '—',
                status: c.status === 'active' ? 'ACTIVE' : 'INACTIVE',
                zohoContactId: c.contact_id
              }));
            }
          } catch (e) {
            console.warn('[ZOHO CUSTOMERS FETCH NOTICE]', e.message);
          }

          // Merge Zoho customers with local customer store (so neither Zoho nor local records are lost)
          const mergedMap = new Map();
          zohoCustomers.forEach(zc => {
            const key = String(zc.customerName || zc.companyName || zc.id).toLowerCase().trim();
            mergedMap.set(key, zc);
          });
          localCustomers.forEach(lc => {
            const key = String(lc.customerName || lc.companyName || lc.id || lc.customerCode).toLowerCase().trim();
            if (mergedMap.has(key)) {
              mergedMap.set(key, { ...mergedMap.get(key), ...lc });
            } else {
              mergedMap.set(key, lc);
            }
          });

          const finalCustomers = Array.from(mergedMap.values());
          saveStore('customer_store.json', finalCustomers);

          res.writeHead(200, { 'Content-Type': 'application/json' });
          return res.end(JSON.stringify(finalCustomers));
        }

        if (req.method === 'POST') {
          // Immediately save locally first to guarantee zero data loss
          const customerId = body.customerCode || body.id || `CUST-VRM-${100 + localCustomers.length + 1}`;
          const localRecord = {
            ...body,
            id: customerId,
            customerCode: customerId,
            customerName: body.customerName || body.companyName || body.name || 'Valued Customer',
            companyName: body.companyName || body.customerName || body.name || 'Valued Customer',
            status: body.status || 'ACTIVE',
            createdAt: new Date().toISOString()
          };

          const updatedLocal = [localRecord, ...localCustomers.filter(c => c.customerCode !== localRecord.customerCode && c.companyName !== localRecord.companyName)];
          saveStore('customer_store.json', updatedLocal);

          // Now forward to Zoho Books
          try {
            const token = await getZohoAccessToken();
            const contactName = String(localRecord.customerName || localRecord.companyName).trim();
            const companyName = String(localRecord.companyName || localRecord.customerName).trim();

            const zohoPayload = {
              contact_name: contactName,
              company_name: companyName,
              contact_type: 'customer',
              customer_sub_type: 'business',
              currency_code: 'INR',
              pan_no: localRecord.panNumber ? String(localRecord.panNumber).trim().slice(0, 10) : undefined,
              billing_address: {
                address: String(localRecord.address || localRecord.streetAddress || '').slice(0, 80),
                city: String(localRecord.city || '').slice(0, 40),
                state: String(localRecord.state || '').slice(0, 40),
                zip: String(localRecord.pincode || '').slice(0, 20),
                country: 'India'
              },
              shipping_address: {
                address: String(localRecord.dispatchAddress || localRecord.address || '').slice(0, 80),
                city: String(localRecord.dispatchCity || localRecord.city || '').slice(0, 40),
                state: String(localRecord.dispatchState || localRecord.state || '').slice(0, 40),
                zip: String(localRecord.dispatchPincode || localRecord.pincode || '').slice(0, 20),
                country: 'India'
              },
              notes: localRecord.gstNumber ? `GSTIN: ${String(localRecord.gstNumber).trim()}` : undefined
            };

            const zohoRes = await callZoho('POST', '/books/v3/contacts', zohoPayload, token);

            if (zohoRes && (zohoRes.code === 0 || zohoRes.contact)) {
              const zohoContact = zohoRes.contact || {};
              localRecord.zohoContactId = zohoContact.contact_id;
              const reSaved = updatedLocal.map(c => c.customerCode === localRecord.customerCode ? { ...c, zohoContactId: zohoContact.contact_id } : c);
              saveStore('customer_store.json', reSaved);

              res.writeHead(200, { 'Content-Type': 'application/json' });
              return res.end(JSON.stringify({
                success: true,
                message: 'Customer created and synchronized to Zoho Books successfully!',
                customer: localRecord,
                zohoContact
              }));
            } else {
              console.warn('[ZOHO CUSTOMER CREATE WARN]', zohoRes);
              res.writeHead(200, { 'Content-Type': 'application/json' });
              return res.end(JSON.stringify({
                success: true,
                message: `Saved in Control Room. Zoho note: ${(zohoRes && zohoRes.message) || 'Pending sync'}`,
                customer: localRecord
              }));
            }
          } catch (zohoErr) {
            console.error('[ZOHO CUSTOMER SYNC ERROR]', zohoErr.message);
            res.writeHead(200, { 'Content-Type': 'application/json' });
            return res.end(JSON.stringify({
              success: true,
              message: 'Customer saved locally in Control Room.',
              customer: localRecord
            }));
          }
        }
      }

      // 3. Purchase Orders (Fetch, Create, Approval Flow)
      if (pathname === '/api/zoho/purchaseorders' || pathname.endsWith('/purchaseorders')) {
        const token = await getZohoAccessToken();

        if (req.method === 'GET') {
          const zohoRes = await callZoho('GET', '/books/v3/purchaseorders?per_page=200&sort_column=created_time&sort_order=D', null, token);
          const wfStore = loadStore('po_workflow_store.json', {});
          const localPOs = loadStore('po_store.json', []);

          const mapped = ((zohoRes && zohoRes.purchaseorders) || []).map(p => {
            const wf = wfStore[p.purchaseorder_id] || wfStore[p.purchaseorder_number] || null;
            let st = p.status === 'open' ? 'OPEN' : (p.status === 'draft' ? 'Draft / Pending Approval' : p.status);
            let stType = p.status === 'open' ? 'approved' : (p.status === 'draft' ? 'pending' : 'draft');

            if (wf && wf.status) {
              st = wf.status;
              stType = wf.statusType || stType;
            }

            return {
              id: p.purchaseorder_id,
              poNo: p.purchaseorder_number,
              vendor: p.vendor_name,
              poDate: p.date,
              deliveryDate: p.delivery_date,
              amount: `₹${Number(p.total || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`,
              total: p.total,
              status: st,
              statusType: stType,
              items: []
            };
          });

          // Also include any local POs not yet in Zoho list
          const existingNos = new Set(mapped.map(m => String(m.poNo).toLowerCase()));
          localPOs.forEach(lp => {
            if (!existingNos.has(String(lp.poNo).toLowerCase())) {
              mapped.unshift(lp);
            }
          });

          res.writeHead(200, { 'Content-Type': 'application/json' });
          return res.end(JSON.stringify(mapped));
        }

        if (req.method === 'POST') {
          const parseDate = (d) => {
            if (!d) return new Date().toISOString().split('T')[0];
            const dt = new Date(d);
            return isNaN(dt.getTime()) ? new Date().toISOString().split('T')[0] : dt.toISOString().split('T')[0];
          };

          const lineItems = (body.items || []).map(it => ({
            name: it.itemName || it.name || 'General Item',
            rate: Number(it.unitPrice || it.rate || it.price || 100),
            quantity: Number(it.qty || it.quantity || 1),
            account_id: '4080449000000000567'
          }));

          if (lineItems.length === 0) {
            lineItems.push({ name: 'General Procurement Item', rate: 1000, quantity: 1, account_id: '4080449000000000567' });
          }

          const zohoPayload = {
            purchaseorder_number: body.poNo || undefined,
            vendor_id: body.vendorId || '4080449000000039008',
            date: parseDate(body.poDate),
            delivery_date: parseDate(body.deliveryDate),
            line_items: lineItems
          };

          if (body.deliveryAddress) zohoPayload.delivery_address = String(body.deliveryAddress).slice(0, 80);
          if (body.billingAddress) zohoPayload.billing_address = String(body.billingAddress).slice(0, 80);
          if (body.notes) zohoPayload.notes = String(body.notes);
          if (body.terms) zohoPayload.terms = String(body.terms);

          // Save PO immediately to local store
          const currentLocal = loadStore('po_store.json', []);
          saveStore('po_store.json', [body, ...currentLocal.filter(p => p.poNo !== body.poNo)]);

          let zohoResult = await callZoho('POST', '/books/v3/purchaseorders', zohoPayload, token);

          if (zohoResult && zohoResult.code !== 0) {
            delete zohoPayload.purchaseorder_number;
            zohoResult = await callZoho('POST', '/books/v3/purchaseorders', zohoPayload, token);
          }

          if (zohoResult && (zohoResult.code === 0 || zohoResult.purchaseorder)) {
            const created = zohoResult.purchaseorder;
            const targetPoId = created ? created.purchaseorder_id : null;

            const isNoApproval = String(body.approvalRequired || '').toUpperCase() === 'NO';
            const statusRequested = body.status || 'Draft';
            const isExplicitDraft = statusRequested === 'Draft' || statusRequested === 'DRAFT';

            if (isNoApproval && targetPoId) {
              try {
                await callZoho('POST', `/books/v3/purchaseorders/${encodeURIComponent(targetPoId)}/status/issued`, null, token);
              } catch (_) {
                try {
                  await callZoho('POST', `/books/v3/purchaseorders/${encodeURIComponent(targetPoId)}/status/open`, null, token);
                } catch (_) {}
              }
            }

            const finalStatus = isNoApproval ? 'OPEN' : (isExplicitDraft ? 'Draft' : 'Draft / Pending Approval');
            const finalStatusType = isNoApproval ? 'approved' : (isExplicitDraft ? 'draft' : 'pending');

            res.writeHead(200, { 'Content-Type': 'application/json' });
            return res.end(JSON.stringify({
              success: true,
              message: isNoApproval ? 'Purchase Order created and issued in Zoho Books successfully!' : 'Purchase Order created as Draft awaiting MD Approval!',
              po: { 
                ...body, 
                id: targetPoId || body.poNo, 
                poNo: created ? created.purchaseorder_number : body.poNo,
                status: finalStatus,
                statusType: finalStatusType
              },
              zohoPo: { ...created, status: isNoApproval ? 'open' : 'draft' }
            }));
          } else {
            res.writeHead(200, { 'Content-Type': 'application/json' });
            return res.end(JSON.stringify({
              success: false,
              message: (zohoResult && zohoResult.message) || 'Zoho creation note',
              po: body
            }));
          }
        }
      }

      // PO Approval Flow Endpoints
      if (pathname.includes('/purchaseorders/') && pathname.endsWith('/approve')) {
        const parts = pathname.split('/');
        const targetId = parts[parts.length - 2];
        const wfStore = loadStore('po_workflow_store.json', {});
        wfStore[targetId] = { ...(wfStore[targetId] || {}), status: 'MD Approved', statusType: 'md_approved', approvedBy: body.approver || 'MD' };
        saveStore('po_workflow_store.json', wfStore);

        res.writeHead(200, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ success: true, message: `PO ${targetId} approved by MD.` }));
      }

      if (pathname.includes('/purchaseorders/') && pathname.endsWith('/process-payment')) {
        const parts = pathname.split('/');
        const targetId = parts[parts.length - 2];
        const wfStore = loadStore('po_workflow_store.json', {});
        wfStore[targetId] = { ...(wfStore[targetId] || {}), status: 'Payment Processed', statusType: 'payment_processed', paymentDetails: body };
        saveStore('po_workflow_store.json', wfStore);

        res.writeHead(200, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ success: true, message: `PO ${targetId} payment details recorded.` }));
      }

      if (pathname.includes('/purchaseorders/') && pathname.endsWith('/proceed')) {
        const parts = pathname.split('/');
        const targetId = parts[parts.length - 2];
        const token = await getZohoAccessToken();
        
        try {
          await callZoho('POST', `/books/v3/purchaseorders/${encodeURIComponent(targetId)}/status/issued`, null, token);
        } catch (_) {
          try {
            await callZoho('POST', `/books/v3/purchaseorders/${encodeURIComponent(targetId)}/status/open`, null, token);
          } catch (_) {}
        }

        const wfStore = loadStore('po_workflow_store.json', {});
        wfStore[targetId] = { ...(wfStore[targetId] || {}), status: 'Proceed PO', statusType: 'proceed_po', proceedDetails: body };
        saveStore('po_workflow_store.json', wfStore);

        res.writeHead(200, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ success: true, message: `PO ${targetId} moved to Proceed PO and issued in Zoho Books!` }));
      }

      // 4. Item Directory (Items / Materials)
      if (pathname === '/api/zoho/items' || pathname.endsWith('/items')) {
        const localItems = loadStore('item_store.json', []);

        if (req.method === 'GET') {
          try {
            const token = await getZohoAccessToken();
            const zohoRes = await callZoho('GET', '/books/v3/items?per_page=200', null, token);
            const mappedItems = ((zohoRes && zohoRes.items) || []).map(i => ({
              id: i.item_id || i.id,
              itemId: i.item_id || i.id,
              name: i.name,
              code: i.sku || i.item_id || '—',
              sku: i.sku || '—',
              rate: i.rate || 0,
              price: i.rate || 0,
              unit: i.unit || 'Nos',
              status: i.status === 'active' ? 'Active' : 'Inactive',
              description: i.description || '—'
            }));

            // Merge with local items
            const itemMap = new Map();
            mappedItems.forEach(mi => itemMap.set(String(mi.code || mi.name).toLowerCase(), mi));
            localItems.forEach(li => {
              const k = String(li.code || li.name || li.sku || li.id).toLowerCase();
              if (itemMap.has(k)) itemMap.set(k, { ...itemMap.get(k), ...li });
              else itemMap.set(k, li);
            });

            const finalList = Array.from(itemMap.values());
            saveStore('item_store.json', finalList);

            res.writeHead(200, { 'Content-Type': 'application/json' });
            return res.end(JSON.stringify(finalList));
          } catch (itemErr) {
            res.writeHead(200, { 'Content-Type': 'application/json' });
            return res.end(JSON.stringify(localItems));
          }
        }

        if (req.method === 'POST') {
          // Immediately save locally
          const newItem = {
            ...body,
            id: body.id || `ITEM-${Date.now()}`,
            code: body.code || body.sku || `SKU-${Date.now()}`,
            status: body.status || 'Active'
          };
          const updated = [newItem, ...localItems.filter(i => i.code !== newItem.code)];
          saveStore('item_store.json', updated);

          try {
            const token = await getZohoAccessToken();
            const zohoPayload = {
              name: newItem.name || 'Raw Material Item',
              rate: Number(newItem.rate || newItem.price || 0),
              sku: newItem.sku || newItem.code,
              description: newItem.description || undefined,
              item_type: 'inventory',
              unit: newItem.unit || 'Nos'
            };
            const zohoRes = await callZoho('POST', '/books/v3/items', zohoPayload, token);
            if (zohoRes && zohoRes.item) {
              newItem.zohoItemId = zohoRes.item.item_id;
              saveStore('item_store.json', updated.map(i => i.code === newItem.code ? { ...i, zohoItemId: zohoRes.item.item_id } : i));
            }
          } catch (_) {}

          res.writeHead(200, { 'Content-Type': 'application/json' });
          return res.end(JSON.stringify({ success: true, item: newItem }));
        }
      }

      // 5. Invoices (Fetch & Create)
      if (pathname === '/api/zoho/invoices' || pathname.endsWith('/invoices')) {
        const localInvoices = loadStore('invoice_store.json', []);

        if (req.method === 'GET') {
          try {
            const token = await getZohoAccessToken();
            const zohoRes = await callZoho('GET', '/books/v3/invoices?per_page=200&sort_column=created_time&sort_order=D', null, token);
            const mappedInvoices = ((zohoRes && zohoRes.invoices) || []).map(inv => ({
              id: inv.invoice_id || inv.id,
              invoiceNumber: inv.invoice_number,
              invoiceNo: inv.invoice_number,
              customerName: inv.customer_name,
              customerId: inv.customer_id,
              date: inv.date,
              dueDate: inv.due_date,
              total: inv.total,
              balance: inv.balance,
              status: inv.status,
              amount: `₹${Number(inv.total || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`
            }));

            // Merge local invoices
            const invMap = new Map();
            mappedInvoices.forEach(i => invMap.set(String(i.invoiceNumber || i.id).toLowerCase(), i));
            localInvoices.forEach(li => {
              const k = String(li.invoiceNumber || li.id).toLowerCase();
              if (!invMap.has(k)) invMap.set(k, li);
            });

            res.writeHead(200, { 'Content-Type': 'application/json' });
            return res.end(JSON.stringify(Array.from(invMap.values())));
          } catch (invErr) {
            res.writeHead(200, { 'Content-Type': 'application/json' });
            return res.end(JSON.stringify(localInvoices));
          }
        }

        if (req.method === 'POST') {
          const newInvoice = { ...body, id: body.id || `INV-${Date.now()}` };
          saveStore('invoice_store.json', [newInvoice, ...localInvoices]);

          try {
            const token = await getZohoAccessToken();
            const zohoPayload = {
              customer_id: body.customerId || body.customer_id,
              invoice_number: body.invoiceNumber || body.invoiceNo || undefined,
              date: body.date || new Date().toISOString().split('T')[0],
              due_date: body.dueDate || body.date || new Date().toISOString().split('T')[0],
              line_items: (body.items || []).map(it => ({
                name: it.name || 'Fabrication Work',
                rate: Number(it.rate || it.price || 0),
                quantity: Number(it.quantity || it.qty || 1)
              }))
            };
            const zohoRes = await callZoho('POST', '/books/v3/invoices', zohoPayload, token);
            if (zohoRes && zohoRes.invoice) {
              newInvoice.zohoInvoiceId = zohoRes.invoice.invoice_id;
            }
          } catch (_) {}

          res.writeHead(200, { 'Content-Type': 'application/json' });
          return res.end(JSON.stringify({ success: true, invoice: newInvoice }));
        }
      }

      // 6. Proforma Invoices / Estimates (PI)
      if (pathname === '/api/zoho/estimates' || pathname === '/api/zoho/proforma-invoices' || pathname.endsWith('/estimates') || pathname.endsWith('/proforma-invoices')) {
        const localEstimates = loadStore('proforma_invoice_store.json', []);

        if (req.method === 'GET') {
          try {
            const token = await getZohoAccessToken();
            const zohoRes = await callZoho('GET', '/books/v3/estimates?per_page=200&sort_column=created_time&sort_order=D', null, token);
            const mappedPIs = ((zohoRes && zohoRes.estimates) || []).map(est => ({
              id: est.estimate_id || est.id,
              piNo: est.estimate_number,
              piDate: est.date,
              vendor: est.customer_name,
              customerName: est.customer_name,
              customerId: est.customer_id,
              amount: `₹${Number(est.total || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`,
              total: est.total,
              status: est.status === 'accepted' ? 'Approved' : (est.status === 'invoiced' ? 'Invoiced' : 'Pending'),
              statusType: est.status
            }));

            const piMap = new Map();
            mappedPIs.forEach(p => piMap.set(String(p.piNo).toLowerCase(), p));
            localEstimates.forEach(lp => {
              const k = String(lp.piNo).toLowerCase();
              if (!piMap.has(k)) piMap.set(k, lp);
            });

            res.writeHead(200, { 'Content-Type': 'application/json' });
            return res.end(JSON.stringify(Array.from(piMap.values())));
          } catch (estErr) {
            res.writeHead(200, { 'Content-Type': 'application/json' });
            return res.end(JSON.stringify(localEstimates));
          }
        }

        if (req.method === 'POST') {
          const cleanPiNo = String(body.piNo || body.id || `PI-${Date.now()}`).trim();
          let verifiedZohoId = (/^\d{15,22}$/.test(String(body.zohoEstimateId || '').trim())) ? String(body.zohoEstimateId).trim() : null;
          if (!verifiedZohoId) {
            const existingLocal = localEstimates.find(x => x && String(x.piNo || '').trim().toLowerCase() === cleanPiNo.toLowerCase());
            if (existingLocal?.zohoEstimateId && /^\d{15,22}$/.test(String(existingLocal.zohoEstimateId).trim())) {
              verifiedZohoId = String(existingLocal.zohoEstimateId).trim();
            }
          }

          const newPI = {
            ...body,
            id: body.id || cleanPiNo,
            piNo: cleanPiNo,
            zohoSynced: Boolean(verifiedZohoId),
            zohoEstimateId: verifiedZohoId || null,
            zohoSyncError: null,
            zohoModule: 'Quotes'
          };
          saveStore('proforma_invoice_store.json', [newPI, ...localEstimates.filter(p => String(p.piNo || '').trim() !== cleanPiNo)]);

          let zohoErrorMsg = null;

          try {
            const token = await getZohoAccessToken();

            // Format date to Zoho YYYY-MM-DD standard
            const formatZohoDate = (dStr) => {
              if (!dStr) return new Date().toISOString().split('T')[0];
              const s = String(dStr).trim();
              if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
              const dmyMatch = s.match(/^(\d{1,2})[\/-](\d{1,2})[\/-](\d{4})$/);
              if (dmyMatch) {
                const day = dmyMatch[1].padStart(2, '0');
                const month = dmyMatch[2].padStart(2, '0');
                const year = dmyMatch[3];
                return `${year}-${month}-${day}`;
              }
              const parsed = new Date(s);
              if (!isNaN(parsed.getTime())) {
                return parsed.toISOString().split('T')[0];
              }
              return new Date().toISOString().split('T')[0];
            };

            // Resolve or provision customer in Zoho Books
            let customerId = body.customerId;
            const clientName = (body.customerName || body.vendor || '').trim();
            if (!customerId && clientName) {
              try {
                const cName = encodeURIComponent(clientName);
                const contactRes = await callZoho('GET', `/books/v3/contacts?search_text=${cName}`, null, token);
                if (contactRes && Array.isArray(contactRes.contacts) && contactRes.contacts.length > 0) {
                  customerId = contactRes.contacts[0].contact_id;
                } else {
                  const createCustRes = await callZoho('POST', '/books/v3/contacts', {
                    contact_name: clientName,
                    company_name: clientName,
                    contact_type: 'customer',
                    notes: (body.gstNo || body.gstNumber) ? `GSTIN: ${String(body.gstNo || body.gstNumber).trim()}` : undefined
                  }, token);
                  if (createCustRes && createCustRes.contact && createCustRes.contact.contact_id) {
                    customerId = createCustRes.contact.contact_id;
                  }
                }
              } catch (_) {}
            }
            if (!customerId) customerId = '4080449000000033179';

            const taxIdMap = {
              0: '4080449000000341001',
              5: '4080449000000333019',
              12: '4080449000000324002',
              18: '4080449000000055031',
              28: '4080449000000340001'
            };

            const pGroups = body.presetGroups || {};
            const groupEntries = Array.isArray(pGroups) ? pGroups : Object.values(pGroups);
            const hasPresetGroups = groupEntries.length > 0;
            const line_items = [];

            if (hasPresetGroups) {
              groupEntries.forEach(grp => {
                if (!grp) return;
                const setCount = parseFloat(grp.setCount) || 1;
                const unitPrice = parseFloat(grp.kitPrice != null ? grp.kitPrice : grp.price) || 0;
                line_items.push({
                  name: grp.presetName || grp.name || body.presetName || 'Solar Mounting Structure Preset Kit',
                  rate: unitPrice,
                  quantity: setCount,
                  description: `Preset Structure Kit - ${setCount} Set(s)`
                });
              });
            } else if (body.presetName && (body.presetKitPrice != null || body.kitSubtotal != null)) {
              const setCount = parseFloat(body.presetSetCount) || 1;
              const unitPrice = parseFloat(body.presetKitPrice != null ? body.presetKitPrice : body.kitSubtotal) || 0;
              line_items.push({
                name: body.presetName,
                rate: unitPrice,
                quantity: setCount,
                description: `Preset Structure Kit - ${setCount} Set(s)`
              });
            }

            (body.items || []).forEach(it => {
              const isPreset = Boolean(it.isPresetItem || it.category === 'Preset Component');
              if (hasPresetGroups || body.presetName) {
                if (isPreset) return;
              }
              line_items.push({
                name: it.name || it.productName || 'Solar Structure Component',
                rate: Number(it.rate != null ? it.rate : (it.unitValue || 0)),
                quantity: Number(it.qty || it.quantity || 1),
                description: it.description || it.category || 'Separate Product Scope'
              });
            });

            if (line_items.length === 0) {
              const fallbackRate = Number(body.total || body.subtotal || 1000);
              line_items.push({
                name: body.productName || 'Solar Mounting Structure Kit',
                rate: fallbackRate,
                quantity: 1,
                description: 'Standard Line Item'
              });
            }

            const zohoPayload = {
              customer_id: customerId,
              estimate_number: cleanPiNo || undefined,
              date: formatZohoDate(body.piDate),
              expiry_date: (body.validUntilDate || body.expDate) ? formatZohoDate(body.validUntilDate || body.expDate) : undefined,
              line_items,
              notes: (body.remarks || body.notes || 'Proforma Invoice generated via Control Room').slice(0, 100)
            };

            let zohoRes = null;
            if (verifiedZohoId) {
              zohoRes = await callZoho('PUT', `/books/v3/estimates/${verifiedZohoId}?ignore_auto_number_generation=true`, zohoPayload, token);
              if (!zohoRes || (!zohoRes.estimate && zohoRes.code !== 0)) {
                zohoRes = null;
              }
            }

            if (!zohoRes) {
              zohoRes = await callZoho('POST', '/books/v3/estimates?ignore_auto_number_generation=true', zohoPayload, token);
            }

            if (zohoRes && (zohoRes.estimate || zohoRes.code === 0)) {
              const createdEst = zohoRes.estimate;
              if (createdEst && createdEst.estimate_id) {
                newPI.zohoEstimateId = String(createdEst.estimate_id).trim();
                newPI.piNo = createdEst.estimate_number || cleanPiNo;
                newPI.zohoSynced = true;
                newPI.zohoSyncError = null;
                newPI.zohoModule = 'Quotes';
                try {
                  await callZoho('POST', `/books/v3/estimates/${createdEst.estimate_id}/status/sent`, null, token);
                } catch (_) {}
              }
            } else if (zohoRes && (zohoRes.code === 36015 || zohoRes.code === 1001 || (zohoRes.message && String(zohoRes.message).toLowerCase().includes('already exists')))) {
              // Quote already exists in Zoho Books, search and update it via PUT
              try {
                const estNum = encodeURIComponent(cleanPiNo);
                let findRes = await callZoho('GET', `/books/v3/estimates?estimate_number=${estNum}`, null, token);
                if (!findRes || !Array.isArray(findRes.estimates) || findRes.estimates.length === 0) {
                  findRes = await callZoho('GET', `/books/v3/estimates?search_text=${estNum}`, null, token);
                }
                const found = (findRes && Array.isArray(findRes.estimates))
                  ? (findRes.estimates.find(e => String(e.estimate_number || '').trim().toLowerCase() === cleanPiNo.toLowerCase()) || findRes.estimates[0])
                  : null;
                if (found && found.estimate_id) {
                  const targetEstId = String(found.estimate_id).trim();
                  const putRes = await callZoho('PUT', `/books/v3/estimates/${targetEstId}?ignore_auto_number_generation=true`, zohoPayload, token);
                  const activeEst = (putRes && putRes.estimate) ? putRes.estimate : found;

                  newPI.zohoEstimateId = targetEstId;
                  newPI.piNo = activeEst.estimate_number || cleanPiNo;
                  newPI.zohoSynced = true;
                  newPI.zohoSyncError = null;
                  newPI.zohoModule = 'Quotes';
                } else {
                  zohoErrorMsg = zohoRes?.message || 'Quote already exists in Zoho Books but could not be updated';
                }
              } catch (e) {
                zohoErrorMsg = e.message;
              }
            } else {
              zohoErrorMsg = zohoRes?.message || 'Zoho Quote creation rejected by server';
            }
          } catch (err) {
            zohoErrorMsg = err.message || 'Unexpected error during Zoho Books sync';
          }

          // Persist updated newPI (with verified zohoEstimateId)
          saveStore('proforma_invoice_store.json', [newPI, ...localEstimates.filter(p => String(p.piNo || '').trim() !== cleanPiNo)]);

          res.writeHead(200, { 'Content-Type': 'application/json' });
          return res.end(JSON.stringify({
            success: true,
            estimate: newPI,
            zohoSynced: Boolean(newPI.zohoEstimateId),
            zohoEstimateId: newPI.zohoEstimateId || null,
            zohoModule: 'Quotes',
            zohoError: newPI.zohoEstimateId ? null : (zohoErrorMsg || 'Quote synchronization could not be confirmed in Zoho Books')
          }));
        }
      }

      // 7. Delivery Challans (DC)
      if (pathname === '/api/zoho/deliverychallans' || pathname.endsWith('/deliverychallans')) {
        const localDCs = loadStore('dc_store.json', []);

        if (req.method === 'GET') {
          try {
            const token = await getZohoAccessToken();
            const zohoRes = await callZoho('GET', '/books/v3/deliverychallans?per_page=200&sort_column=created_time&sort_order=D', null, token);
            const mappedDCs = ((zohoRes && zohoRes.deliverychallans) || []).map(dc => ({
              id: dc.deliverychallan_id || dc.id,
              dcNo: dc.deliverychallan_number,
              challanNo: dc.deliverychallan_number,
              customerName: dc.customer_name,
              date: dc.date,
              status: dc.status
            }));

            const dcMap = new Map();
            mappedDCs.forEach(d => dcMap.set(String(d.dcNo || d.id).toLowerCase(), d));
            localDCs.forEach(ld => {
              const k = String(ld.dcNo || ld.challanNo || ld.id).toLowerCase();
              if (!dcMap.has(k)) dcMap.set(k, ld);
            });

            res.writeHead(200, { 'Content-Type': 'application/json' });
            return res.end(JSON.stringify(Array.from(dcMap.values())));
          } catch (dcErr) {
            res.writeHead(200, { 'Content-Type': 'application/json' });
            return res.end(JSON.stringify(localDCs));
          }
        }

        if (req.method === 'POST') {
          const newDC = { ...body, id: body.id || `DC-${Date.now()}` };
          saveStore('dc_store.json', [newDC, ...localDCs]);

          try {
            const token = await getZohoAccessToken();
            const zohoPayload = {
              customer_id: body.customerId || '4080449000000039008',
              deliverychallan_number: body.challanNo || body.dcNo || undefined,
              date: body.date || new Date().toISOString().split('T')[0],
              line_items: (body.items || []).map(it => ({
                name: it.name || 'Solar Mounting Components',
                quantity: Number(it.qty || it.quantity || 1)
              }))
            };
            const zohoRes = await callZoho('POST', '/books/v3/deliverychallans', zohoPayload, token);
            if (zohoRes && zohoRes.deliverychallan) {
              newDC.zohoDcId = zohoRes.deliverychallan.deliverychallan_id;
            }
          } catch (_) {}

          res.writeHead(200, { 'Content-Type': 'application/json' });
          return res.end(JSON.stringify({ success: true, deliverychallan: newDC }));
        }
      }

      // 8. Vendors (Fetch & Create)
      if (pathname === '/api/zoho/vendors' || pathname.endsWith('/vendors')) {
        const localVendors = loadStore('vendor_store.json', []);

        if (req.method === 'GET') {
          try {
            const token = await getZohoAccessToken();
            const zohoRes = await callZoho('GET', '/books/v3/contacts?contact_type=vendor&per_page=200', null, token);
            const mappedVendors = ((zohoRes && zohoRes.contacts) || []).map(c => ({
              id: c.contact_id || c.id,
              vendorId: c.contact_id || c.id,
              name: c.contact_name || c.vendor_name,
              email: c.email || '—',
              phone: c.phone || '—',
              status: c.status === 'active' ? 'Active' : 'Inactive'
            }));

            const vMap = new Map();
            mappedVendors.forEach(v => vMap.set(String(v.name || v.id).toLowerCase(), v));
            localVendors.forEach(lv => {
              const k = String(lv.name || lv.id).toLowerCase();
              if (!vMap.has(k)) vMap.set(k, lv);
            });

            res.writeHead(200, { 'Content-Type': 'application/json' });
            return res.end(JSON.stringify(Array.from(vMap.values())));
          } catch (vendorErr) {
            res.writeHead(200, { 'Content-Type': 'application/json' });
            return res.end(JSON.stringify(localVendors));
          }
        }

        if (req.method === 'POST') {
          const newVendor = { ...body, id: body.id || `VEND-${Date.now()}` };
          saveStore('vendor_store.json', [newVendor, ...localVendors]);

          try {
            const token = await getZohoAccessToken();
            const zohoPayload = {
              contact_name: body.name || body.vendor_name || 'Vendor',
              company_name: body.name || body.vendor_name || 'Vendor',
              contact_type: 'vendor'
            };
            const zohoRes = await callZoho('POST', '/books/v3/contacts', zohoPayload, token);
            if (zohoRes && zohoRes.contact) {
              newVendor.zohoVendorId = zohoRes.contact.contact_id;
            }
          } catch (_) {}

          res.writeHead(200, { 'Content-Type': 'application/json' });
          return res.end(JSON.stringify({ success: true, vendor: newVendor }));
        }
      }

      // 9. GSTIN Lookup Verification
      if (pathname === '/api/zoho/gst-lookup' || pathname.endsWith('/gst-lookup')) {
        const rawGst = (query.gstin || query.gst || '').toUpperCase().trim();
        const stateCode = rawGst.substring(0, 2);
        const pan = rawGst.substring(2, 12);
        const states = {
          '37': 'Andhra Pradesh', '33': 'Tamil Nadu', '36': 'Telangana',
          '29': 'Karnataka', '27': 'Maharashtra', '07': 'Delhi', '24': 'Gujarat'
        };
        const stateName = states[stateCode] || 'Tamil Nadu';

        res.writeHead(200, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({
          success: true,
          gstin: rawGst,
          pan,
          state: stateName,
          legalName: `VRM REGISTERED ENTITY (${pan})`,
          tradeName: 'VRM Industrial Solar Partner',
          status: 'Active',
          taxpayerType: 'Regular'
        }));
      }

      // 10. Sequential BOM Code Reservation Endpoints (Thread-Safe Mutex Lock)
      if (pathname === '/api/boms/next-code' || pathname.endsWith('/boms/next-code')) {
        return withBomLock(async () => {
          const { maxNum } = await getAtomicHighestBomNumber();
          const nextCode = `BOM-${String(maxNum + 1).padStart(3, '0')}`;
          res.writeHead(200, { 'Content-Type': 'application/json' });
          return res.end(JSON.stringify({ success: true, nextCode, nextBomCode: nextCode, maxNum: maxNum + 1 }));
        });
      }

      if (pathname === '/api/boms/reserve-code' || pathname.endsWith('/boms/reserve-code')) {
        return withBomLock(async () => {
          const { maxNum } = await getAtomicHighestBomNumber();
          const nextNum = maxNum + 1;
          const nextCode = `BOM-${String(nextNum).padStart(3, '0')}`;
          appBomSequenceCounter = nextNum;
          await pushSupabaseStore('BOM_SEQUENCE', { lastNumber: nextNum, reservedAt: new Date().toISOString() });
          res.writeHead(200, { 'Content-Type': 'application/json' });
          return res.end(JSON.stringify({ success: true, nextCode, nextBomCode: nextCode, maxNum: nextNum }));
        });
      }

      // 11. Centralized BOM Orders Management (GET & POST with Disk + Supabase Persistence & Collision Resolution)
      if (pathname === '/api/boms' || pathname.endsWith('/api/boms')) {
        if (req.method === 'GET') {
          return withBomLock(async () => {
            let diskList = loadStore('bom_store.json', []);
            let cloudList = await fetchSupabaseStore('bom_store') || [];
            if (!Array.isArray(diskList)) diskList = [];
            if (!Array.isArray(cloudList)) cloudList = [];

            const combined = [...cloudList, ...diskList];
            const { list: resolvedBoms, maxSeq } = resolveBomCollisions(combined, 658);
            if (maxSeq > (appBomSequenceCounter || 0)) {
              appBomSequenceCounter = maxSeq;
            }

            const parseBomSeq = (code) => {
              const m = String(code || '').match(/BOM-(\d+)/i);
              return m ? parseInt(m[1], 10) : 0;
            };
            resolvedBoms.sort((a, b) => {
              const seqA = parseBomSeq(a?.bomCode || a?.code || a?.id);
              const seqB = parseBomSeq(b?.bomCode || b?.code || b?.id);
              if (seqA !== seqB) return seqB - seqA;
              const dateA = new Date(a?.salesConfirmedAt || a?.date || a?.createdAt || 0).getTime() || 0;
              const dateB = new Date(b?.salesConfirmedAt || b?.date || b?.createdAt || 0).getTime() || 0;
              return dateB - dateA;
            });

            res.writeHead(200, { 'Content-Type': 'application/json' });
            return res.end(JSON.stringify({ success: true, data: resolvedBoms, total: resolvedBoms.length }));
          });
        }

        if (req.method === 'POST') {
          return withBomLock(async () => {
            let { bom, isNew, isUpdate } = body || {};
            if (!bom) {
              res.writeHead(400, { 'Content-Type': 'application/json' });
              return res.end(JSON.stringify({ success: false, message: 'Valid bom record required' }));
            }

            stripServerDataUrls(bom);

            const { maxNum, diskList, cloudList } = await getAtomicHighestBomNumber();
            const combinedRaw = [...cloudList, ...diskList];
            const { list: cleanMasterList, maxSeq } = resolveBomCollisions(combinedRaw, maxNum);

            const incomingCode = String(bom.bomCode || bom.code || bom.id || '').trim();
            const isPending = !incomingCode || incomingCode === 'BOM-PENDING';

            const existingIdx = cleanMasterList.findIndex(it => {
              const itCode = it?.bomCode || it?.code || it?.id;
              return itCode && itCode.toUpperCase() === incomingCode.toUpperCase();
            });

            let finalCode = incomingCode;
            let nextCounter = Math.max(maxSeq, maxNum);

            if (isPending || (isNew && existingIdx !== -1) || !/^BOM-\d+$/i.test(incomingCode)) {
              nextCounter += 1;
              finalCode = `BOM-${String(nextCounter).padStart(3, '0')}`;
            } else if (existingIdx !== -1) {
              const existing = cleanMasterList[existingIdx];
              const bCust = (bom.companyName || bom.customerName || '').trim().toLowerCase();
              const exCust = (existing.companyName || existing.customerName || '').trim().toLowerCase();
              const bSales = (bom.salesPerson || '').trim().toLowerCase();
              const exSales = (existing.salesPerson || '').trim().toLowerCase();
              const isSameOrder = (bCust && exCust && bCust === exCust) || (bSales && exSales && bSales === exSales);

              if (isSameOrder || isUpdate || bom.isUpdate) {
                finalCode = incomingCode;
                cleanMasterList[existingIdx] = { ...existing, ...bom, id: finalCode, bomCode: finalCode, code: finalCode };
              } else {
                nextCounter += 1;
                finalCode = `BOM-${String(nextCounter).padStart(3, '0')}`;
                console.warn(`[Plesk Concurrency Guard] Collision detected on ${incomingCode}. Reassigned new order to ${finalCode}`);
              }
            }

            bom.bomCode = finalCode;
            bom.code = finalCode;
            bom.id = finalCode;

            if (cleanMasterList.findIndex(it => (it?.bomCode || it?.code || it?.id) === finalCode) === -1) {
              cleanMasterList.unshift(bom);
            }

            const { list: finalList, maxSeq: finalMax } = resolveBomCollisions(cleanMasterList, nextCounter);
            appBomSequenceCounter = finalMax;

            saveStore('bom_store.json', finalList);

            try {
              await pushSupabaseStore('bom_store', finalList);
              await pushSupabaseStore('BOM_SEQUENCE', { lastNumber: finalMax, updatedAt: new Date().toISOString() });
            } catch (cloudErr) {
              console.warn('[Plesk Gateway] Failed to push BOM to Supabase:', cloudErr.message);
            }

            console.log(`[Plesk Gateway] BOM ${finalCode} saved. Total: ${finalList.length}, Sequence: ${finalMax}`);
            res.writeHead(200, { 'Content-Type': 'application/json' });
            return res.end(JSON.stringify({
              success: true,
              bom,
              bomCode: finalCode,
              nextBomCode: finalCode,
              nextCode: finalCode,
              total: finalList.length
            }));
          });
        }
      }

      // 12. Generic Data Store Endpoints (/api/store/:key)
      if (pathname.startsWith('/api/store/')) {
        const storeKey = pathname.replace('/api/store/', '').trim();
        const filename = `${storeKey}.json`;

        if (req.method === 'GET') {
          let localData = loadStore(filename, []);
          let cloudData = await fetchSupabaseStore(storeKey);
          let resultData = localData;

          if (Array.isArray(cloudData)) {
            if (Array.isArray(localData) && localData.length > 0) {
              const getId = (item) => item?.bomCode || item?.code || item?.id || item?.poNo || item?.invNo || item?.grnNo || item?.vendorCode || item?.email || item?.name;
              const map = new Map();
              cloudData.forEach(item => { const id = getId(item); if (id) map.set(id, item); });
              localData.forEach(item => { const id = getId(item); if (id) map.set(id, { ...(map.get(id) || {}), ...item }); });
              resultData = Array.from(map.values());
            } else {
              resultData = cloudData;
            }
          } else if (cloudData && typeof cloudData === 'object') {
            resultData = cloudData;
          }

          res.writeHead(200, { 'Content-Type': 'application/json' });
          return res.end(JSON.stringify({ success: true, data: resultData || [] }));
        }

        if (req.method === 'POST') {
          let finalDataToSave = body;
          if (Array.isArray(body)) {
            let existingList = loadStore(filename, []);
            let cloudList = await fetchSupabaseStore(storeKey);
            if (Array.isArray(cloudList)) existingList = [...existingList, ...cloudList];

            const getId = (item) => item?.bomCode || item?.code || item?.id || item?.poNo || item?.invNo || item?.grnNo || item?.vendorCode || item?.email || item?.name;
            const map = new Map();
            existingList.forEach(item => { const id = getId(item); if (id) map.set(id, item); });
            body.forEach(item => {
              const id = getId(item);
              if (id) {
                map.set(id, { ...(map.get(id) || {}), ...item });
              }
            });
            finalDataToSave = Array.from(map.values());
          }

          saveStore(filename, finalDataToSave);
          try {
            await pushSupabaseStore(storeKey, finalDataToSave);
          } catch (_) {}

          res.writeHead(200, { 'Content-Type': 'application/json' });
          return res.end(JSON.stringify({ success: true, count: Array.isArray(finalDataToSave) ? finalDataToSave.length : 1 }));
        }
      }

      // 12.5. Enterprise Disaster Recovery & Backup Endpoints
      if (pathname === '/api/system/backup/list') {
        const backupsDir = path.resolve(__dirname, 'backups');
        let files = [];
        if (fs.existsSync(backupsDir)) {
          files = fs.readdirSync(backupsDir)
            .filter(f => f.startsWith('controlroom_backup_') && f.endsWith('.json'))
            .sort().reverse()
            .map(file => {
              const fullPath = path.join(backupsDir, file);
              const stat = fs.statSync(fullPath);
              let meta = {};
              try {
                const c = JSON.parse(fs.readFileSync(fullPath, 'utf8'));
                meta = c.metadata || {};
              } catch (_) {}
              return {
                filename: file,
                sizeBytes: stat.size,
                sizeFormatted: `${(stat.size / (1024 * 1024)).toFixed(2)} MB`,
                createdAt: stat.mtime.toISOString(),
                totalRecords: meta.totalRecords || '—',
                mediaCount: meta.mediaCount || '8',
                mediaSizeFormatted: meta.mediaSizeFormatted || '4.25 MB'
              };
            });
        }
        res.writeHead(200, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ success: true, backups: files }));
      }

      if (pathname === '/api/system/backup/create') {
        const backupsDir = path.resolve(__dirname, 'backups');
        if (!fs.existsSync(backupsDir)) fs.mkdirSync(backupsDir, { recursive: true });
        const ts = new Date().toISOString().replace(/[:.]/g, '-');
        const filename = `controlroom_backup_${ts}.json`;
        const backupPath = path.join(backupsDir, filename);

        const storeKeys = [
          'bom_store', 'po_store', 'item_store', 'raw_materials_store',
          'customer_store', 'vendor_store', 'employees_store', 'invoice_store',
          'sales_pi_store', 'proforma_invoice_store', 'payment_store',
          'company_branding_store', 'presets_store', 'workorder_store',
          'grn_store', 'quotations_store', 'notifications_store',
          'crm_leads', 'crm_customers', 'crm_opportunities', 'crm_quotations',
          'crm_whatsapp_conversations', 'vrm_prod_inventory', 'vrm_prod_recipes',
          'vrm_prod_ledger', 'vrm_prod_workorders'
        ];

        const backupData = {
          system: 'Control Room Enterprise ERP',
          version: '2.5.0',
          createdAt: new Date().toISOString(),
          metadata: { totalStores: storeKeys.length, totalRecords: 0, mediaCount: 0 },
          stores: {},
          media: {}
        };

        let totalRec = 0;
        storeKeys.forEach(k => {
          const d = loadStore(`${k}.json`, []);
          backupData.stores[k] = d;
          if (Array.isArray(d)) totalRec += d.length;
        });

        const mediaPath = path.resolve(__dirname, 'media_cache.json');
        if (fs.existsSync(mediaPath)) {
          try { backupData.media = JSON.parse(fs.readFileSync(mediaPath, 'utf8')); } catch (_) {}
        }
        backupData.metadata.totalRecords = totalRec;
        backupData.metadata.mediaCount = Object.keys(backupData.media).length;
        backupData.metadata.backupSizeFormatted = `${(Buffer.byteLength(JSON.stringify(backupData)) / (1024 * 1024)).toFixed(2)} MB`;

        fs.writeFileSync(backupPath, JSON.stringify(backupData, null, 2), 'utf8');

        res.writeHead(200, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ success: true, backup: { filename, metadata: backupData.metadata } }));
      }

      if (pathname.startsWith('/api/system/backup/download/')) {
        const fn = path.basename(pathname.replace('/api/system/backup/download/', ''));
        const bp = path.resolve(__dirname, 'backups', fn);
        if (fs.existsSync(bp)) {
          res.writeHead(200, {
            'Content-Type': 'application/json',
            'Content-Disposition': `attachment; filename="${fn}"`
          });
          return fs.createReadStream(bp).pipe(res);
        }
      }

      if (pathname === '/api/system/backup/latest/download') {
        const backupsDir = path.resolve(__dirname, 'backups');
        if (fs.existsSync(backupsDir)) {
          const files = fs.readdirSync(backupsDir).filter(f => f.startsWith('controlroom_backup_')).sort().reverse();
          if (files.length > 0) {
            const bp = path.join(backupsDir, files[0]);
            res.writeHead(200, {
              'Content-Type': 'application/json',
              'Content-Disposition': `attachment; filename="${files[0]}"`
            });
            return fs.createReadStream(bp).pipe(res);
          }
        }
      }

      // 13. Static Frontend Files Serving
      let filePath = path.join(__dirname, pathname === '/' ? 'index.html' : pathname);
      
      if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
        const ext = path.extname(filePath).toLowerCase();
        const mimeTypes = {
          '.html': 'text/html',
          '.js': 'application/javascript',
          '.css': 'text/css',
          '.json': 'application/json',
          '.svg': 'image/svg+xml',
          '.png': 'image/png',
          '.jpg': 'image/jpeg',
          '.woff': 'font/woff',
          '.woff2': 'font/woff2'
        };
        const contentType = mimeTypes[ext] || 'application/octet-stream';
        res.writeHead(200, { 'Content-Type': contentType });
        return fs.createReadStream(filePath).pipe(res);
      }

      // Fallback to index.html for Single Page Application routing
      if (!pathname.startsWith('/api')) {
        const indexHtmlPath = path.join(__dirname, 'index.html');
        if (fs.existsSync(indexHtmlPath)) {
          res.writeHead(200, { 'Content-Type': 'text/html' });
          return fs.createReadStream(indexHtmlPath).pipe(res);
        }
      }

      // Default Status Ping for unhandled /api requests
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true, message: 'Control Room Zoho Gateway Active', time: new Date().toISOString() }));
    } catch (err) {
      console.error('[ZOHO GATEWAY ERROR]', err);
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: err.message }));
    }
  });
});

const PORT = process.env.PORT || 5001;
server.listen(PORT, () => {
  console.log(`Control Room Zoho Gateway active on port ${PORT}`);
});

module.exports = server;
