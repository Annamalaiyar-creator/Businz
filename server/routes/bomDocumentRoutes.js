import express from 'express';
import fs from 'fs';
import {
  uploadBomDocument,
  createBomDocumentSignedUrl,
  deleteBomDocument,
  getBomDocumentMetadata
} from '../bomDocumentService.js';
import { getStoreFilePath } from '../runtimePaths.js';

export function createBomDocumentRouter({ requireBusinzSession, safeWriteJsonFileAsync }) {
  const router = express.Router();

  // POST /api/boms/:bomCode/documents - Upload document to bom-documents private bucket
  router.post('/api/boms/:bomCode/documents', requireBusinzSession, async (req, res) => {
    try {
      const { bomCode } = req.params;
      const { fileName, mimeType, fileData, category } = req.body;

      if (!fileData) {
        return res.status(400).json({ success: false, error: 'File data is required (base64 string or dataUrl)' });
      }

      // Convert fileData (dataUrl or base64 string) to Buffer
      let buffer;
      let resolvedMime = mimeType;

      if (typeof fileData === 'string') {
        if (fileData.startsWith('data:')) {
          const matches = fileData.match(/^data:([^;]+);base64,(.+)$/);
          if (matches) {
            resolvedMime = resolvedMime || matches[1];
            buffer = Buffer.from(matches[2], 'base64');
          } else {
            return res.status(400).json({ success: false, error: 'Malformed data URL' });
          }
        } else {
          buffer = Buffer.from(fileData, 'base64');
        }
      } else if (Buffer.isBuffer(fileData)) {
        buffer = fileData;
      } else {
        return res.status(400).json({ success: false, error: 'Unsupported file payload format' });
      }

      const metadata = await uploadBomDocument({
        bomCode,
        category,
        fileBuffer: buffer,
        fileName,
        mimeType: resolvedMime
      });

      // Also mirror to media_cache.json so instant lookup works seamlessly across sessions
      try {
        const mediaCachePath = getStoreFilePath('media_cache.json');
        let mediaCache = {};
        if (fs.existsSync(mediaCachePath)) {
          mediaCache = JSON.parse(fs.readFileSync(mediaCachePath, 'utf8') || '{}');
        }
        const dataUrlToStore = (typeof fileData === 'string' && fileData.startsWith('data:'))
          ? fileData
          : `data:${resolvedMime};base64,${buffer.toString('base64')}`;
        mediaCache[fileName] = dataUrlToStore;
        if (metadata && metadata.storagePath) {
          mediaCache[metadata.storagePath] = dataUrlToStore;
        }
        if (safeWriteJsonFileAsync) {
          safeWriteJsonFileAsync(mediaCachePath, mediaCache);
        }
      } catch (cacheErr) {
        console.warn('[BOM Document Upload] Failed to update media_cache.json:', cacheErr.message);
      }

      res.json({
        success: true,
        metadata
      });
    } catch (err) {
      console.error('[BOM Document Upload Error]:', err.message);
      const statusCode = err.message.includes('exceeds') ? 413 :
        (err.message.includes('Invalid') || err.message.includes('Unsupported')) ? 400 : 500;
      res.status(statusCode).json({ success: false, error: err.message });
    }
  });

  // GET /api/boms/:bomCode/documents/signed-url - Generate short-lived signed URL
  router.get('/api/boms/:bomCode/documents/signed-url', requireBusinzSession, async (req, res) => {
    try {
      const { bomCode } = req.params;
      const storagePath = req.query.path || req.query.storagePath;
      const expiresIn = req.query.expiresIn || 900; // 15 mins default

      if (!storagePath) {
        return res.status(400).json({ success: false, error: 'Storage path is required (?path=...)' });
      }

      const result = await createBomDocumentSignedUrl({
        bomCode,
        storagePath,
        expiresIn: Number(expiresIn)
      });

      res.json({
        success: true,
        ...result
      });
    } catch (err) {
      const isForbidden = err.message.includes('Access denied') || err.message.includes('Path traversal');
      const isBadReq = err.message.includes('Invalid');
      const statusCode = isForbidden ? 403 : isBadReq ? 400 : 500;
      res.status(statusCode).json({ success: false, error: err.message });
    }
  });

  // DELETE /api/boms/:bomCode/documents - Delete document from bom-documents bucket
  router.delete('/api/boms/:bomCode/documents', requireBusinzSession, async (req, res) => {
    try {
      const { bomCode } = req.params;
      const storagePath = req.body?.path || req.query?.path || req.body?.storagePath;

      if (!storagePath) {
        return res.status(400).json({ success: false, error: 'Storage path is required' });
      }

      const result = await deleteBomDocument({
        bomCode,
        storagePath
      });

      res.json({
        success: true,
        ...result
      });
    } catch (err) {
      const isForbidden = err.message.includes('Access denied') || err.message.includes('Path traversal');
      const isBadReq = err.message.includes('Invalid');
      const statusCode = isForbidden ? 403 : isBadReq ? 400 : 500;
      res.status(statusCode).json({ success: false, error: err.message });
    }
  });

  // GET /api/boms/:bomCode/documents/metadata - Inspect metadata
  router.get('/api/boms/:bomCode/documents/metadata', requireBusinzSession, async (req, res) => {
    try {
      const { bomCode } = req.params;
      const storagePath = req.query.path || req.query.storagePath;

      if (!storagePath) {
        return res.status(400).json({ success: false, error: 'Storage path is required (?path=...)' });
      }

      const metadata = await getBomDocumentMetadata({
        bomCode,
        storagePath
      });

      if (!metadata) {
        return res.status(404).json({ success: false, error: 'Document not found' });
      }

      res.json({
        success: true,
        metadata
      });
    } catch (err) {
      const isForbidden = err.message.includes('Access denied') || err.message.includes('Path traversal');
      const statusCode = isForbidden ? 403 : 400;
      res.status(statusCode).json({ success: false, error: err.message });
    }
  });

  return router;
}

export default createBomDocumentRouter;
