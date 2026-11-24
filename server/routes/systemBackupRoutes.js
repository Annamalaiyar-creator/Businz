import express from 'express';
import fs from 'fs';
import path from 'path';
import { isOptimizationTestMode } from '../optimizationTestGuard.js';
import { getSystemDiagnostics, logMemoryDiagnostic } from '../memoryDiagnostics.js';
import { createFullBackup, listBackups, restoreFromBackup } from '../backupEngine.js';
import { getBackupDir } from '../runtimeStorage.js';

export function createSystemBackupRouter({ supabase, supabaseMemoryStore, getVerifiedUserSession, isMaintenanceModeActive }) {
  const router = express.Router();

  // Periodic lightweight memory diagnostic logger (Runs every 15 minutes)
  if (!isOptimizationTestMode()) {
    setInterval(() => {
      try {
        logMemoryDiagnostic('PERIODIC');
      } catch (_) {}
    }, 15 * 60 * 1000);
  }

  // Authenticated memory and background job diagnostics endpoint
  router.get('/api/system/diagnostics/memory', async (req, res) => {
    try {
      const session = await getVerifiedUserSession(req);
      if (!session || !session.valid) {
        return res.status(401).json({ success: false, error: session?.error || 'Unauthorized: Authentication session required' });
      }
      if (!['Technical Administrator', 'Super Admin', 'CEO', 'Director', 'Admin'].includes(session.role)) {
        return res.status(403).json({ success: false, error: 'Forbidden: Admin access required for system diagnostics' });
      }
      const diagnostics = getSystemDiagnostics();
      res.json({ success: true, diagnostics });
    } catch (err) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // 🛡️ ENTERPRISE DISASTER RECOVERY & BACKUP API

  // 1. List all available backups
  router.get('/api/system/backup/list', (req, res) => {
    try {
      const backups = listBackups();
      res.json({ success: true, backups });
    } catch (err) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // 2. Trigger instant full backup
  router.get('/api/system/backup/create', async (req, res) => {
    try {
      const result = await createFullBackup({
        supabaseClient: supabase,
        memoryStore: supabaseMemoryStore,
        triggeredBy: req.query.user || 'Admin Web Console'
      });
      res.json({ success: true, backup: result });
    } catch (err) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // 3. Download a backup file directly
  router.get('/api/system/backup/download/:filename', (req, res) => {
    try {
      const safeFilename = path.basename(req.params.filename);
      const filePath = path.resolve(getBackupDir(), safeFilename);
      if (!fs.existsSync(filePath)) {
        return res.status(404).json({ success: false, error: 'Backup file not found' });
      }
      res.setHeader('Content-Disposition', `attachment; filename="${safeFilename}"`);
      res.setHeader('Content-Type', 'application/json');
      const stream = fs.createReadStream(filePath);
      stream.pipe(res);
    } catch (err) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // 4. Download latest backup directly
  router.get('/api/system/backup/latest/download', (req, res) => {
    try {
      const backups = listBackups();
      if (backups.length === 0) {
        return res.status(404).json({ success: false, error: 'No backups exist yet' });
      }
      const latest = backups[0];
      const filePath = path.resolve(getBackupDir(), latest.filename);
      res.setHeader('Content-Disposition', `attachment; filename="${latest.filename}"`);
      res.setHeader('Content-Type', 'application/json');
      fs.createReadStream(filePath).pipe(res);
    } catch (err) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // 5. Restore from backup
  router.post('/api/system/backup/restore', async (req, res) => {
    try {
      let backupData = req.body;
      if (req.body.filename && (!req.body.stores || Object.keys(req.body.stores).length === 0)) {
        const safeFilename = path.basename(req.body.filename);
        const filePath = path.resolve(getBackupDir(), safeFilename);
        if (!fs.existsSync(filePath)) {
          return res.status(404).json({ success: false, error: 'Backup file does not exist on server' });
        }
        backupData = JSON.parse(fs.readFileSync(filePath, 'utf8'));
      }

      const result = await restoreFromBackup(backupData, {
        supabaseClient: supabase,
        memoryStore: supabaseMemoryStore
      });

      res.json({ success: true, message: 'ERP state restored successfully', details: result });
    } catch (err) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // 6. Automated periodic backup (every 24 hours)
  if (!isOptimizationTestMode()) {
    setInterval(async () => {
      try {
        if (isMaintenanceModeActive && isMaintenanceModeActive()) {
          console.log('[Automated Backup] Maintenance mode active; skipping 24h scheduled snapshot.');
          return;
        }
        console.log('[Automated Backup] Running 24-hour scheduled snapshot...');
        await createFullBackup({
          supabaseClient: supabase,
          memoryStore: supabaseMemoryStore,
          triggeredBy: 'Automated 24h Scheduler'
        });
      } catch (e) {
        console.warn('[Automated Backup Error]:', e.message);
      }
    }, 24 * 60 * 60 * 1000);
  }

  return router;
}

export default createSystemBackupRouter;
