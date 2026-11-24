import express from 'express';
import { query } from '../db.js';
import { isOptimizationTestMode } from '../optimizationTestGuard.js';
import {
  getOrCreateOrderTracking,
  getTrackingByToken,
  submitCustomerIssue,
  confirmCustomerDelivery,
  regenerateTrackingToken,
  revokeTrackingToken,
  getInternalTrackingOrders,
  getTrackingAnalytics,
  processNotificationQueueWorker,
  queueTrackingNotification,
  broadcastCustomerTrackingUpdate,
  customerTrackingSseClients
} from '../orderTrackingService.js';

const router = express.Router();

// 1. Public Customer Tracking Endpoint (Token-based, No Auth Required)
router.get('/api/track/:token', async (req, res) => {
  try {
    const { token } = req.params;
    if (!token || typeof token !== 'string') {
      return res.status(400).json({ success: false, error: 'Tracking token is required' });
    }

    const trackingData = await getTrackingByToken(token);
    if (!trackingData) {
      return res.status(404).json({ success: false, error: 'Tracking link not found or expired' });
    }

    // Set client-side cache header to 10 seconds for high freshness
    res.setHeader('Cache-Control', 'public, max-age=10');
    res.json({ success: true, tracking: trackingData });
  } catch (err) {
    console.error('[BUSINZ Track API Error]:', err);
    res.status(500).json({ success: false, error: 'Failed to retrieve tracking information' });
  }
});

// 2. Real-Time Tracking Server-Sent Events (SSE) Stream
router.get('/api/track/:token/events', async (req, res) => {
  const { token } = req.params;
  if (!token) return res.status(400).end();

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  if (!customerTrackingSseClients.has(token)) {
    customerTrackingSseClients.set(token, new Set());
  }
  const clientSet = customerTrackingSseClients.get(token);
  clientSet.add(res);

  // Send initial connection ping
  res.write(`event: connected\ndata: ${JSON.stringify({ status: 'connected', timestamp: new Date().toISOString() })}\n\n`);

  // Heartbeat every 25 seconds to keep connection alive
  const heartbeat = setInterval(() => {
    res.write(': keepalive\n\n');
  }, 25000);

  req.on('close', () => {
    clearInterval(heartbeat);
    clientSet.delete(res);
    if (clientSet.size === 0) {
      customerTrackingSseClients.delete(token);
    }
  });
});

// 3. Customer Issue Reporting
router.post('/api/track/:token/issues', async (req, res) => {
  try {
    const { token } = req.params;
    const { issueCategory, issueDescription, contactNumber } = req.body;

    if (!issueDescription || typeof issueDescription !== 'string') {
      return res.status(400).json({ success: false, error: 'Issue description is required' });
    }

    const tracking = await getTrackingByToken(token);
    if (!tracking) {
      return res.status(404).json({ success: false, error: 'Invalid tracking token' });
    }

    const issue = await submitCustomerIssue({
      trackingId: tracking.id,
      bomCode: tracking.bom_code,
      issueCategory: issueCategory || 'GENERAL',
      issueDescription: issueDescription.trim(),
      contactNumber: contactNumber || tracking.customer_mobile
    });

    res.json({ success: true, message: 'Issue submitted successfully. Our team will contact you shortly.', issue });
  } catch (err) {
    console.error('[BUSINZ Track Issue Error]:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// 4. Customer Delivery Confirmation
router.post('/api/track/:token/confirm-delivery', async (req, res) => {
  try {
    const { token } = req.params;
    const { receivedBy, feedbackRating, feedbackNotes } = req.body;

    const tracking = await getTrackingByToken(token);
    if (!tracking) {
      return res.status(404).json({ success: false, error: 'Invalid tracking token' });
    }

    const updated = await confirmCustomerDelivery(tracking.id, {
      receivedBy: receivedBy || tracking.customer_name,
      feedbackRating: Number(feedbackRating) || 5,
      feedbackNotes: feedbackNotes || ''
    });

    res.json({ success: true, message: 'Delivery confirmation recorded. Thank you!', tracking: updated });
  } catch (err) {
    console.error('[BUSINZ Track Confirm Delivery Error]:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// ==============================================================================
// 🏢 Internal BUSINZ Track Operations & Management Endpoints (Staff Auth)
// ==============================================================================

// List Tracked Orders with summary KPIs & filters
router.get('/api/internal/tracking/orders', async (req, res) => {
  try {
    const { stage, search, limit = 50, offset = 0 } = req.query;
    const data = await getInternalTrackingOrders({
      stage,
      search,
      limit: Math.min(Number(limit) || 50, 100),
      offset: Number(offset) || 0
    });

    res.json({ success: true, ...data });
  } catch (err) {
    console.error('[Internal Tracking Orders Error]:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// Regenerate Tracking Token (Invalidates old link)
router.post('/api/internal/tracking/orders/:bomCode/regenerate-token', async (req, res) => {
  try {
    const { bomCode } = req.params;
    const { reason = 'Manual staff regeneration' } = req.body;

    const updated = await regenerateTrackingToken(bomCode, reason);
    if (!updated) {
      return res.status(404).json({ success: false, error: 'No tracking record found for this BOM' });
    }

    const domain = process.env.VITE_APP_URL || 'http://localhost:3000';
    const trackingUrl = `${domain}/order/${updated.tracking_token}`;

    res.json({
      success: true,
      message: 'New tracking token generated successfully.',
      trackingToken: updated.tracking_token,
      trackingUrl
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Revoke Tracking Token
router.post('/api/internal/tracking/orders/:bomCode/revoke-token', async (req, res) => {
  try {
    const { bomCode } = req.params;
    const { reason = 'Revoked by staff' } = req.body;

    const revoked = await revokeTrackingToken(bomCode, reason);
    if (!revoked) {
      return res.status(404).json({ success: false, error: 'No tracking record found for this BOM' });
    }

    res.json({ success: true, message: 'Tracking token revoked.' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Resend WhatsApp Tracking Notification
router.post('/api/internal/tracking/orders/:bomCode/resend-whatsapp', async (req, res) => {
  try {
    const { bomCode } = req.params;
    const findRes = await query(`SELECT * FROM public.order_tracking WHERE bom_code = $1`, [bomCode]);
    if (findRes.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Tracking record not found' });
    }

    const tracking = findRes.rows[0];
    const domain = process.env.VITE_APP_URL || 'http://localhost:3000';
    const trackingUrl = `${domain}/order/${tracking.tracking_token}`;

    const notif = await queueTrackingNotification({
      trackingId: tracking.id,
      bomCode: tracking.bom_code,
      customerPhone: tracking.customer_mobile,
      customerName: tracking.customer_name,
      companyName: tracking.company_name,
      triggerEvent: 'MANUAL_RESEND_' + Date.now(),
      templateName: 'order_tracking_started',
      trackingUrl
    });

    // Run processor immediately for responsive action
    processNotificationQueueWorker().catch(() => {});

    res.json({ success: true, message: 'WhatsApp tracking notification queued successfully.', notification: notif });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Tracking Analytics (CEO / Operations Dashboard)
router.get('/api/internal/tracking/analytics', async (req, res) => {
  try {
    const analytics = await getTrackingAnalytics();
    res.json({ success: true, analytics });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// List Customer Issues
router.get('/api/internal/tracking/issues', async (req, res) => {
  try {
    const { status = 'OPEN' } = req.query;
    const whereSql = status === 'ALL' ? '' : 'WHERE status = $1';
    const params = status === 'ALL' ? [] : [status];

    const listRes = await query(
      `SELECT * FROM public.order_tracking_issues ${whereSql} ORDER BY created_at DESC LIMIT 50`,
      params
    );
    res.json({ success: true, issues: listRes.rows });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Resolve Customer Issue
router.post('/api/internal/tracking/issues/:id/resolve', async (req, res) => {
  try {
    const { id } = req.params;
    const { resolutionNotes = '', resolvedBy = 'Customer Support' } = req.body;

    const updateRes = await query(
      `UPDATE public.order_tracking_issues
       SET status = 'RESOLVED', resolution_notes = $1, resolved_by = $2, resolved_at = NOW(), updated_at = NOW()
       WHERE id = $3
       RETURNING *`,
      [resolutionNotes, resolvedBy, id]
    );

    if (updateRes.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Issue record not found' });
    }

    res.json({ success: true, issue: updateRes.rows[0] });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Company Tracking Settings (Get & Update)
router.get('/api/internal/tracking/settings', async (req, res) => {
  try {
    const settingsRes = await query(`SELECT * FROM public.company_tracking_settings LIMIT 1`);
    res.json({ success: true, settings: settingsRes.rows[0] || {} });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.put('/api/internal/tracking/settings', async (req, res) => {
  try {
    const s = req.body;
    const updateRes = await query(
      `UPDATE public.company_tracking_settings
       SET is_enabled = COALESCE($1, is_enabled),
           brand_color = COALESCE($2, brand_color),
           support_phone = COALESCE($3, support_phone),
           support_email = COALESCE($4, support_email),
           show_packing_photos = COALESCE($5, show_packing_photos),
           show_loading_photos = COALESCE($6, show_loading_photos),
           show_driver_phone = COALESCE($7, show_driver_phone),
           show_pricing = COALESCE($8, show_pricing),
           auto_whatsapp_dispatch_received = COALESCE($9, auto_whatsapp_dispatch_received),
           auto_whatsapp_packing_completed = COALESCE($10, auto_whatsapp_packing_completed),
           auto_whatsapp_dispatched = COALESCE($11, auto_whatsapp_dispatched),
           auto_whatsapp_delivered = COALESCE($12, auto_whatsapp_delivered),
           updated_at = NOW()
       WHERE id = (SELECT id FROM public.company_tracking_settings LIMIT 1)
       RETURNING *`,
      [
        s.is_enabled, s.brand_color, s.support_phone, s.support_email,
        s.show_packing_photos, s.show_loading_photos, s.show_driver_phone,
        s.show_pricing, s.auto_whatsapp_dispatch_received, s.auto_whatsapp_packing_completed,
        s.auto_whatsapp_dispatched, s.auto_whatsapp_delivered
      ]
    );

    res.json({ success: true, settings: updateRes.rows[0] });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Background Notification Processing Worker (Runs every 10 seconds in production/dev)
if (!isOptimizationTestMode()) {
  setInterval(() => {
    processNotificationQueueWorker().catch(() => {});
  }, 10000);
}

export default router;
