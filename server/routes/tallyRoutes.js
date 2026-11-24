import express from 'express';
import { checkTallyStatus, fetchTallyPnl, pushDirectVoucher } from '../tallyService.js';

export function createTallyRouter() {
  const router = express.Router();

  // Check connectivity to local Tally HTTP Server (Default port 9000) & active companies
  let customTallyUrl = process.env.TALLY_URL || 'http://127.0.0.1:9000';
  let customTallyCompany = 'VRM STRUCTURES INDIA PRIVATE LIMITED';

  router.get('/api/tally/status', async (req, res) => {
    try {
      const targetUrl = req.query.url || customTallyUrl;
      const result = await checkTallyStatus(targetUrl);
      if (result.primaryCompany) {
        customTallyCompany = result.primaryCompany;
      }
      res.json({
        ...result,
        configuredCompany: customTallyCompany
      });
    } catch (err) {
      res.json({
        online: false,
        host: customTallyUrl,
        message: err.message || 'Tally HTTP Server is offline or unreachable on port 9000.'
      });
    }
  });

  // Update Tally configuration (Host URL, Company Name)
  router.post('/api/tally/config', (req, res) => {
    const { url, company } = req.body || {};
    if (url) customTallyUrl = url;
    if (company) customTallyCompany = company;
    res.json({
      success: true,
      url: customTallyUrl,
      company: customTallyCompany,
      message: 'Tally configuration updated successfully'
    });
  });

  // Fetch Live Profit & Loss statement directly from Tally Prime (Zero files)
  router.get('/api/tally/pnl', async (req, res) => {
    const { fromDate, toDate, company } = req.query;
    const companyName = company || customTallyCompany;
    try {
      const pnlData = await fetchTallyPnl(customTallyUrl, companyName, fromDate, toDate);
      res.json(pnlData);
    } catch (err) {
      res.status(500).json({
        success: false,
        error: err.message,
        message: 'Failed to retrieve P&L from Tally Prime'
      });
    }
  });

  // Direct automated voucher sync to Tally HTTP Server (Zero files)
  router.post('/api/tally/direct-sync', async (req, res) => {
    const { xml, voucherType, recordCount, companyName } = req.body;
    if (!xml) {
      return res.status(400).json({ success: false, message: 'Voucher XML payload is required' });
    }

    try {
      const targetCompany = companyName || customTallyCompany;
      const result = await pushDirectVoucher(xml, customTallyUrl);
      res.json({
        ...result,
        company: targetCompany,
        recordCount: recordCount || 1,
        voucherType: voucherType || 'Voucher'
      });
    } catch (err) {
      res.status(500).json({
        success: false,
        error: err.message,
        message: 'Direct sync to Tally Prime failed'
      });
    }
  });

  // Post XML Vouchers directly to Tally HTTP Server (Legacy / Direct)
  router.post('/api/tally/sync', async (req, res) => {
    const { xml, type, recordCount, companyName } = req.body;
    if (!xml) {
      return res.status(400).json({ success: false, message: 'Tally XML payload is required' });
    }

    try {
      const result = await pushDirectVoucher(xml, customTallyUrl);
      res.json(result);
    } catch (err) {
      res.status(500).json({
        success: false,
        error: err.message,
        message: 'Tally HTTP server not reachable on port 9000'
      });
    }
  });

  return router;
}

export default createTallyRouter;
