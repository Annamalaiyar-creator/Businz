import { Router } from 'express';
import fs from 'fs';
import { getStoreFilePath } from '../runtimePaths.js';

export default function createDeliveryChallanRouter(dependencies) {
  const router = Router();
  const { supabaseMemoryStore, pushStoreToSupabase } = dependencies;

  // Real-time synchronization endpoint retrieving delivery challans strictly from BUSINZ local stores
  router.get(['/api/deliverychallans', '/api/delivery-challans'], async (req, res) => {
    let localDCs = [];
    const p = getStoreFilePath('dc_store.json');
    try {
      if (fs.existsSync(p)) localDCs = JSON.parse(fs.readFileSync(p, 'utf8'));
    } catch (_) {}

    if (localDCs.length === 0 && Array.isArray(supabaseMemoryStore['dc_store']) && supabaseMemoryStore['dc_store'].length > 0) {
      localDCs = supabaseMemoryStore['dc_store'];
    }

    res.json(localDCs);
  });

  // Endpoint to CREATE a Delivery Challan in BUSINZ Authoritative Store (Native BUSINZ Store)
  router.post(['/api/deliverychallans', '/api/delivery-challans'], async (req, res) => {
    let localDCs = [];
    const p = getStoreFilePath('dc_store.json');
    try {
      if (fs.existsSync(p)) localDCs = JSON.parse(fs.readFileSync(p, 'utf8'));
    } catch (_) {}

    const newDC = { 
      ...req.body, 
      id: req.body.id || req.body.challanNo || req.body.dcNo || `DC-${Date.now()}`,
      dcNo: req.body.challanNo || req.body.dcNo || `DC-${Date.now()}`,
      createdAt: req.body.createdAt || new Date().toISOString()
    };
    const updated = [newDC, ...localDCs];
    try { 
      fs.writeFileSync(p, JSON.stringify(updated, null, 2), 'utf8'); 
      supabaseMemoryStore['dc_store'] = updated;
      pushStoreToSupabase('dc_store', updated).catch(() => {});
    } catch (_) {}

    res.json({ 
      success: true, 
      message: 'Delivery Challan created in BUSINZ successfully!',
      deliverychallan: newDC 
    });
  });

  // Endpoint to CANCEL a Delivery Challan in BUSINZ Authoritative Store
  router.post(['/api/deliverychallans/:id/cancel', '/api/delivery-challans/:id/cancel'], async (req, res) => {
    const targetId = req.params.id;
    const { remark, cancelReason, cancelledBy } = req.body || {};
    if (!remark && !cancelReason) {
      return res.status(400).json({ success: false, error: 'A cancellation remark is mandatory to cancel a Delivery Challan.' });
    }

    let localDCs = [];
    const p = getStoreFilePath('dc_store.json');
    try {
      if (fs.existsSync(p)) localDCs = JSON.parse(fs.readFileSync(p, 'utf8'));
    } catch (_) {}

    const normalize = (s) => String(s || '').replace(/[/_\-\s]/g, '').toLowerCase();
    const cleanTarget = normalize(targetId);

    let found = false;
    const updated = localDCs.map(dc => {
      if (normalize(dc.id) === cleanTarget || normalize(dc.dcNo) === cleanTarget || normalize(dc.code) === cleanTarget) {
        found = true;
        return {
          ...dc,
          status: 'CANCELLED',
          statusType: 'cancelled',
          cancelled: true,
          cancellationRemark: remark || cancelReason,
          cancelReason: remark || cancelReason,
          cancelledBy: cancelledBy || 'Procurement Head',
          cancelledDate: new Date().toLocaleDateString('en-GB'),
          cancelledAt: new Date().toISOString()
        };
      }
      return dc;
    });

    if (!found) {
      return res.status(404).json({ success: false, error: `Delivery Challan ${targetId} not found.` });
    }

    try {
      fs.writeFileSync(p, JSON.stringify(updated, null, 2), 'utf8');
      supabaseMemoryStore['dc_store'] = updated;
      pushStoreToSupabase('dc_store', updated).catch(() => {});
    } catch (_) {}

    res.json({
      success: true,
      message: `Delivery Challan ${targetId} cancelled successfully.`,
      deliverychallans: updated
    });
  });

  // Endpoint to UPDATE a Delivery Challan
  router.put(['/api/deliverychallans/:id', '/api/delivery-challans/:id'], async (req, res) => {
    const targetId = decodeURIComponent(req.params.id || '');
    let localDCs = [];
    const p = getStoreFilePath('dc_store.json');
    try {
      if (fs.existsSync(p)) localDCs = JSON.parse(fs.readFileSync(p, 'utf8'));
    } catch (_) {}

    if (localDCs.length === 0 && Array.isArray(supabaseMemoryStore['dc_store']) && supabaseMemoryStore['dc_store'].length > 0) {
      localDCs = supabaseMemoryStore['dc_store'];
    }

    const normalize = (s) => String(s || '').replace(/[/_\-\s]/g, '').toLowerCase();
    const cleanTarget = normalize(targetId);

    let updatedRecord = null;
    const updated = localDCs.map(dc => {
      if (normalize(dc.id) === cleanTarget || normalize(dc.dcNo) === cleanTarget || normalize(dc.code) === cleanTarget) {
        updatedRecord = {
          ...dc,
          ...req.body,
          updatedAt: new Date().toISOString()
        };
        return updatedRecord;
      }
      return dc;
    });

    if (!updatedRecord) {
      updatedRecord = {
        ...req.body,
        id: req.body.id || targetId,
        dcNo: req.body.dcNo || targetId,
        updatedAt: new Date().toISOString()
      };
      updated.unshift(updatedRecord);
    }

    try {
      fs.writeFileSync(p, JSON.stringify(updated, null, 2), 'utf8');
      supabaseMemoryStore['dc_store'] = updated;
      pushStoreToSupabase('dc_store', updated).catch(() => {});
    } catch (_) {}

    res.json({
      success: true,
      message: `Delivery Challan ${targetId} updated successfully.`,
      deliverychallan: updatedRecord
    });
  });

  return router;
}
