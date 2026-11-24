import express from 'express';
import {
  getIndiaMartConfig,
  saveIndiaMartConfig,
  testIndiaMartConnection,
  syncIndiaMartLeads,
  getIndiaMartSyncLogs
} from '../indiamartService.js';

export function createIndiaMartRouter() {
  const router = express.Router();

  // GET IndiaMART config
  router.get('/api/integrations/indiamart/config', async (req, res) => {
    try {
      const config = await getIndiaMartConfig();
      res.json({ success: true, config, data: config });
    } catch (err) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // POST save IndiaMART config
  router.post('/api/integrations/indiamart/config', async (req, res) => {
    try {
      const { mobileNumber, crmApiKey, autoSyncEnabled, syncIntervalMinutes } = req.body;
      const updated = await saveIndiaMartConfig({
        mobileNumber,
        crmApiKey,
        autoSyncEnabled,
        syncIntervalMinutes: Number(syncIntervalMinutes) || 15
      });
      res.json({ success: true, message: 'IndiaMART configuration saved securely!', config: updated });
    } catch (err) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // POST test IndiaMART connection
  router.post('/api/integrations/indiamart/test', async (req, res) => {
    try {
      const result = await testIndiaMartConnection();
      res.json(result);
    } catch (err) {
      res.status(500).json({ success: false, message: err.message });
    }
  });

  // POST sync IndiaMART leads
  router.post('/api/integrations/indiamart/sync', async (req, res) => {
    try {
      const type = req.body?.type || 'MANUAL';
      const result = await syncIndiaMartLeads(type);
      res.json(result);
    } catch (err) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // GET IndiaMART sync logs
  router.get('/api/integrations/indiamart/logs', async (req, res) => {
    try {
      const logs = await getIndiaMartSyncLogs(30);
      res.json({ success: true, count: logs.length, logs, data: logs });
    } catch (err) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  return router;
}

export default createIndiaMartRouter;
