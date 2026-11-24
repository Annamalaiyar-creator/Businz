import { Router } from 'express';
import fs from 'fs';
import path from 'path';
import { getStoreFilePath } from '../runtimePaths.js';

export default function createEstimateRouter(dependencies) {
  const router = Router();
  const {
    loadDatabaseProformaInvoices,
    saveProformaInvoiceToDatabase,
    saveDatabaseStore,
    broadcastRealtimeEvent,
    getZohoConfigInfo,
    getZohoAuthStats,
    updateZohoConfig,
    testZohoConnection,
    exchangeAuthorizationCode,
    pushPiToZoho,
    updatePiZohoSyncStatus,
    cancelProformaInvoiceInDatabase,
    deleteProformaInvoiceFromDatabase,
    toConsumerPi,
    query,
    pool,
    supabaseMemoryStore
  } = dependencies;

  router.get(['/api/estimates', '/api/proforma-invoices'], async (req, res) => {
    let combinedEstimates = [];
    const existingMap = new Map();

    // 1. Authoritative primary source: PostgreSQL public.proforma_invoices
    try {
      const databasePis = await loadDatabaseProformaInvoices();
      if (Array.isArray(databasePis) && databasePis.length > 0) {
        databasePis.forEach(p => {
          if (p && p.piNo) {
            existingMap.set(String(p.piNo).trim().toLowerCase(), p);
            combinedEstimates.push(p);
          }
        });
      }
    } catch (err) {
      console.warn('[PI Database Read Notice]:', err.message);
    }

    // 2. Safely merge any disk PIs that are not yet in the relational database
    const p1 = getStoreFilePath('proforma_invoice_store.json');
    const p2 = getStoreFilePath('sales_pi_store.json');

    const checkAndMerge = (filePath) => {
      try {
        if (fs.existsSync(filePath)) {
          const raw = fs.readFileSync(filePath, 'utf8');
          const list = JSON.parse(raw);
          if (Array.isArray(list)) {
            for (const item of list) {
              if (item && item.piNo) {
                const k = String(item.piNo).trim().toLowerCase();
                if (!existingMap.has(k)) {
                  existingMap.set(k, item);
                  combinedEstimates.push(item);
                } else {
                  const existing = existingMap.get(k);
                  if (item.assignedSalespersonCode || item.assignedSalesperson) {
                    existing.assignedSalespersonCode = item.assignedSalespersonCode || existing.assignedSalespersonCode;
                    existing.assignedSalesperson = item.assignedSalesperson || existing.assignedSalesperson;
                    existing.assignedToId = item.assignedToId || item.assignedSalespersonCode || existing.assignedToId;
                    existing.assignedToName = item.assignedToName || item.assignedSalesperson || existing.assignedToName;
                    existing.salesPersonCode = item.salesPersonCode || existing.salesPersonCode;
                    existing.salesPerson = item.salesPerson || existing.salesPerson;
                    existing.salesperson = item.salesperson || existing.salesperson;
                  }
                }
              }
            }
          }
        }
      } catch (_) {}
    };

    checkAndMerge(p1);
    checkAndMerge(p2);

    if (combinedEstimates.length === 0 && Array.isArray(supabaseMemoryStore['proforma_invoice_store']) && supabaseMemoryStore['proforma_invoice_store'].length > 0) {
      supabaseMemoryStore['proforma_invoice_store'].forEach(item => {
        if (item && item.piNo) {
          const k = String(item.piNo).trim().toLowerCase();
          if (!existingMap.has(k)) {
            existingMap.set(k, item);
            combinedEstimates.push(item);
          }
        }
      });
    }

    // 3. Authoritative PI Assignment Reconciliation: Cross-reference notifications & heal unassigned/misassigned PIs
    try {
      const notifsFile = path.join(process.cwd(), 'server', 'notifications_store.json');
      let notifs = [];
      if (fs.existsSync(notifsFile)) {
        try {
          notifs = JSON.parse(fs.readFileSync(notifsFile, 'utf8'));
        } catch (_) {}
      }
      if (Array.isArray(notifs)) {
        for (const n of notifs) {
          if (n && n.event_type === 'PI_ASSIGNED' && n.document_id) {
            const k = String(n.document_id).trim().toLowerCase();
            const target = existingMap.get(k);
            if (target && n.recipient_emp_code) {
              target.assignedSalespersonCode = n.recipient_emp_code;
              target.assignedToId = n.recipient_emp_code;
              target.salesPersonCode = n.recipient_emp_code;
              if (target.salesPerson === 'Tech Support Specialist' || !target.salesPerson) {
                target.salesPerson = 'Sales Executive';
                target.salesperson = 'Sales Executive';
              }
              if (pool) {
                pool.query(`
                  UPDATE public.proforma_invoices
                  SET sales_person_code = $1, sales_person = $2, updated_at = NOW()
                  WHERE LOWER(TRIM(pi_no)) = LOWER(TRIM($3)) AND (sales_person_code != $1 OR sales_person_code IS NULL)
                `, [n.recipient_emp_code, target.salesPerson, n.document_id]).catch(() => {});
              }
            }
          }
        }
      }
    } catch (_) {}

    res.json(combinedEstimates);
  });

  // Direct import endpoint to ingest exported Quotes/Estimates
  router.post('/api/import-estimates', async (req, res) => {
    try {
      const rawEstimates = Array.isArray(req.body) ? req.body : (Array.isArray(req.body?.estimates) ? req.body.estimates : []);
      if (rawEstimates.length === 0) {
        return res.status(400).json({ success: false, error: 'No estimates array provided in body' });
      }

      const p1 = getStoreFilePath('proforma_invoice_store.json');
      const p2 = getStoreFilePath('sales_pi_store.json');

      const mappedPIs = rawEstimates.map(est => ({
        id: est.estimate_id || est.id || est.estimate_number || est.piNo,
        piNo: est.estimate_number || est.piNo || est['Estimate Number'] || est['Quote Number'],
        piDate: est.date || est.piDate || est['Date'] || '',
        vendor: est.customer_name || est.vendor || est['Customer Name'] || '',
        customerName: est.customer_name || est.vendor || est['Customer Name'] || '',
        customerId: est.customer_id || '',
        salesPerson: est.salesperson_name || est.salesPerson || est['Salesperson'] || '',
        salesperson: est.salesperson_name || est.salesPerson || est['Salesperson'] || '',
        salesPersonCode: est.salesperson_id || '',
        amount: est.amount || `₹${Number(est.total || est['Total'] || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`,
        total: Number(est.total || est['Total'] || 0),
        status: (est.status || '').toLowerCase() === 'invoiced' ? 'Invoiced' : ((est.status || '').toLowerCase() === 'declined' ? 'Cancelled' : ((est.status || '').toLowerCase() === 'draft' ? 'Draft' : 'Issued')),
        statusType: (est.status || '').toLowerCase() === 'invoiced' ? 'invoiced' : ((est.status || '').toLowerCase() === 'declined' ? 'cancelled' : ((est.status || '').toLowerCase() === 'draft' ? 'draft' : 'issued'))
      })).filter(x => Boolean(x.piNo));

      supabaseMemoryStore['sales_pi_store'] = mappedPIs;
      supabaseMemoryStore['proforma_invoice_store'] = mappedPIs;

      fs.writeFileSync(p1, JSON.stringify(mappedPIs, null, 2), 'utf8');
      fs.writeFileSync(p2, JSON.stringify(mappedPIs, null, 2), 'utf8');
      saveDatabaseStore('sales_pi_store', mappedPIs).catch(() => {});
      broadcastRealtimeEvent('pi_updated', { action: 'import', count: mappedPIs.length });

      res.json({ success: true, count: mappedPIs.length, message: `Successfully imported ${mappedPIs.length} Quotes (PIs)` });
    } catch (err) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // Diagnostics endpoint to inspect BUSINZ local stores estimates count
  router.get('/api/debug-estimates', async (req, res) => {
    const p1 = getStoreFilePath('proforma_invoice_store.json');
    let count = 0;
    try {
      if (fs.existsSync(p1)) count = JSON.parse(fs.readFileSync(p1, 'utf8')).length;
    } catch (_) {}
    res.json({
      connected: false,
      source: 'BUSINZ_LOCAL_STORE',
      cachedCount: count,
      estimatesInSample: count,
      rateLimitedUntil: null
    });
  });

  router.post(['/api/estimates', '/api/proforma-invoices'], async (req, res) => {
    try {
      const saveResult = await saveProformaInvoiceToDatabase(req.body);
      const savedPi = saveResult.pi;

      console.log(`✅ [PI STEP 1: DATABASE PERSISTED] PI "${savedPi.piNo}" safely stored in PostgreSQL public.proforma_invoices.`);

      broadcastRealtimeEvent('pi_created', { action: 'create', recordId: savedPi?.piNo || savedPi?.id, pi: savedPi });

      return res.json({
        success: true,
        message: saveResult.wasAutoAdvanced
          ? `Proforma Invoice auto-advanced to ${savedPi.piNo} to prevent overwriting existing record.`
          : 'Proforma Invoice stored in BUSINZ database successfully!',
        pi: savedPi,
        estimate: savedPi,
        zohoSynced: Boolean(savedPi.zohoSynced),
        wasReassigned: saveResult.wasAutoAdvanced
      });
    } catch (err) {
      console.error('[BUSINZ PI CREATE ERROR]:', err);
      return res.status(500).json({
        success: false,
        error: 'Failed to store Proforma Invoice in database: ' + err.message
      });
    }
  });

  // Fetch current Zoho Books ERP integration configuration & status
  router.get('/api/zoho/config', async (req, res) => {
    try {
      const config = getZohoConfigInfo(true);
      const stats = getZohoAuthStats();
      res.json({
        success: true,
        config,
        stats
      });
    } catch (err) {
      console.error('[Zoho Config Get Error]:', err.message);
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // Update Zoho Books ERP company account configuration
  router.post('/api/zoho/config', async (req, res) => {
    try {
      const { companyName, orgId, clientId, clientSecret, refreshToken, apiDomain, accountsDomain } = req.body || {};
      if (!orgId || !clientId || !clientSecret || !refreshToken) {
        return res.status(400).json({
          success: false,
          error: 'Organization ID, Client ID, Client Secret, and Refresh Token are required.'
        });
      }

      const updated = await updateZohoConfig({
        companyName,
        orgId,
        clientId,
        clientSecret,
        refreshToken,
        apiDomain,
        accountsDomain
      });

      res.json({
        success: true,
        message: 'Zoho Books company credentials updated and applied successfully!',
        config: updated
      });
    } catch (err) {
      console.error('[Zoho Config Save Error]:', err.message);
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // Test connection to Zoho Books OAuth & API live
  router.post('/api/zoho/test-connection', async (req, res) => {
    try {
      const customCreds = req.body && Object.keys(req.body).length > 0 ? req.body : null;
      const result = await testZohoConnection(customCreds);
      res.json(result);
    } catch (err) {
      console.error('[Zoho Test Connection Error]:', err.message);
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // Exchange temporary grant token (authorization code) for permanent refresh token
  router.post('/api/zoho/exchange-code', async (req, res) => {
    try {
      const { code, clientId, clientSecret, orgId, apiDomain, accountsDomain, companyName } = req.body || {};
      if (!code || !code.trim()) {
        return res.status(400).json({ success: false, error: 'Authorization code is required.' });
      }
      const result = await exchangeAuthorizationCode({
        code,
        clientId,
        clientSecret,
        orgId,
        apiDomain,
        accountsDomain,
        companyName
      });
      res.json(result);
    } catch (err) {
      console.error('[Zoho Code Exchange Error]:', err.message);
      res.status(400).json({ success: false, error: err.message });
    }
  });

  // Manual 1-Way Push Proforma Invoice to Zoho Books as Estimate / Quote
  router.post(['/api/zoho/push-pi', '/api/estimates/push-to-zoho'], async (req, res) => {
    try {
      let piRecord = req.body.pi || req.body;
      const piNo = String(req.body.piNo || piRecord.piNo || piRecord.id || '').trim();

      if (!piNo) {
        return res.status(400).json({ success: false, error: 'piNo is required to push to Zoho' });
      }

      if (!piRecord.items || piRecord.items.length === 0) {
        try {
          const dbRes = await query(
            'SELECT * FROM public.proforma_invoices WHERE LOWER(TRIM(pi_no)) = LOWER(TRIM($1)) OR LOWER(TRIM(id)) = LOWER(TRIM($1))',
            [piNo]
          );
          if (dbRes.rows.length > 0) {
            const dbPi = toConsumerPi(dbRes.rows[0]);
            piRecord = { ...dbPi, ...piRecord };
          }
        } catch (_) {}

        if (!piRecord.items || piRecord.items.length === 0) {
          const pProforma = getStoreFilePath('proforma_invoice_store.json');
          const pSales = getStoreFilePath('sales_pi_store.json');
          let found = null;
          try {
            if (fs.existsSync(pProforma)) {
              const list = JSON.parse(fs.readFileSync(pProforma, 'utf8'));
              found = list.find(p => String(p.piNo || p.id || '').trim().toLowerCase() === piNo.toLowerCase());
            }
            if (!found && fs.existsSync(pSales)) {
              const list = JSON.parse(fs.readFileSync(pSales, 'utf8'));
              found = list.find(p => String(p.piNo || p.id || '').trim().toLowerCase() === piNo.toLowerCase());
            }
          } catch (_) {}

          if (found) {
            piRecord = { ...found, ...piRecord };
          }
        }
      }

      piRecord.piNo = piNo;
      const result = await pushPiToZoho(piRecord);

      if (result?.estimate?.estimate_id) {
        await updatePiZohoSyncStatus(piNo, {
          zohoSynced: true,
          zohoEstimateId: String(result.estimate.estimate_id).trim(),
          zohoEstimateNo: result.estimate.estimate_number || piNo,
          zohoSyncError: null
        });

        broadcastRealtimeEvent('pi_updated', {
          piNo,
          zohoSynced: true,
          zohoEstimateId: String(result.estimate.estimate_id).trim(),
          zohoEstimateNo: result.estimate.estimate_number || piNo
        });
      }

      return res.json(result);
    } catch (err) {
      console.error('[Zoho Push Route Error]:', err.message);
      const piNo = String(req.body.piNo || req.body?.pi?.piNo || '').trim();
      if (piNo) {
        await updatePiZohoSyncStatus(piNo, {
          zohoSynced: false,
          zohoSyncError: err.message
        }).catch(() => {});
      }
      return res.status(500).json({ success: false, error: err.message });
    }
  });

  // Cancel / Decline Proforma Invoice (Estimate / Quote) in BUSINZ authoritative database and local stores
  router.post(['/api/estimates/cancel', '/api/proforma-invoices/cancel'], async (req, res) => {
    const { piNo, reason = 'Cancelled by user in Businz' } = req.body;
    const cleanPiNo = String(piNo || '').trim();

    if (!cleanPiNo) {
      return res.status(400).json({ success: false, error: 'piNo is required to cancel a Proforma Invoice' });
    }

    try {
      await cancelProformaInvoiceInDatabase(cleanPiNo, reason);
    } catch (e) {
      console.error('[CANCEL DB PERSIST ERROR]', e);
    }

    res.json({
      success: true,
      message: `Proforma Invoice ${cleanPiNo} marked as Cancelled in BUSINZ!`
    });
  });

  // Delete Proforma Invoice permanently from database and stores (Admin/Cleanup)
  router.delete(['/api/estimates/:id', '/api/proforma-invoices/:id'], async (req, res) => {
    const piId = decodeURIComponent(req.params.id || '').trim();
    if (!piId) {
      return res.status(400).json({ success: false, error: 'Proforma Invoice ID / number is required' });
    }

    try {
      const deleted = await deleteProformaInvoiceFromDatabase(piId);
      return res.json({
        success: true,
        message: `Proforma Invoice ${piId} deleted successfully!`,
        deleted
      });
    } catch (err) {
      console.error('[DELETE PI ERROR]', err);
      return res.status(500).json({ success: false, error: err.message });
    }
  });

  return router;
}
