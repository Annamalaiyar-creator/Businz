import { Router } from 'express';
import fs from 'fs';
import path from 'path';
import { getStoreFilePath } from '../runtimePaths.js';

export default function createMediaRouter(dependencies) {
  const router = Router();
  const { uploadsDir } = dependencies;

router.post('/api/media/upload-raw', (req, res) => {
  try {
    const rawFileName = req.query.filename || req.query.name || req.headers['x-file-name'] || `media_${Date.now()}`;
    const decodedName = decodeURIComponent(rawFileName);
    const ext = path.extname(decodedName) || '.mp4';
    const safeBase = path.basename(decodedName, ext).replace(/[^a-zA-Z0-9_-]/g, '_');
    const uniqueName = `${Date.now()}_${safeBase}${ext}`;
    const targetPath = path.join(uploadsDir, uniqueName);

    const writeStream = fs.createWriteStream(targetPath);
    req.pipe(writeStream);

    writeStream.on('finish', () => {
      const stats = fs.existsSync(targetPath) ? fs.statSync(targetPath) : { size: 0 };
      console.log(`[MEDIA UPLOAD] Raw file saved: ${uniqueName} (${stats.size} bytes)`);
      const fileUrl = `/api/uploads/${uniqueName}`;
      try {
        saveCachedMedia(decodedName, fileUrl);
        saveCachedMedia(uniqueName, fileUrl);
        saveCachedMedia(safeBase, fileUrl);
        if (decodedName.includes('.')) {
          const rawStem = path.basename(decodedName, path.extname(decodedName));
          saveCachedMedia(rawStem, fileUrl);
        }
      } catch (_) {}
      res.json({
        success: true,
        url: fileUrl,
        filename: uniqueName,
        originalName: decodedName,
        size: stats.size
      });
    });

    writeStream.on('error', (err) => {
      console.error('[MEDIA UPLOAD WRITE ERROR]:', err);
      res.status(500).json({ success: false, error: err.message });
    });
  } catch (err) {
    console.error('[MEDIA UPLOAD EXCEPTION]:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// 🎥 MEDIA UPLOAD API (JSON Base64 for images and documents)
router.post('/api/media/upload', async (req, res) => {
  try {
    const { name, dataUrl, mimeType } = req.body || {};
    if (!name || !dataUrl) {
      return res.status(400).json({ success: false, error: 'Missing name or dataUrl' });
    }
    const ext = path.extname(name) || (mimeType?.includes('video') ? '.mp4' : '.jpg');
    const safeBase = path.basename(name, ext).replace(/[^a-zA-Z0-9_-]/g, '_');
    const uniqueName = `${Date.now()}_${safeBase}${ext}`;
    const targetPath = path.join(uploadsDir, uniqueName);

    const base64Data = dataUrl.replace(/^data:[^;]+;base64,/, '');
    const buffer = Buffer.from(base64Data, 'base64');
    await fs.promises.writeFile(targetPath, buffer);

    console.log(`[MEDIA UPLOAD] Base64 saved: ${uniqueName} (${buffer.length} bytes)`);
    res.json({
      success: true,
      url: `/api/uploads/${uniqueName}`,
      filename: uniqueName,
      originalName: name,
      size: buffer.length
    });
  } catch (err) {
    console.error('[MEDIA UPLOAD BASE64 ERROR]:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// 🔍 MEDIA FINDER API (Locates existing uploaded files on disk by original name)
let memoryMediaCache = null;
let memoryMediaCacheMtime = 0;
let cachedUploadsFileList = null;
let lastUploadsFileListTime = 0;

function getCachedMediaMap() {
  const mediaCachePath = getStoreFilePath('media_cache.json');
  try {
    if (fs.existsSync(mediaCachePath)) {
      const stats = fs.statSync(mediaCachePath);
      if (!memoryMediaCache || memoryMediaCacheMtime !== stats.mtimeMs) {
        memoryMediaCache = JSON.parse(fs.readFileSync(mediaCachePath, 'utf8') || '{}');
        memoryMediaCacheMtime = stats.mtimeMs;
      }
      return memoryMediaCache;
    }
  } catch (_) {}
  return memoryMediaCache || {};
}

function getCachedUploadsFileList(dir) {
  const now = Date.now();
  if (cachedUploadsFileList && (now - lastUploadsFileListTime < 20000)) {
    return cachedUploadsFileList;
  }
  const findFilesRecursively = (d) => {
    let results = [];
    try {
      const entries = fs.readdirSync(d, { withFileTypes: true });
      for (const entry of entries) {
        const fullPath = path.join(d, entry.name);
        if (entry.isDirectory()) {
          results = results.concat(findFilesRecursively(fullPath));
        } else if (entry.isFile()) {
          results.push(fullPath);
        }
      }
    } catch (_) {}
    return results;
  };
  cachedUploadsFileList = findFilesRecursively(dir);
  lastUploadsFileListTime = now;
  return cachedUploadsFileList;
}

const MIME_BY_EXT = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.pdf': 'application/pdf',
  '.mp4': 'video/mp4',
  '.webm': 'video/webm',
  '.mov': 'video/quicktime',
  '.csv': 'text/csv',
  '.json': 'application/json'
};

function extractDocCandidatesFromRecord(item) {
  if (!item || typeof item !== 'object') return [];
  return [
    item.paymentProofDoc,
    ...(Array.isArray(item.paymentProofDocs) ? item.paymentProofDocs : []),
    item.deliveryAddressProofDoc,
    ...(Array.isArray(item.deliveryAddressProofDocs) ? item.deliveryAddressProofDocs : []),
    item.deliveryProofDoc,
    item.addressProofDoc,
    item.balanceProofDoc,
    item.balancePaymentProofDoc,
    item.proofDoc,
    item.paymentSlip,
    item.paymentDoc,
    item.advancePaymentProofDoc,
    item.proofDocData,
    item.payments?.proofDocObj,
    item.payments?.balanceProofDocObj,
    ...(Array.isArray(item.payments?.proofDocObjs) ? item.payments.proofDocObjs : []),
    ...(Array.isArray(item.payments?.paymentProofDocs) ? item.payments.paymentProofDocs : []),
    item.payments?.proofDoc,
    item.payments?.balanceProofDoc,
    item.lrCopyDoc,
    item.vehicleLoading?.lrCopyDoc,
    ...(Array.isArray(item.vehicleLoading?.photos) ? item.vehicleLoading.photos : []),
    ...(Array.isArray(item.vehicleLoading?.videos) ? item.vehicleLoading.videos : []),
    ...(Array.isArray(item.dispatchPackingMedia?.photos) ? item.dispatchPackingMedia.photos : []),
    ...(Array.isArray(item.dispatchPackingMedia?.videos) ? item.dispatchPackingMedia.videos : []),
    ...(Array.isArray(item.loadingPhotos) ? item.loadingPhotos : []),
    ...(Array.isArray(item.photos) ? item.photos : []),
    ...(Array.isArray(item.vehiclePhotos) ? item.vehiclePhotos : []),
    item.invoiceDoc,
    item.signedInvoiceDoc,
    ...(Array.isArray(item.uploadedDocuments) ? item.uploadedDocuments : [])
  ].filter(Boolean);
}

const handleUploadFallback = async (req, res) => {
  try {
    let relPath = Array.isArray(req.params.filePath) ? req.params.filePath.join('/') : (req.params.filePath || '');
    if (!relPath) {
      relPath = (req.path || '').replace(/^\/(?:api\/)?uploads\/?/, '');
    }
    const decoded = decodeURIComponent(relPath || '').trim();
    if (!decoded || decoded.includes('..')) {
      return res.status(400).json({ success: false, error: 'Invalid file path' });
    }

    const baseName = path.basename(decoded);
    const sanitizedName = baseName.replace(/[^a-zA-Z0-9._-]/g, '_');
    const ext = path.extname(baseName).toLowerCase();

    const sendMatchedFile = (filePath) => {
      const fExt = path.extname(filePath).toLowerCase();
      const mime = MIME_BY_EXT[fExt] || 'application/octet-stream';
      if (req.method === 'HEAD') {
        try {
          const stat = fs.statSync(filePath);
          res.setHeader('Content-Type', mime);
          res.setHeader('Content-Length', stat.size);
          res.setHeader('Accept-Ranges', 'bytes');
          return res.status(200).end();
        } catch (_) {}
      }
      res.setHeader('Content-Type', mime);
      try {
        const buf = fs.readFileSync(filePath);
        return sendBufferData(buf, mime);
      } catch (_) {
        return res.sendFile(path.resolve(filePath), { acceptRanges: true });
      }
    };

    const sendBufferData = (buffer, mimeType) => {
      res.setHeader('Content-Type', mimeType || 'application/octet-stream');
      res.setHeader('Content-Length', buffer.length);
      res.setHeader('Cache-Control', 'public, max-age=86400');
      res.setHeader('Accept-Ranges', 'bytes');
      if (req.method === 'HEAD') {
        return res.status(200).end();
      }
      return res.status(200).send(buffer);
    };

    // Tier 1: Direct candidates
    const directCandidates = [
      path.join(uploadsDir, decoded),
      path.join(uploadsDir, baseName),
      path.join(uploadsDir, sanitizedName),
      path.join(uploadsDir, 'bom-documents', decoded),
      path.join(uploadsDir, 'bom-documents', baseName),
      path.join(uploadsDir, 'bom-documents', sanitizedName)
    ];
    for (const cand of directCandidates) {
      if (fs.existsSync(cand) && fs.statSync(cand).isFile()) {
        return sendMatchedFile(cand);
      }
    }

    // Tier 2: Search cached recursive uploads file list (exact or sanitized)
    const allFiles = getCachedUploadsFileList(uploadsDir);
    const exactMatch = allFiles.find(f => {
      const bn = path.basename(f).toLowerCase();
      return bn === baseName.toLowerCase() || bn === sanitizedName.toLowerCase();
    });
    if (exactMatch && fs.existsSync(exactMatch) && fs.statSync(exactMatch).isFile()) {
      return sendMatchedFile(exactMatch);
    }

    // Tier 3: Slug match (ignoring timestamps / prefix hashes)
    const searchSlug = path.basename(baseName, ext).replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
    if (searchSlug && searchSlug.length >= 3) {
      const slugMatch = allFiles.find(f => {
        const fExt = path.extname(f).toLowerCase();
        if (ext && fExt !== ext) return false;
        const fSlug = path.basename(f, fExt).replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
        return fSlug && (fSlug.includes(searchSlug) || searchSlug.includes(fSlug));
      });
      if (slugMatch && fs.existsSync(slugMatch) && fs.statSync(slugMatch).isFile()) {
        return sendMatchedFile(slugMatch);
      }
    }

    // Tier 4: Check media_cache.json
    const mediaCache = getCachedMediaMap();
    if (mediaCache && typeof mediaCache === 'object') {
      const normBase = baseName.replace(/[\s_]+/g, ' ').toLowerCase().trim();
      for (const [k, v] of Object.entries(mediaCache)) {
        if (!v || typeof v !== 'string') continue;
        const normKey = String(k || '').replace(/[\s_]+/g, ' ').toLowerCase().trim();
        if (normKey === normBase || normKey.includes(normBase) || normBase.includes(normKey)) {
          if (v.startsWith('data:')) {
            const matches = v.match(/^data:([^;]+);base64,(.+)$/);
            if (matches) {
              const mime = matches[1];
              const buf = Buffer.from(matches[2], 'base64');
              try {
                const saveDisk = path.join(uploadsDir, sanitizedName);
                if (!fs.existsSync(saveDisk)) fs.writeFileSync(saveDisk, buf);
              } catch (_) {}
              return sendBufferData(buf, mime);
            }
          } else if (v.startsWith('http://') || v.startsWith('https://')) {
            return res.redirect(v);
          }
        }
      }
    }

    // Tier 5: Check BOM, PI, and Invoice store records in PostgreSQL / JSON stores
    try {
      const targetStoreFiles = ['bom_store.json', 'sales_pi_store.json', 'proforma_invoice_store.json', 'invoice_store.json'];
      const normSearch = baseName.replace(/[\s_]+/g, ' ').toLowerCase().trim();
      const searchBaseWithoutExt = path.basename(baseName, path.extname(baseName)).replace(/[^a-z0-9]/gi, '').toLowerCase();

      for (const storeFileName of targetStoreFiles) {
        const storeFilePath = getStoreFilePath(storeFileName);
        if (!fs.existsSync(storeFilePath)) continue;
        let recordList = [];
        try {
          recordList = JSON.parse(fs.readFileSync(storeFilePath, 'utf8') || '[]');
        } catch (_) { continue; }
        if (!Array.isArray(recordList)) {
          if (recordList && Array.isArray(recordList.pis)) recordList = recordList.pis;
          else if (recordList && Array.isArray(recordList.boms)) recordList = recordList.boms;
          else continue;
        }

        for (const record of recordList) {
          const docCandidates = extractDocCandidatesFromRecord(record);
          for (const d of docCandidates) {
            const dName = typeof d === 'string' ? d : (d.name || d.originalName || '');
            const normD = dName.replace(/[\s_]+/g, ' ').toLowerCase().trim();
            const dBaseWithoutExt = path.basename(dName, path.extname(dName)).replace(/[^a-z0-9]/gi, '').toLowerCase();
            const isMatch = normD && (
              normD === normSearch ||
              normD.includes(normSearch) ||
              normSearch.includes(normD) ||
              (searchBaseWithoutExt.length >= 3 && dBaseWithoutExt && (dBaseWithoutExt.includes(searchBaseWithoutExt) || searchBaseWithoutExt.includes(dBaseWithoutExt)))
            );

            if (isMatch) {
              if (d.storagePath) {
                const spClean = d.storagePath.replace(/^bom-documents\//, '');
                const diskP = path.join(uploadsDir, 'bom-documents', spClean);
                if (fs.existsSync(diskP) && fs.statSync(diskP).isFile()) {
                  return sendMatchedFile(diskP);
                }
              }
              const dRaw = d.dataUrl || d.fileData || d.proofDocData || ((typeof d === 'string' && d.startsWith('data:')) ? d : null);
              if (dRaw && typeof dRaw === 'string' && dRaw.startsWith('data:')) {
                const m = dRaw.match(/^data:([^;]+);base64,(.+)$/);
                if (m) {
                  const mime = m[1];
                  const buf = Buffer.from(m[2], 'base64');
                  try {
                    const saveDisk = path.join(uploadsDir, sanitizedName);
                    if (!fs.existsSync(saveDisk)) fs.writeFileSync(saveDisk, buf);
                    saveCachedMedia(sanitizedName, `/api/uploads/${sanitizedName}`);
                    if (dName && dName !== sanitizedName) saveCachedMedia(dName, `/api/uploads/${sanitizedName}`);
                  } catch (_) {}
                  return sendBufferData(buf, mime);
                }
              }
            }
          }
        }
      }
    } catch (_) {}

    return res.status(404).json({
      success: false,
      error: 'File not found',
      requested: decoded
    });
  } catch (err) {
    console.error('[Upload Fallback Error]:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
};

router.get(['/api/uploads/*filePath', '/uploads/*filePath'], handleUploadFallback);
router.head(['/api/uploads/*filePath', '/uploads/*filePath'], handleUploadFallback);

router.get('/api/media/find/:name', (req, res) => {
  try {
    const rawSearch = decodeURIComponent(req.params.name || '').toLowerCase().trim();
    if (!rawSearch) {
      return res.json({ found: false });
    }

    // Fast Path 1: Check in-memory media cache
    const mediaCache = getCachedMediaMap();
    if (mediaCache && typeof mediaCache === 'object') {
      const normalizedSearch = rawSearch.replace(/[\s_]+/g, ' ').trim();
      for (const [k, v] of Object.entries(mediaCache)) {
        const lowerK = String(k || '').toLowerCase();
        const normK = lowerK.replace(/[\s_]+/g, ' ').trim();
        if (lowerK === rawSearch || normK === normalizedSearch || lowerK.includes(rawSearch) || rawSearch.includes(lowerK)) {
          return res.json({ found: true, url: v, filename: k });
        }
      }
    }

    // Fast Path 2: Check direct physical files in uploadsDir
    if (fs.existsSync(uploadsDir)) {
      const sanitizedName = rawSearch.replace(/[^a-z0-9._-]/gi, '_');
      const directCandidates = [
        path.join(uploadsDir, rawSearch),
        path.join(uploadsDir, sanitizedName),
        path.join(uploadsDir, 'bom-documents', rawSearch),
        path.join(uploadsDir, 'bom-documents', sanitizedName)
      ];

      for (const cand of directCandidates) {
        if (fs.existsSync(cand) && fs.statSync(cand).isFile()) {
          const rel = path.relative(uploadsDir, cand).replace(/\\/g, '/');
          return res.json({ found: true, url: `/api/uploads/${rel}`, filename: path.basename(cand) });
        }
      }

      // Fast Path 3: Cached recursive search across uploadsDir
      const allFiles = getCachedUploadsFileList(uploadsDir);
      // Exact filename match
      const exact = allFiles.find(f => path.basename(f).toLowerCase() === rawSearch || path.basename(f).toLowerCase() === sanitizedName);
      if (exact) {
        const rel = path.relative(uploadsDir, exact).replace(/\\/g, '/');
        return res.json({ found: true, url: `/api/uploads/${rel}`, filename: path.basename(exact) });
      }

      // Base slug match (ignoring timestamps and special characters)
      const searchBase = path.basename(rawSearch, path.extname(rawSearch)).replace(/[^a-z0-9]/gi, '').toLowerCase();
      if (searchBase && searchBase.length >= 3) {
        const matched = allFiles.find(f => {
          const fBase = path.basename(f, path.extname(f)).toLowerCase().replace(/[^a-z0-9]/gi, '');
          return fBase && (fBase.includes(searchBase) || searchBase.includes(fBase));
        });
        if (matched) {
          const rel = path.relative(uploadsDir, matched).replace(/\\/g, '/');
          return res.json({ found: true, url: `/api/uploads/${rel}`, filename: path.basename(matched) });
        }
      }
    }

    // Fast Path 4: Search BOM, PI, and Invoice store records for matching documents
    try {
      const targetStoreFiles = ['bom_store.json', 'sales_pi_store.json', 'proforma_invoice_store.json', 'invoice_store.json'];
      const normSearch = rawSearch.replace(/[\s_]+/g, ' ').trim();
      const searchBaseWithoutExt = path.basename(rawSearch, path.extname(rawSearch)).replace(/[^a-z0-9]/gi, '').toLowerCase();

      for (const storeFileName of targetStoreFiles) {
        const storeFilePath = getStoreFilePath(storeFileName);
        if (!fs.existsSync(storeFilePath)) continue;
        let recordList = [];
        try {
          recordList = JSON.parse(fs.readFileSync(storeFilePath, 'utf8') || '[]');
        } catch (_) { continue; }
        if (!Array.isArray(recordList)) {
          if (recordList && Array.isArray(recordList.pis)) recordList = recordList.pis;
          else if (recordList && Array.isArray(recordList.boms)) recordList = recordList.boms;
          else continue;
        }

        for (const record of recordList) {
          const docCandidates = extractDocCandidatesFromRecord(record);
          for (const doc of docCandidates) {
            const dName = typeof doc === 'string' ? doc : (doc.name || doc.originalName || '');
            const normDoc = dName.replace(/[\s_]+/g, ' ').toLowerCase().trim();
            const dBaseWithoutExt = path.basename(dName, path.extname(dName)).replace(/[^a-z0-9]/gi, '').toLowerCase();
            const isMatch = normDoc && (
              normDoc === normSearch ||
              normDoc.includes(normSearch) ||
              normSearch.includes(normDoc) ||
              (searchBaseWithoutExt.length >= 3 && dBaseWithoutExt && (dBaseWithoutExt.includes(searchBaseWithoutExt) || searchBaseWithoutExt.includes(dBaseWithoutExt)))
            );

            if (isMatch) {
              if (doc.storagePath) {
                const spClean = doc.storagePath.replace(/^bom-documents\//, '');
                const diskP = path.join(uploadsDir, 'bom-documents', spClean);
                if (fs.existsSync(diskP) && fs.statSync(diskP).isFile()) {
                  return res.json({ found: true, url: `/api/uploads/bom-documents/${spClean}`, filename: dName });
                }
              }
              const dData = doc.dataUrl || doc.fileData || doc.proofDocData || ((typeof doc === 'string' && doc.startsWith('data:')) ? doc : null);
              if (dData && typeof dData === 'string' && dData.startsWith('data:')) {
                const matches = dData.match(/^data:([^;]+);base64,(.+)$/);
                if (matches) {
                  const buf = Buffer.from(matches[2], 'base64');
                  const sanitizedName = dName.replace(/[^a-z0-9._-]/gi, '_');
                  const diskPath = path.join(uploadsDir, sanitizedName);
                  try {
                    if (!fs.existsSync(diskPath)) fs.writeFileSync(diskPath, buf);
                    saveCachedMedia(sanitizedName, `/api/uploads/${sanitizedName}`);
                    if (dName && dName !== sanitizedName) saveCachedMedia(dName, `/api/uploads/${sanitizedName}`);
                  } catch (_) {}
                  return res.json({ found: true, url: `/api/uploads/${sanitizedName}`, filename: dName });
                }
                return res.json({ found: true, url: dData, filename: dName });
              }
              if (doc.url && typeof doc.url === 'string' && !doc.url.startsWith('blob:')) {
                if (doc.url.startsWith('/api/uploads/') || doc.url.startsWith('/uploads/')) {
                  const checkName = doc.url.replace(/^\/(?:api\/)?uploads\/?/, '');
                  const checkPath = path.join(uploadsDir, checkName);
                  if (fs.existsSync(checkPath) && fs.statSync(checkPath).isFile()) {
                    return res.json({ found: true, url: doc.url, filename: dName });
                  }
                } else if (doc.url.startsWith('http://') || doc.url.startsWith('https://')) {
                  return res.json({ found: true, url: doc.url, filename: dName });
                }
              }
              // Check if raw file exists in uploadsDir directly
              const directCheck = path.join(uploadsDir, dName);
              if (fs.existsSync(directCheck) && fs.statSync(directCheck).isFile()) {
                return res.json({ found: true, url: `/api/uploads/${encodeURIComponent(dName)}`, filename: dName });
              }
            }
          }
        }
      }
    } catch (_) {}

    res.json({ found: false });
  } catch (err) {
    res.status(500).json({ found: false, error: err.message });
  }
});

  return router;
}
