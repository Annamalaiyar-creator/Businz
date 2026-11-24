import express from 'express';
import fs from 'fs';
import { getFinancialYear, getNextSequence } from '../sequenceService.js';
import { getNextDatabasePiNumber } from '../piPersistence.js';
import { loadDatabaseLeads } from '../leadsPersistence.js';
import { query } from '../db.js';
import { getStoreFilePath } from '../runtimeStorage.js';

export function createSequenceRouter({ supabaseMemoryStore }) {
  const router = express.Router();

  // Next PI / Estimate Number
  router.get(['/api/next-pi-number', '/api/next-estimate-number'], async (req, res) => {
    try {
      const nextSeq = await getNextDatabasePiNumber();
      res.json(nextSeq);
    } catch (err) {
      console.warn('[Next PI Number Fallback Warning]:', err.message);
      const fy = getFinancialYear();
      res.json({ nextPiNo: `VRM-PI-${fy}-01`, nextEstimateNo: `VRM-PI-${fy}-01`, nextNum: 1, fiscalYear: String(fy), financialYear: fy });
    }
  });

  // Next Quotation Number
  router.get(['/api/next-quotation-number', '/api/next-quote-number'], async (req, res) => {
    try {
      const fy = getFinancialYear();
      let records = [];
      const files = ['crm_quotations.json', 'quotation_store.json', 'sales_pi_store.json'];
      for (const f of files) {
        try {
          const p = getStoreFilePath(f);
          if (fs.existsSync(p)) {
            const d = JSON.parse(fs.readFileSync(p, 'utf8'));
            if (Array.isArray(d)) records.push(...d);
          }
        } catch (_) {}
      }
      if (supabaseMemoryStore) {
        ['crm_quotations', 'quotation_store'].forEach(key => {
          if (Array.isArray(supabaseMemoryStore[key])) records.push(...supabaseMemoryStore[key]);
        });
      }
      const { code, nextNum } = getNextSequence('QT', records);
      res.json({ nextQuoteNo: code, nextQuotationNumber: code, nextNum, financialYear: fy });
    } catch (err) {
      const fy = getFinancialYear();
      res.json({ nextQuoteNo: `VRM-QT-${fy}-01`, nextQuotationNumber: `VRM-QT-${fy}-01`, nextNum: 1, financialYear: fy });
    }
  });

  // Next Lead Number
  router.get(['/api/next-lead-number', '/api/crm/leads/next-number'], async (req, res) => {
    try {
      const fy = getFinancialYear();
      const leads = await loadDatabaseLeads();
      const { code, nextNum } = getNextSequence('LD', leads);
      res.json({ nextLeadNo: code, nextLeadNumber: code, nextNum, financialYear: fy });
    } catch (err) {
      const fy = getFinancialYear();
      res.json({ nextLeadNo: `VRM-LD-${fy}-01`, nextLeadNumber: `VRM-LD-${fy}-01`, nextNum: 1, financialYear: fy });
    }
  });

  // Next Customer Code
  router.get(['/api/next-customer-number', '/api/crm/customers/next-number'], async (req, res) => {
    try {
      const fy = getFinancialYear();
      let records = [];
      try {
        const dbRes = await query('SELECT customer_code, id FROM public.customers');
        if (dbRes && Array.isArray(dbRes.rows)) records = dbRes.rows;
      } catch (_) {}

      if (records.length === 0) {
        const diskPath = getStoreFilePath('customer_store.json');
        if (fs.existsSync(diskPath)) {
          try {
            const d = JSON.parse(fs.readFileSync(diskPath, 'utf8'));
            if (Array.isArray(d)) records = d;
          } catch (_) {}
        }
      }
      const { code, nextNum } = getNextSequence('CS', records);
      res.json({ nextCustomerCode: code, nextCode: code, nextNum, financialYear: fy });
    } catch (err) {
      const fy = getFinancialYear();
      res.json({ nextCustomerCode: `VRM-CS-${fy}-01`, nextCode: `VRM-CS-${fy}-01`, nextNum: 1, financialYear: fy });
    }
  });

  // Next Delivery Challan Number
  router.get('/api/next-dc-number', async (req, res) => {
    try {
      const fy = getFinancialYear();
      let records = [];
      const p = getStoreFilePath('dc_store.json');
      if (fs.existsSync(p)) {
        try {
          const d = JSON.parse(fs.readFileSync(p, 'utf8'));
          if (Array.isArray(d)) records.push(...d);
        } catch (_) {}
      }
      const { code, nextNum } = getNextSequence('DC', records);
      res.json({ nextDcNo: code, nextChallanNumber: code, nextNum, financialYear: fy });
    } catch (err) {
      const fy = getFinancialYear();
      res.json({ nextDcNo: `VRM-DC-${fy}-01`, nextChallanNumber: `VRM-DC-${fy}-01`, nextNum: 1, financialYear: fy });
    }
  });

  // Next GRN Number
  router.get('/api/next-grn-number', async (req, res) => {
    try {
      const fy = getFinancialYear();
      let records = [];
      const p = getStoreFilePath('grn_store.json');
      if (fs.existsSync(p)) {
        try {
          const d = JSON.parse(fs.readFileSync(p, 'utf8'));
          if (Array.isArray(d)) records.push(...d);
        } catch (_) {}
      }
      const { code, nextNum } = getNextSequence('GRN', records);
      res.json({ nextGrnNo: code, nextGrnNumber: code, nextNum, financialYear: fy });
    } catch (err) {
      const fy = getFinancialYear();
      res.json({ nextGrnNo: `VRM-GRN-${fy}-01`, nextGrnNumber: `VRM-GRN-${fy}-01`, nextNum: 1, financialYear: fy });
    }
  });

  // Next Work Order Number
  router.get('/api/next-wo-number', async (req, res) => {
    try {
      const fy = getFinancialYear();
      let records = [];
      const p = getStoreFilePath('workorder_store.json');
      if (fs.existsSync(p)) {
        try {
          const d = JSON.parse(fs.readFileSync(p, 'utf8'));
          if (Array.isArray(d)) records.push(...d);
        } catch (_) {}
      }
      const { code, nextNum } = getNextSequence('WO', records);
      res.json({ nextWoNo: code, nextWorkOrderNumber: code, nextNum, financialYear: fy });
    } catch (err) {
      const fy = getFinancialYear();
      res.json({ nextWoNo: `VRM-WO-${fy}-01`, nextWorkOrderNumber: `VRM-WO-${fy}-01`, nextNum: 1, financialYear: fy });
    }
  });

  return router;
}

export default createSequenceRouter;
