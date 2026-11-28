/**
 * server/orderTrackingService.js
 * 
 * BUSINZ Track — Core Backend Service
 * Live Customer Order & Dispatch Tracking System
 * 
 * Strict Guarantees:
 * 1. Cryptographically secure random tokens & SHA-256 token hashing
 * 2. Deterministic stage derivation from authoritative BOM & invoice records
 * 3. Accurate product-line packing progress (line-item percentage, no cross-UOM corruption)
 * 4. Document resolution with customer-facing sanitization (strips margins, purchase costs, internal remarks)
 * 5. Multi-shipment & partial dispatch isolation
 * 6. Idempotent WhatsApp notification queueing & background worker
 * 7. Realtime SSE push for customer portal
 */

import crypto from 'crypto';
import { query } from './db.js';
import { createBomDocumentSignedUrl } from './bomDocumentService.js';

// Cache for active customer SSE listeners: Map<trackingToken, Set<res>>
export const customerTrackingSseClients = new Map();

let isSchemaInitialized = false;
let schemaInitPromise = null;

/**
 * Idempotently ensures all BUSINZ Track tables, indexes, and default settings exist in PostgreSQL
 */
export async function ensureTrackingSchema() {
  if (isSchemaInitialized) return true;
  if (schemaInitPromise) return schemaInitPromise;

  schemaInitPromise = (async () => {
    try {
      // 1. Company Tracking Settings Table
      await query(`
        CREATE TABLE IF NOT EXISTS public.company_tracking_settings (
          id TEXT PRIMARY KEY,
          company_name TEXT UNIQUE NOT NULL,
          is_enabled BOOLEAN DEFAULT true NOT NULL,
          logo_url TEXT,
          brand_color TEXT DEFAULT '#0E7490' NOT NULL,
          support_phone TEXT DEFAULT '+91 98765 43210',
          support_email TEXT DEFAULT 'support@businz.com',
          tracking_domain TEXT DEFAULT 'track.businz.com',
          show_packing_photos BOOLEAN DEFAULT true NOT NULL,
          show_loading_photos BOOLEAN DEFAULT true NOT NULL,
          show_driver_phone BOOLEAN DEFAULT true NOT NULL,
          show_pricing BOOLEAN DEFAULT false NOT NULL,
          require_otp_for_documents BOOLEAN DEFAULT false NOT NULL,
          auto_whatsapp_dispatch_received BOOLEAN DEFAULT true NOT NULL,
          auto_whatsapp_packing_completed BOOLEAN DEFAULT true NOT NULL,
          auto_whatsapp_dispatched BOOLEAN DEFAULT true NOT NULL,
          auto_whatsapp_delivered BOOLEAN DEFAULT true NOT NULL,
          token_expiry_days INTEGER DEFAULT 90 NOT NULL,
          created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
          updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
        )
      `).catch(err => console.warn('[BUSINZ Track Schema - Settings Table Warning]:', err.message));

      await query(`
        INSERT INTO public.company_tracking_settings (
          id, company_name, is_enabled, brand_color, support_phone, support_email
        ) VALUES (
          'SETTING-DEFAULT', 'VRM Structures India Private Limited', true, '#0E7490', '+91 98765 43210', 'support@vrmstructures.com'
        ) ON CONFLICT (company_name) DO NOTHING
      `).catch(() => {});

      // 2. Order Tracking Table
      await query(`
        CREATE TABLE IF NOT EXISTS public.order_tracking (
          id TEXT PRIMARY KEY,
          company_name TEXT DEFAULT 'VRM Structures India Private Limited' NOT NULL,
          bom_code TEXT UNIQUE NOT NULL,
          source_pi_no TEXT,
          tracking_token TEXT UNIQUE NOT NULL,
          token_hash TEXT NOT NULL,
          customer_name TEXT NOT NULL,
          customer_mobile TEXT NOT NULL,
          customer_email TEXT,
          status TEXT DEFAULT 'ACTIVE' NOT NULL,
          current_stage TEXT DEFAULT 'RECEIVED_BY_DISPATCH' NOT NULL,
          packing_percentage INTEGER DEFAULT 0 NOT NULL,
          access_count INTEGER DEFAULT 0 NOT NULL,
          last_accessed_at TIMESTAMPTZ,
          last_ip TEXT,
          last_user_agent TEXT,
          expires_at TIMESTAMPTZ NOT NULL,
          created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
          updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
        )
      `).catch(err => console.warn('[BUSINZ Track Schema - Tracking Table Warning]:', err.message));

      await query(`CREATE INDEX IF NOT EXISTS idx_order_tracking_bom_code ON public.order_tracking (bom_code)`).catch(() => {});
      await query(`CREATE INDEX IF NOT EXISTS idx_order_tracking_token_hash ON public.order_tracking (token_hash)`).catch(() => {});
      await query(`CREATE INDEX IF NOT EXISTS idx_order_tracking_source_pi ON public.order_tracking (source_pi_no)`).catch(() => {});

      // 3. Order Tracking Events Table
      await query(`
        CREATE TABLE IF NOT EXISTS public.order_tracking_events (
          id BIGSERIAL PRIMARY KEY,
          tracking_id TEXT NOT NULL REFERENCES public.order_tracking(id) ON DELETE CASCADE,
          bom_code TEXT NOT NULL,
          stage TEXT NOT NULL,
          title TEXT NOT NULL,
          description TEXT,
          actor_role TEXT,
          metadata JSONB DEFAULT '{}'::jsonb NOT NULL,
          created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
        )
      `).catch(err => console.warn('[BUSINZ Track Schema - Events Table Warning]:', err.message));

      await query(`CREATE INDEX IF NOT EXISTS idx_tracking_events_tracking_id ON public.order_tracking_events (tracking_id)`).catch(() => {});

      // 4. Order Tracking Shipments Table
      await query(`
        CREATE TABLE IF NOT EXISTS public.order_tracking_shipments (
          id TEXT PRIMARY KEY,
          tracking_id TEXT NOT NULL REFERENCES public.order_tracking(id) ON DELETE CASCADE,
          bom_code TEXT NOT NULL,
          shipment_number INTEGER DEFAULT 1 NOT NULL,
          shipment_reference TEXT NOT NULL,
          transporter_name TEXT,
          transport_mode TEXT DEFAULT 'ROAD',
          lr_no TEXT,
          lr_date DATE,
          lr_copy_url TEXT,
          vehicle_no TEXT,
          driver_name TEXT,
          driver_phone TEXT,
          packages_count INTEGER,
          bundles_count INTEGER,
          destination TEXT,
          status TEXT DEFAULT 'DISPATCHED' NOT NULL,
          dispatched_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
          delivered_at TIMESTAMPTZ,
          items JSONB DEFAULT '[]'::jsonb NOT NULL,
          photos JSONB DEFAULT '[]'::jsonb NOT NULL,
          created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
          updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
        )
      `).catch(err => console.warn('[BUSINZ Track Schema - Shipments Table Warning]:', err.message));

      // 5. Order Tracking Issues Table
      await query(`
        CREATE TABLE IF NOT EXISTS public.order_tracking_issues (
          id TEXT PRIMARY KEY,
          tracking_id TEXT NOT NULL REFERENCES public.order_tracking(id) ON DELETE CASCADE,
          bom_code TEXT NOT NULL,
          issue_type TEXT NOT NULL,
          customer_name TEXT NOT NULL,
          customer_phone TEXT NOT NULL,
          affected_items JSONB DEFAULT '[]'::jsonb NOT NULL,
          remarks TEXT,
          photos JSONB DEFAULT '[]'::jsonb NOT NULL,
          status TEXT DEFAULT 'OPEN' NOT NULL,
          resolution_notes TEXT,
          resolved_by TEXT,
          resolved_at TIMESTAMPTZ,
          created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
          updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
        )
      `).catch(err => console.warn('[BUSINZ Track Schema - Issues Table Warning]:', err.message));

      // 6. Tracking Notification Queue Table
      await query(`
        CREATE TABLE IF NOT EXISTS public.tracking_notification_queue (
          id TEXT PRIMARY KEY,
          tracking_id TEXT REFERENCES public.order_tracking(id) ON DELETE SET NULL,
          bom_code TEXT NOT NULL,
          customer_phone TEXT NOT NULL,
          customer_name TEXT NOT NULL,
          company_name TEXT NOT NULL,
          trigger_event TEXT NOT NULL,
          idempotency_key TEXT UNIQUE NOT NULL,
          channel TEXT DEFAULT 'META_CLOUD_API' NOT NULL,
          template_name TEXT NOT NULL,
          template_variables JSONB DEFAULT '[]'::jsonb NOT NULL,
          tracking_url TEXT,
          status TEXT DEFAULT 'PENDING' NOT NULL,
          retry_count INTEGER DEFAULT 0 NOT NULL,
          max_retries INTEGER DEFAULT 3 NOT NULL,
          error_message TEXT,
          meta_message_id TEXT,
          sent_at TIMESTAMPTZ,
          created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
          updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
        )
      `).catch(err => console.warn('[BUSINZ Track Schema - Queue Table Warning]:', err.message));

      isSchemaInitialized = true;
      console.log('✅ [BUSINZ Track] Schema verified & ready.');
      return true;
    } catch (err) {
      console.warn('[BUSINZ Track Schema Init Error]:', err.message);
      return false;
    } finally {
      schemaInitPromise = null;
    }
  })();

  return schemaInitPromise;
}

// Auto-run schema initialization non-blocking on startup
ensureTrackingSchema().catch(err => console.warn('[BUSINZ Track Boot Schema Notice]:', err.message));

/**
 * Generate cryptographically secure tracking token (64 hex characters)
 */
export function generateSecureTrackingToken() {
  return crypto.randomBytes(32).toString('hex');
}

/**
 * SHA-256 token hash for secure database indexing and timing-safe lookup
 */
export function hashTrackingToken(token) {
  if (!token || typeof token !== 'string') return '';
  return crypto.createHash('sha256').update(token.trim()).digest('hex');
}

/**
 * Standard 10 Stages Definition
 */
export const TRACKING_STAGES = [
  { id: 'ORDER_CONFIRMED', step: 1, label: 'Order Confirmed', description: 'Proforma Invoice converted to Bill of Materials and queued for production.' },
  { id: 'RECEIVED_BY_DISPATCH', step: 2, label: 'Received by Dispatch', description: 'Bill of Materials confirmed. Dispatch team scheduled materials for packing.' },
  { id: 'PACKING_IN_PROGRESS', step: 3, label: 'Packing in Progress', description: 'Warehouse dispatch team is actively picking and packing your items.' },
  { id: 'PACKING_COMPLETED', step: 4, label: 'Packing Completed', description: 'All product line items verified, weighed and packed securely.' },
  { id: 'ORDER_VERIFICATION', step: 5, label: 'Order Verification', description: 'Commercial verification and payment confirmation in progress.' },
  { id: 'INVOICE_GENERATED', step: 6, label: 'Invoice Generated', description: 'Official GST invoice and dispatch documents generated.' },
  { id: 'READY_FOR_LOADING', step: 7, label: 'Ready for Loading', description: 'Invoice confirmed. Order scheduled for vehicle bay placement.' },
  { id: 'LOADING_IN_PROGRESS', step: 8, label: 'Loading in Progress', description: 'Packed packages and bundles are being physically verified and loaded onto vehicle.' },
  { id: 'DISPATCHED', step: 9, label: 'Dispatched & In Transit', description: 'Consignment loaded onto vehicle and dispatched with carrier receipt.' },
  { id: 'DELIVERED', step: 10, label: 'Order Delivered', description: 'Products have been safely delivered to your destination.' }
];

/**
 * Derives customer-facing workflow stage from authoritative BOM order data
 */
export function deriveCustomerOrderStage(bom) {
  if (!bom) return { stage: 'UNKNOWN', label: 'Order Processing', stepIndex: 0, description: 'Order is being processed.' };
  const extra = bom.accounts_verification?._extra_data || {};
  const vehicleLoading = bom.vehicleLoading || extra.vehicleLoading || null;
  const dispatchedAt = bom.dispatchedAt || bom.dispatched_at || extra.dispatchedAt || extra.dispatched_at || vehicleLoading?.dispatchedAt || null;
  const completedAt = bom.completedAt || bom.completed_at || extra.completedAt || extra.completed_at || null;
  const lrDoc = bom.lrCopyDoc || extra.lrCopyDoc || vehicleLoading?.lrCopyDoc || null;
  const s = String(bom.status || '').toLowerCase();
  const rawStatus = String(extra.rawStatus || '').toLowerCase();
  const tabGroup = String(extra.tabGroup || '');
  const isCancelled = bom.cancelled || s.includes('cancel') || extra.cancelled;
  
  if (isCancelled) {
    return {
      stage: 'CANCELLED',
      label: 'Order Cancelled',
      description: 'This order has been cancelled through formal administrative approval.',
      stepIndex: -1,
      isTerminal: true
    };
  }

  // Stage 10: Delivered
  if (s.includes('delivered') || rawStatus.includes('delivered') || bom.deliveredAt || bom.delivery_confirmed_at || extra.deliveredAt) {
    return {
      stage: 'DELIVERED',
      label: 'Order Delivered',
      description: 'Products have been safely delivered to your destination.',
      stepIndex: 10,
      isCompleted: true
    };
  }

  // Stage 9: Dispatched
  const hasVehicleLoadingDispatch = Boolean(
    vehicleLoading && (
      vehicleLoading.fullyCompleted ||
      vehicleLoading.loadedAt ||
      vehicleLoading.lrNo ||
      vehicleLoading.lrNumber ||
      vehicleLoading.vehicleNo ||
      vehicleLoading.vehicleNumber ||
      vehicleLoading.transporter ||
      vehicleLoading.transporterName ||
      vehicleLoading.lrCopyDoc
    )
  );
  if (
    s.includes('dispatched') ||
    s === 'completed' ||
    rawStatus.includes('dispatched') ||
    rawStatus === 'completed' ||
    Boolean(dispatchedAt) ||
    Boolean(completedAt) ||
    Boolean(bom.fullyCompleted || extra.fullyCompleted) ||
    Boolean(lrDoc) ||
    hasVehicleLoadingDispatch ||
    Boolean((bom.lr_no && bom.lr_no !== 'Awaiting LR Copy') || (bom.vehicle_no && bom.vehicle_no !== 'Awaiting Loading'))
  ) {
    return {
      stage: 'DISPATCHED',
      label: 'Dispatched & In Transit',
      description: 'Consignment loaded onto vehicle and dispatched with carrier receipt.',
      stepIndex: 9,
      isCompleted: false
    };
  }

  // Stage 8: Loading in Progress
  if (
    rawStatus.includes('loading in progress') ||
    rawStatus.includes('loading verified') ||
    (vehicleLoading && !dispatchedAt && !completedAt)
  ) {
    return {
      stage: 'LOADING_IN_PROGRESS',
      label: 'Vehicle Loading in Progress',
      description: 'Packed packages and bundles are being physically verified and loaded onto vehicle.',
      stepIndex: 8,
      isCompleted: false
    };
  }

  // Stage 7: Ready for Loading
  if (
    tabGroup === 'AwaitingLoading' ||
    s.includes('awaiting loading') ||
    s.includes('awaiting vehicle loading') ||
    rawStatus.includes('awaiting vehicle loading')
  ) {
    return {
      stage: 'READY_FOR_LOADING',
      label: 'Ready for Loading',
      description: 'Invoice confirmed. Order scheduled for vehicle bay placement.',
      stepIndex: 7,
      isCompleted: false
    };
  }

  // Stage 6: Invoice Generated
  if (
    bom.invoice_no ||
    bom.invoice_confirmed ||
    bom.invoiceConfirmed ||
    s.includes('invoice') ||
    rawStatus.includes('invoice')
  ) {
    return {
      stage: 'INVOICE_GENERATED',
      label: 'Tax Invoice Generated',
      description: 'Official GST invoice and dispatch documents generated.',
      stepIndex: 6,
      isCompleted: false
    };
  }

  // Stage 5: Order Verification (Accounts)
  if (
    tabGroup === 'AccountsVerification' ||
    s.includes('accounts') ||
    bom.accounts_verification?.verified ||
    bom.accounts_verification?.readyForAccounts ||
    rawStatus.includes('accounts')
  ) {
    return {
      stage: 'ORDER_VERIFICATION',
      label: 'Accounts & Order Verification',
      description: 'Commercial verification and payment confirmation in progress.',
      stepIndex: 5,
      isCompleted: false
    };
  }

  // Stage 4: Packing Completed
  const packingStatus = bom.packingStatus || bom.accounts_verification?._extra_data?.packingStatus;
  const isPackingVerified = packingStatus === 'PACKING_VERIFIED' || s.includes('packing verified') || bom.accounts_verification?._extra_data?.packingCompletedAt;
  if (isPackingVerified) {
    return {
      stage: 'PACKING_COMPLETED',
      label: 'Packing Completed',
      description: 'All product line items verified, weighed and packed securely.',
      stepIndex: 4,
      isCompleted: false
    };
  }

  // Stage 3: Packing in Progress
  const dispatchPacking = Array.isArray(bom.dispatch_packing) ? bom.dispatch_packing : (Array.isArray(bom.dispatchPacking) ? bom.dispatchPacking : []);
  const packedItemsCount = dispatchPacking.filter(p => Boolean(p.packed || (Number(p.qty) > 0 && Number(p.qty) >= Number(p.bomQty || p.orderedQty)))).length;
  if (packingStatus === 'PARTIALLY_PACKED' || packedItemsCount > 0 || s.includes('packing in progress') || s.includes('partially packed')) {
    return {
      stage: 'PACKING_IN_PROGRESS',
      label: 'Packing in Progress',
      description: 'Warehouse dispatch team is actively picking and packing your items.',
      stepIndex: 3,
      isCompleted: false
    };
  }

  // Stage 2: Received by Dispatch
  if (
    bom.sales_confirmed ||
    bom.salesConfirmed ||
    s.includes('dispatch') ||
    s.includes('production') ||
    s.includes('confirmed')
  ) {
    return {
      stage: 'RECEIVED_BY_DISPATCH',
      label: 'Received by Dispatch Team',
      description: 'Bill of Materials confirmed. Dispatch team scheduled materials for packing.',
      stepIndex: 2,
      isCompleted: false
    };
  }

  // Stage 1: Order Confirmed
  return {
    stage: 'ORDER_CONFIRMED',
    label: 'Order Confirmed',
    description: 'Proforma Invoice converted to Bill of Materials and queued for production.',
    stepIndex: 1,
    isCompleted: false
  };
}

/**
 * Calculates line-item packing progress accurately without mixing UOMs
 */
export function calculatePackingProgress(bom) {
  const items = Array.isArray(bom.items) ? bom.items : [];
  const dispatchPacking = Array.isArray(bom.dispatch_packing) ? bom.dispatch_packing : (Array.isArray(bom.dispatchPacking) ? bom.dispatchPacking : []);
  
  if (items.length === 0) {
    return {
      percentage: 0,
      totalLines: 0,
      packedLines: 0,
      pendingLines: 0,
      summaryText: '0 of 0 product lines packed',
      products: []
    };
  }

  // Map packed quantities by product code or name
  const packingMap = new Map();
  for (const p of dispatchPacking) {
    const key = String(p.code || p.name || '').trim().toLowerCase();
    if (key) {
      packingMap.set(key, {
        packedQty: Number(p.qty || p.packedQty || 0),
        isPacked: Boolean(p.packed)
      });
    }
  }

  let packedLines = 0;
  const processedProducts = items.map((item, idx) => {
    const code = String(item.code || '').trim();
    const name = String(item.name || item.desc || `Product #${idx + 1}`).trim();
    const orderedQty = Math.max(0, Number(item.qty || item.baseQty || 0));
    const uom = String(item.uom || 'NOS').toUpperCase();

    const lookupKey = (code || name).toLowerCase();
    const packInfo = packingMap.get(lookupKey) || packingMap.get(code.toLowerCase()) || packingMap.get(name.toLowerCase());
    
    let packedQty = packInfo ? Math.min(orderedQty, Math.max(0, Number(packInfo.packedQty || 0))) : 0;
    if (packInfo?.isPacked && packedQty === 0) {
      packedQty = orderedQty; // Fallback if binary packed flag is set
    }
    const pendingQty = Math.max(0, orderedQty - packedQty);

    const isFullyPacked = packedQty >= orderedQty && orderedQty > 0;
    if (isFullyPacked) {
      packedLines++;
    }

    let status = 'PENDING';
    if (isFullyPacked) {
      status = 'FULLY_PACKED';
    } else if (packedQty > 0) {
      status = 'PARTIALLY_PACKED';
    }

    return {
      code: code || `ITM-${idx + 1}`,
      name,
      orderedQty,
      packedQty,
      pendingQty,
      dispatchedQty: 0,
      pendingDispatchQty: packedQty,
      uom,
      category: item.category || 'General',
      status,
      isFullyPacked
    };
  });

  const totalLines = processedProducts.length;
  const percentage = totalLines > 0 ? Math.round((packedLines / totalLines) * 100) : 0;

  return {
    percentage,
    totalLines,
    packedLines,
    pendingLines: Math.max(0, totalLines - packedLines),
    summaryText: `${percentage}% Packing Completed — ${packedLines} of ${totalLines} product lines fully packed`,
    products: processedProducts
  };
}

/**
 * Customer Document Centre Resolver
 * Sanitizes internal commercial data (purchase cost, supplier, internal remarks)
 */
export async function resolveCustomerDocuments(bom, tracking = {}) {
  const documents = [];
  const bomCode = bom.bom_code || bom.bomCode || bom.code || '';
  const invNo = bom.invoice_no || bom.invoiceNo || '';
  const docToken = tracking?.tracking_token || bomCode;

  // 1. Itemized Packing List (shows full / partial packed quantities)
  const isPackingReady = Boolean(
    bom.packingStatus === 'PACKING_VERIFIED' ||
    bom.packingStatus === 'PARTIALLY_PACKED' ||
    (Array.isArray(bom.dispatch_packing) && bom.dispatch_packing.length > 0) ||
    (Array.isArray(bom.dispatchPacking) && bom.dispatchPacking.length > 0) ||
    bom.accounts_verification?._extra_data?.packingCompletedAt ||
    bom.status?.includes('Packed') ||
    bom.status?.includes('Dispatched')
  );
  documents.push({
    type: 'PACKING_LIST',
    title: 'Itemized Packing List',
    docNumber: `PL-${bomCode}`,
    status: isPackingReady ? 'AVAILABLE' : 'AWAITING_UPLOAD',
    available: isPackingReady,
    date: bom.accounts_verification?._extra_data?.packingCompletedAt || null,
    url: isPackingReady ? `/api/track/${encodeURIComponent(docToken)}/documents/packing-list` : null
  });

  // 2. Tax Invoice
  const attachedInvoiceDocs = Array.isArray(bom.attachedInvoiceDocs)
    ? bom.attachedInvoiceDocs
    : (Array.isArray(bom.accounts_verification?._extra_data?.attachedInvoiceDocs) ? bom.accounts_verification._extra_data.attachedInvoiceDocs : []);
  const isInvoiceReady = Boolean((invNo && (bom.invoice_confirmed || bom.invoiceConfirmed || bom.status?.includes('Dispatched'))) || attachedInvoiceDocs.length > 0);
  documents.push({
    type: 'TAX_INVOICE',
    title: 'Official Tax Invoice',
    docNumber: invNo || (attachedInvoiceDocs.length > 0 ? 'Attached' : 'Awaiting Billing'),
    status: isInvoiceReady ? 'AVAILABLE' : 'NOT_YET_GENERATED',
    available: isInvoiceReady,
    date: bom.accounts_verification?._extra_data?.invoiceConfirmedAt || null,
    url: isInvoiceReady ? `/api/track/${encodeURIComponent(docToken)}/documents/tax-invoice` : null
  });

  // 3. Lorry Receipt (LR Copy) / Transporter Consignment Note
  const extraDocData = bom.accounts_verification?._extra_data || {};
  const vlDocData = bom.vehicleLoading || extraDocData.vehicleLoading || {};
  const lrDoc = bom.lrCopyDoc || extraDocData.lrCopyDoc || vlDocData.lrCopyDoc;
  const rawLrCandidates = [bom.lr_no, bom.lrNo, extraDocData.lrNo, vlDocData.lrNumber, vlDocData.lrNo];
  const lrNo = rawLrCandidates.find(v => {
    const t = String(v || '').trim();
    return t && t !== 'Awaiting LR Copy' && t !== 'Awaiting Carrier Dispatch';
  }) || '';
  const isLrAvailable = Boolean(lrDoc || lrNo);
  documents.push({
    type: 'LR_COPY',
    title: 'Lorry Receipt (LR Copy)',
    docNumber: lrNo || (lrDoc ? 'Attached' : 'Awaiting Carrier'),
    status: isLrAvailable ? 'AVAILABLE' : 'AWAITING_UPLOAD',
    available: isLrAvailable,
    date: bom.dispatchedAt || bom.dispatched_at || extraDocData.dispatchedAt || vlDocData.loadedAt || null,
    url: lrDoc ? `/api/track/${encodeURIComponent(docToken)}/documents/lr-copy` : null
  });

  // 4. Delivery Challan — ONLY shown when DC is actually issued/updated by Billing/Invoice team
  const dcNo = String(
    bom.deliveryChallanNo ||
    bom.dcNo ||
    bom.delivery_challan_no ||
    bom.accounts_verification?._extra_data?.deliveryChallanNo ||
    bom.accounts_verification?._extra_data?.dcNo ||
    ''
  ).trim();
  if (dcNo) {
    documents.push({
      type: 'DELIVERY_CHALLAN',
      title: 'Delivery Challan (DC)',
      docNumber: dcNo,
      status: 'AVAILABLE',
      available: true,
      date: bom.dispatchedAt || bom.accounts_verification?._extra_data?.dcIssuedAt || null,
      url: `/api/track/${encodeURIComponent(docToken)}/documents/delivery-challan`
    });
  }

  return documents;
}

/**
 * Builds the comprehensive 10-stage timeline with timestamps and completion states
 */
export function buildTimeline(currentStageInfo, events = [], bom = {}) {
  const currentStep = currentStageInfo.stepIndex || 1;
  const isCancelled = currentStageInfo.stage === 'CANCELLED';

  // Map events by stage to extract actual recorded timestamps
  const eventMap = new Map();
  for (const ev of events) {
    if (!eventMap.has(ev.stage)) {
      eventMap.set(ev.stage, ev.created_at);
    }
  }

  // Fallback timestamp extractors from BOM
  const extraTs = bom.accounts_verification?._extra_data || {};
  const vlTs = bom.vehicleLoading || extraTs.vehicleLoading || {};
  const timestamps = {
    ORDER_CONFIRMED: bom.created_at || bom.date || eventMap.get('ORDER_CONFIRMED'),
    RECEIVED_BY_DISPATCH: bom.sales_confirmed_at || bom.salesConfirmedAt || bom.created_at || eventMap.get('RECEIVED_BY_DISPATCH'),
    PACKING_IN_PROGRESS: bom.packingStartedAt || eventMap.get('PACKING_IN_PROGRESS'),
    PACKING_COMPLETED: extraTs.packingCompletedAt || eventMap.get('PACKING_COMPLETED'),
    ORDER_VERIFICATION: extraTs.accountsVerifiedAt || eventMap.get('ORDER_VERIFICATION'),
    INVOICE_GENERATED: extraTs.invoiceConfirmedAt || bom.invoice_date || eventMap.get('INVOICE_GENERATED'),
    READY_FOR_LOADING: bom.readyForLoadingAt || eventMap.get('READY_FOR_LOADING'),
    LOADING_IN_PROGRESS: bom.loadingStartedAt || vlTs.loadedAt || eventMap.get('LOADING_IN_PROGRESS'),
    DISPATCHED: bom.dispatchedAt || bom.dispatched_at || extraTs.dispatchedAt || extraTs.completedAt || vlTs.dispatchedAt || vlTs.loadedAt || eventMap.get('DISPATCHED'),
    DELIVERED: bom.deliveredAt || bom.delivery_confirmed_at || extraTs.deliveredAt || eventMap.get('DELIVERED')
  };

  return TRACKING_STAGES.map((s) => {
    let state = 'PENDING'; // 'COMPLETED', 'CURRENT', 'PENDING'
    if (isCancelled) {
      state = 'PENDING';
    } else if (s.step < currentStep) {
      state = 'COMPLETED';
    } else if (s.step === currentStep) {
      state = currentStageInfo.isCompleted ? 'COMPLETED' : 'CURRENT';
    }

    return {
      stageId: s.id,
      step: s.step,
      label: s.label,
      description: s.description,
      state,
      timestamp: timestamps[s.id] || (state === 'COMPLETED' ? bom.updated_at : null)
    };
  });
}

/**
 * Get or create unique tracking token & reference for a valid BOM order
 */
export async function getOrCreateOrderTracking(bom, options = {}) {
  if (!bom) throw new Error('BOM order is required to generate tracking');
  const bomCode = String(bom.bom_code || bom.bomCode || bom.code || bom.id || '').trim();
  if (!bomCode) throw new Error('Valid BOM Code is required for order tracking');

  await ensureTrackingSchema().catch(() => {});

  const sourcePiNo = String(bom.source_pi_no || bom.sourcePiNo || '').trim() || null;
  const customerName = String(bom.customer_name || bom.customerName || bom.company_name || bom.companyName || 'Valued Customer').trim();
  const customerMobile = String(bom.mobile || bom.phone || '').replace(/[^0-9]/g, '');
  const customerEmail = String(bom.email || '').trim() || null;
  const companyName = String(bom.company_name || 'VRM Structures India Private Limited').trim();

  // 1. Check if tracking already exists for this BOM
  let existing = null;
  try {
    const existingRes = await query(
      `SELECT * FROM public.order_tracking WHERE bom_code = $1 LIMIT 1`,
      [bomCode]
    );
    if (existingRes.rows.length > 0) {
      existing = existingRes.rows[0];
    }
  } catch (err) {
    console.warn('[getOrCreateOrderTracking check warning]:', err.message);
  }

  if (existing) {
    const stageInfo = deriveCustomerOrderStage(bom);
    const packingProg = calculatePackingProgress(bom);

    try {
      await query(
        `UPDATE public.order_tracking 
         SET current_stage = $1, packing_percentage = $2, customer_mobile = COALESCE(NULLIF($3, ''), customer_mobile), updated_at = NOW()
         WHERE id = $4`,
        [stageInfo.stage, packingProg.percentage, customerMobile, existing.id]
      );

      // If stage changed, record stage event
      if (existing.current_stage !== stageInfo.stage) {
        await query(
          `INSERT INTO public.order_tracking_events (
            tracking_id, bom_code, stage, title, description, actor_role, metadata
          ) VALUES (
            $1, $2, $3, $4, $5, 'System', $6
          )`,
          [
            existing.id,
            bomCode,
            stageInfo.stage,
            stageInfo.label,
            stageInfo.description,
            JSON.stringify({ packingPercentage: packingProg.percentage })
          ]
        ).catch(() => {});
      }
    } catch (_) {}

    return {
      ...existing,
      current_stage: stageInfo.stage,
      packing_percentage: packingProg.percentage,
      tracking_url: `https://${process.env.TRACKING_DOMAIN || 'track.businz.com'}/order/${existing.tracking_token}`
    };
  }

  // 2. Generate new cryptographically secure token
  const trackingId = `TRK-${Date.now().toString(36).toUpperCase()}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;
  const trackingToken = generateSecureTrackingToken();
  const tokenHash = hashTrackingToken(trackingToken);
  
  const expiryDays = options.expiryDays || 90;
  const expiresAt = new Date(Date.now() + expiryDays * 24 * 60 * 60 * 1000);

  const stageInfo = deriveCustomerOrderStage(bom);
  const packingProg = calculatePackingProgress(bom);

  let newRecord = null;
  try {
    const insertRes = await query(
      `INSERT INTO public.order_tracking (
        id, company_name, bom_code, source_pi_no, tracking_token, token_hash,
        customer_name, customer_mobile, customer_email, status, current_stage,
        packing_percentage, expires_at, created_at, updated_at
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, 'ACTIVE', $10, $11, $12, NOW(), NOW()
      ) 
      ON CONFLICT (bom_code) DO UPDATE 
        SET current_stage = EXCLUDED.current_stage, packing_percentage = EXCLUDED.packing_percentage, updated_at = NOW()
      RETURNING *`,
      [
        trackingId, companyName, bomCode, sourcePiNo, trackingToken, tokenHash,
        customerName, customerMobile, customerEmail, stageInfo.stage,
        packingProg.percentage, expiresAt
      ]
    );
    newRecord = insertRes.rows[0];
  } catch (err) {
    console.warn('[getOrCreateOrderTracking insert notice]:', err.message);
  }

  if (!newRecord) {
    newRecord = {
      id: trackingId,
      company_name: companyName,
      bom_code: bomCode,
      source_pi_no: sourcePiNo,
      tracking_token: trackingToken,
      token_hash: tokenHash,
      customer_name: customerName,
      customer_mobile: customerMobile,
      customer_email: customerEmail,
      status: 'ACTIVE',
      current_stage: stageInfo.stage,
      packing_percentage: packingProg.percentage,
      expires_at: expiresAt,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
  }

  // 3. Record initial tracking creation event
  try {
    await query(
      `INSERT INTO public.order_tracking_events (
        tracking_id, bom_code, stage, title, description, actor_role, metadata
      ) VALUES (
        $1, $2, $3, $4, $5, 'System', $6
      )`,
      [
        newRecord.id || trackingId,
        bomCode,
        stageInfo.stage,
        'Order Tracking Initialized',
        `Live tracking reference generated for ${customerName}.`,
        JSON.stringify({ bomCode, sourcePiNo, customerMobile })
      ]
    ).catch(() => {});
  } catch (_) {}

  // 4. Automatically queue initial WhatsApp notification if customer mobile is present
  if (customerMobile && customerMobile.length >= 10) {
    queueTrackingNotification({
      trackingId: newRecord.id || trackingId,
      bomCode,
      customerPhone: customerMobile,
      customerName,
      companyName,
      triggerEvent: 'DISPATCH_RECEIVED',
      templateName: 'order_tracking_started',
      trackingUrl: `https://${process.env.TRACKING_DOMAIN || 'track.businz.com'}/order/${newRecord.tracking_token || trackingToken}`
    }).catch(() => {});
  }

  return {
    ...newRecord,
    tracking_url: `https://${process.env.TRACKING_DOMAIN || 'track.businz.com'}/order/${newRecord.tracking_token || trackingToken}`
  };
}

/**
 * Builds standard, complete, and sanitized customer tracking payload
 */
export async function buildCustomerTrackingResponse(bom, tracking = null, companySettings = null) {
  const settings = companySettings || {
    company_name: bom?.company_name || 'VRM Structures India Private Limited',
    brand_color: '#0E7490',
    support_phone: '+91 98765 43210',
    support_email: 'support@businz.com',
    show_packing_photos: true,
    show_loading_photos: true,
    show_driver_phone: true
  };

  const bomCode = String(bom?.bom_code || bom?.bomCode || bom?.code || bom?.id || tracking?.bom_code || '').trim();
  let currentStage = deriveCustomerOrderStage(bom);
  if (tracking?.current_stage === 'DELIVERED' && currentStage.stage !== 'DELIVERED') {
    currentStage = {
      stage: 'DELIVERED',
      label: 'Order Delivered',
      description: 'Products have been safely delivered to your destination.',
      stepIndex: 10,
      isCompleted: true
    };
  }

  let timeline = [];
  if (tracking?.id) {
    const eventsRes = await query(
      `SELECT * FROM public.order_tracking_events WHERE tracking_id = $1 ORDER BY created_at ASC`,
      [tracking.id]
    ).catch(() => ({ rows: [] }));
    timeline = buildTimeline(currentStage, eventsRes.rows || [], bom);
  } else {
    timeline = buildTimeline(currentStage, [], bom);
  }

  let packingProgress = calculatePackingProgress(bom || {});
  if (packingProgress.totalLines === 0 && tracking?.packing_percentage > 0) {
    packingProgress.percentage = tracking.packing_percentage;
    packingProgress.summaryText = `${tracking.packing_percentage}% Packing Completed`;
  }

  const documents = await resolveCustomerDocuments(bom || {}, tracking || {});

  let shipments = [];
  if (tracking?.id) {
    const shipmentsRes = await query(
      `SELECT * FROM public.order_tracking_shipments WHERE tracking_id = $1 ORDER BY shipment_number ASC`,
      [tracking.id]
    ).catch(() => ({ rows: [] }));
    shipments = shipmentsRes.rows || [];
  }

  const normalizePhotoList = (rawList, category) => {
    if (!Array.isArray(rawList)) return [];
    return rawList.map((item, idx) => {
      if (!item) return null;
      if (typeof item === 'string') {
        return { id: `${category}-${idx}`, url: item, name: `${category} Photo ${idx + 1}`, category };
      }
      let resolvedUrl = item.url || item.dataUrl || '';
      if (!resolvedUrl && item.storagePath) {
        const cleanSp = String(item.storagePath).replace(/^\/+/, '').replace(/^bom-documents\//, '');
        resolvedUrl = `/api/uploads/bom-documents/${cleanSp}`;
      }
      if (!resolvedUrl) return null;
      return {
        id: item.id || `${category}-${idx}`,
        url: resolvedUrl,
        name: item.name || item.originalName || `${category} Photo ${idx + 1}`,
        uploadedAt: item.uploadedAt || null,
        category
      };
    }).filter(Boolean);
  };

  const rawPackingPhotos =
    bom?.dispatchPackingMedia?.photos ||
    bom?.dispatch_packing_media?.photos ||
    bom?.accounts_verification?._extra_data?.dispatchPackingMedia?.photos ||
    [];
  const packingPhotos = settings.show_packing_photos !== false
    ? normalizePhotoList(rawPackingPhotos, 'Packing')
    : [];

  const extra = bom?.accounts_verification?._extra_data || {};
  const vehicleLoading = bom?.vehicleLoading || extra.vehicleLoading || {};
  const loadingPhotos = settings.show_loading_photos !== false
    ? normalizePhotoList(vehicleLoading.photos || [], 'Vehicle Loading')
    : [];

  const rawMode = String(bom?.transport_mode || bom?.transportMode || bom?.deliveryMode || extra.deliveryMode || vehicleLoading.deliveryMode || vehicleLoading.transportMode || '').trim().toLowerCase();
  const rawTransporter = String(bom?.transporter_name || bom?.transporterName || bom?.transporter || extra.transporterName || extra.transporter || vehicleLoading.transporterName || vehicleLoading.transporter || '').trim().toLowerCase();
  const isNoLrMode =
    rawMode.includes('porter') ||
    rawMode.includes('portal') ||
    rawMode.includes('self') ||
    rawMode.includes('direct') ||
    rawMode.includes('pickup') ||
    rawMode.includes('own') ||
    rawTransporter.includes('porter') ||
    rawTransporter.includes('self') ||
    rawTransporter.includes('direct');
  const lrDoc = bom?.lrCopyDoc || extra.lrCopyDoc || vehicleLoading.lrCopyDoc || null;
  const cleanLrVal = (val) => {
    const t = String(val || '').trim();
    if (!t || t === 'Awaiting LR Copy' || t === 'Awaiting Carrier Dispatch') return '';
    return t;
  };
  const resolvedLrNumber =
    cleanLrVal(bom?.lr_no) ||
    cleanLrVal(bom?.lrNo) ||
    cleanLrVal(extra.lrNo) ||
    cleanLrVal(vehicleLoading.lrNumber) ||
    cleanLrVal(vehicleLoading.lrNo) ||
    (lrDoc ? 'LR Copy Attached' : (bom?.lr_no || vehicleLoading.lrNo || 'Awaiting Carrier Dispatch'));

  const resolvedVehicleNumber =
    String(bom?.vehicle_no || bom?.vehicleNo || extra.vehicleNo || vehicleLoading.vehicleNumber || vehicleLoading.vehicleNo || '').trim() ||
    (isNoLrMode ? (bom?.transport_mode || vehicleLoading.transportMode || 'Direct / Pickup') : (currentStage?.stage === 'DISPATCHED' || currentStage?.stage === 'DELIVERED' ? 'Dispatched via Carrier' : 'Awaiting Loading'));

  const transport = {
    transporterName: bom?.transporter_name || bom?.transporterName || bom?.transporter || extra.transporterName || extra.transporter || vehicleLoading.transporterName || vehicleLoading.transporter || 'Pending Carrier Assignment',
    transportMode: bom?.transport_mode || bom?.transportMode || extra.transportMode || vehicleLoading.transportMode || 'Road Transport',
    lrNumber: resolvedLrNumber,
    vehicleNumber: resolvedVehicleNumber,
    driverName: vehicleLoading.driverName || extra.driverName || 'Designated Driver',
    driverPhone: settings.show_driver_phone ? (vehicleLoading.driverPhone || extra.driverPhone || null) : null,
    loadingDate: bom?.dispatchedAt || bom?.dispatched_at || extra.dispatchedAt || vehicleLoading.loadedAt || vehicleLoading.loadingDate || null,
    packagesCount: vehicleLoading.packagesCount || null,
    bundlesCount: vehicleLoading.bundlesCount || null,
    requiresLrCopy: !isNoLrMode,
    hasLrCopy: Boolean(lrDoc),
    loadingPhotos
  };

  return {
    success: true,
    order: {
      trackingId: tracking?.id || `TRK-${bomCode}`,
      trackingToken: tracking?.tracking_token || bomCode,
      bomCode,
      piNumber: bom?.source_pi_no || bom?.sourcePiNo || tracking?.source_pi_no || 'N/A',
      customerName: bom?.customer_name || bom?.customerName || bom?.company_name || bom?.companyName || tracking?.customer_name || 'Valued Customer',
      companyName: settings.company_name,
      createdAt: tracking?.created_at || bom?.created_at || bom?.createdAt || new Date().toISOString(),
      lastUpdatedAt: tracking?.updated_at || bom?.updated_at || bom?.updatedAt || new Date().toISOString(),
      status: tracking?.status || 'ACTIVE',
      currentStage,
      packingProgress,
      packingPhotos,
      timeline,
      documents,
      transport,
      shipments,
      companyBranding: {
        companyName: settings.company_name,
        brandColor: settings.brand_color,
        logoUrl: settings.logo_url || null,
        supportPhone: settings.support_phone,
        supportEmail: settings.support_email
      }
    }
  };
}

/**
 * Public Customer Tracking Resolver (Token-based)
 */
export async function getTrackingByToken(rawToken, { clientIp = '', userAgent = '' } = {}) {
  if (!rawToken || typeof rawToken !== 'string') {
    return { notFound: true, message: 'Valid tracking token is required.' };
  }

  // Ensure database schema is initialized
  await ensureTrackingSchema().catch(() => {});

  const cleanRaw = String(rawToken || '').trim();
  let decodedToken = cleanRaw;
  try {
    decodedToken = decodeURIComponent(cleanRaw).trim();
  } catch (_) {}

  // Generate robust variants to match slashes, hyphens, and casing
  const variants = Array.from(new Set([
    cleanRaw,
    decodedToken,
    cleanRaw.replace(/\//g, '-'),
    decodedToken.replace(/\//g, '-'),
    cleanRaw.replace(/-/g, '/'),
    decodedToken.replace(/-/g, '/'),
    cleanRaw.replace(/^VRMS/i, 'VRM'),
    cleanRaw.replace(/^VRM/i, 'VRMS'),
    decodedToken.replace(/^VRMS/i, 'VRM'),
    decodedToken.replace(/^VRM/i, 'VRMS'),
    cleanRaw.replace(/^VRMS/i, 'VRM').replace(/\//g, '-'),
    cleanRaw.replace(/^VRMS/i, 'VRM').replace(/-/g, '/'),
    cleanRaw.replace(/^VRM/i, 'VRMS').replace(/\//g, '-'),
    cleanRaw.replace(/^VRM/i, 'VRMS').replace(/-/g, '/'),
    decodedToken.replace(/^VRMS/i, 'VRM').replace(/\//g, '-'),
    decodedToken.replace(/^VRMS/i, 'VRM').replace(/-/g, '/'),
    decodedToken.replace(/^VRM/i, 'VRMS').replace(/\//g, '-'),
    decodedToken.replace(/^VRM/i, 'VRMS').replace(/-/g, '/')
  ])).filter(Boolean);

  const tokenHash = hashTrackingToken(decodedToken);
  const rawHash = hashTrackingToken(cleanRaw);

  // 1. Query order_tracking table
  let trackRes = { rows: [] };
  try {
    trackRes = await query(
      `SELECT * FROM public.order_tracking 
       WHERE token_hash = $1 OR token_hash = $2 
          OR tracking_token = ANY($3::text[]) 
          OR bom_code = ANY($3::text[]) 
          OR LOWER(bom_code) = ANY($4::text[]) LIMIT 1`,
      [tokenHash, rawHash, variants, variants.map(v => v.toLowerCase())]
    );
  } catch (err) {
    console.warn('[getTrackingByToken DB Query Notice]:', err.message);
  }

  let tracking = trackRes.rows[0] || null;

  // 1b. If not found in order_tracking, search authoritative BOM in PostgreSQL
  let bom = null;
  if (!tracking) {
    try {
      const bomRes = await query(
        `SELECT * FROM public.bom_orders 
         WHERE bom_code = ANY($1::text[]) 
            OR code = ANY($1::text[]) 
            OR id = ANY($1::text[])
            OR LOWER(bom_code) = ANY($2::text[])
            OR LOWER(code) = ANY($2::text[])
            OR LOWER(id) = ANY($2::text[])
            OR source_pi_no = ANY($1::text[])
         LIMIT 1`,
        [variants, variants.map(v => v.toLowerCase())]
      );
      if (bomRes.rows.length > 0) {
        const rawBom = bomRes.rows[0];
        bom = rawBom.bom_data ? { ...rawBom.bom_data, ...rawBom } : rawBom;
      }
    } catch (e) {
      console.warn('[getTrackingByToken bom_orders Notice]:', e.message);
    }
  }

  // 1c. If still not in DB, search JSON disk store / memory fallback
  if (!tracking && !bom) {
    try {
      const fs = await import('fs');
      const path = await import('path');
      const storeFile = path.resolve(process.cwd(), 'server', 'bom_store.json');
      if (fs.existsSync(storeFile)) {
        const fileContent = fs.readFileSync(storeFile, 'utf8');
        const boms = JSON.parse(fileContent);
        if (Array.isArray(boms)) {
          const matched = boms.find(b => {
            if (!b) return false;
            const bCode = String(b.bomCode || b.code || b.id || '').toUpperCase();
            const bPi = String(b.sourcePiNo || b.source_pi_no || '').toUpperCase();
            return variants.some(v => {
              const u = v.toUpperCase();
              return bCode === u || bPi === u || bCode.includes(u) || u.includes(bCode);
            });
          });
          if (matched) {
            bom = matched;
          }
        }
      }
    } catch (e) {
      console.warn('[getTrackingByToken JSON Search Notice]:', e.message);
    }

    // 1d. Search public.controlroom_store JSON fallback
    if (!bom) {
      try {
        const crRes = await query(
          `SELECT data FROM public.controlroom_store WHERE key = 'bom_store' LIMIT 1`
        ).catch(() => ({ rows: [] }));
        if (crRes.rows && crRes.rows.length > 0 && Array.isArray(crRes.rows[0].data)) {
          const boms = crRes.rows[0].data;
          const matched = boms.find(b => {
            if (!b) return false;
            const bCode = String(b.bomCode || b.bom_code || b.code || b.id || '').toUpperCase();
            const bPi = String(b.sourcePiNo || b.source_pi_no || '').toUpperCase();
            return variants.some(v => {
              const u = v.toUpperCase();
              return bCode === u || bPi === u || bCode.includes(u) || u.includes(bCode);
            });
          });
          if (matched) {
            bom = matched;
          }
        }
      } catch (e) {
        console.warn('[getTrackingByToken controlroom_store Notice]:', e.message);
      }
    }
  }

  // If found BOM, ensure tracking record exists or generate on-the-fly
  if (!tracking && bom) {
    try {
      const autoTrack = await getOrCreateOrderTracking(bom);
      if (autoTrack) {
        tracking = autoTrack;
      }
    } catch (e) {
      console.warn('[Auto-create tracking record notice]:', e.message);
    }
  }

  // If neither tracking nor bom is found
  if (!tracking && !bom) {
    return { notFound: true, message: 'Invalid or unknown tracking link.' };
  }

  // 2. Check if revoked or expired
  if (tracking?.status === 'REVOKED') {
    return { revoked: true, message: 'This tracking link has been deactivated for security reasons.' };
  }
  const now = new Date();
  if (tracking?.expires_at && new Date(tracking.expires_at) < now) {
    return { expired: true, message: 'This tracking link has expired.' };
  }

  // 3. Increment access count & update access stats
  if (tracking?.id) {
    try {
      await query(
        `UPDATE public.order_tracking 
         SET access_count = access_count + 1, last_accessed_at = NOW(), last_ip = $1, last_user_agent = $2
         WHERE id = $3`,
        [clientIp, (userAgent || '').substring(0, 255), tracking.id]
      ).catch(() => {});
    } catch (_) {}
  }

  // 4. Retrieve authoritative BOM data from PostgreSQL if not yet loaded
  if (!bom && tracking?.bom_code) {
    try {
      const bomRes = await query(
        `SELECT * FROM public.bom_orders 
         WHERE code = $1 OR bom_code = $1 OR id = $1 LIMIT 1`,
        [tracking.bom_code]
      );
      if (bomRes.rows.length > 0) {
        const raw = bomRes.rows[0];
        bom = raw.bom_data ? { ...raw.bom_data, ...raw } : raw;
      }
    } catch (_) {}
  }

  if (!bom) {
    bom = {
      bom_code: tracking?.bom_code || cleanRaw,
      customer_name: tracking?.customer_name || 'Valued Customer',
      mobile: tracking?.customer_mobile || '',
      items: [],
      status: tracking?.current_stage || 'In Progress'
    };
  }

  // 5. Get company tracking settings
  let companySettings = null;
  try {
    const settingsRes = await query(
      `SELECT * FROM public.company_tracking_settings LIMIT 1`
    );
    companySettings = settingsRes.rows[0];
  } catch (_) {}

  // 6. Build unified response
  return await buildCustomerTrackingResponse(bom, tracking, companySettings);
}

/**
 * Customer Issue Submission
 */
export async function submitCustomerIssue(token, { issueType, customerName, customerPhone, affectedItems = [], remarks = '', photos = [] }) {
  const tokenHash = hashTrackingToken(token);
  const trackRes = await query(
    `SELECT * FROM public.order_tracking WHERE (token_hash = $1 OR tracking_token = $2) AND status = 'ACTIVE' LIMIT 1`,
    [tokenHash, token]
  );

  if (trackRes.rows.length === 0) {
    throw new Error('Invalid or expired tracking link.');
  }

  const tracking = trackRes.rows[0];
  const issueId = `ISSUE-${Date.now().toString(36).toUpperCase()}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;

  const res = await query(
    `INSERT INTO public.order_tracking_issues (
      id, tracking_id, bom_code, issue_type, customer_name, customer_phone,
      affected_items, remarks, photos, status, created_at, updated_at
    ) VALUES (
      $1, $2, $3, $4, $5, $6, $7, $8, $9, 'OPEN', NOW(), NOW()
    ) RETURNING *`,
    [
      issueId,
      tracking.id,
      tracking.bom_code,
      issueType || 'OTHER',
      customerName || tracking.customer_name,
      customerPhone || tracking.customer_mobile,
      JSON.stringify(affectedItems),
      remarks,
      JSON.stringify(photos)
    ]
  );

  // Record tracking event
  await query(
    `INSERT INTO public.order_tracking_events (
      tracking_id, bom_code, stage, title, description, actor_role, metadata
    ) VALUES (
      $1, $2, $3, 'Customer Reported Issue', $4, 'Customer', $5
    )`,
    [
      tracking.id,
      tracking.bom_code,
      tracking.current_stage,
      `Issue reported: ${issueType} — "${remarks}"`,
      JSON.stringify({ issueId, issueType, customerPhone })
    ]
  );

  return res.rows[0];
}

/**
 * Customer Delivery Confirmation
 */
export async function confirmCustomerDelivery(token, { customerName, remarks = '', rating = 5 }) {
  const tokenHash = hashTrackingToken(token);
  const trackRes = await query(
    `SELECT * FROM public.order_tracking WHERE (token_hash = $1 OR tracking_token = $2) AND status = 'ACTIVE' LIMIT 1`,
    [tokenHash, token]
  );

  if (trackRes.rows.length === 0) {
    throw new Error('Invalid or expired tracking link.');
  }

  const tracking = trackRes.rows[0];

  // Update tracking current stage to DELIVERED
  await query(
    `UPDATE public.order_tracking 
     SET current_stage = 'DELIVERED', updated_at = NOW()
     WHERE id = $1`,
    [tracking.id]
  );

  // Record tracking event
  await query(
    `INSERT INTO public.order_tracking_events (
      tracking_id, bom_code, stage, title, description, actor_role, metadata
    ) VALUES (
      $1, $2, 'DELIVERED', 'Customer Confirmed Delivery', $3, 'Customer', $4
    )`,
    [
      tracking.id,
      tracking.bom_code,
      `Customer ${customerName || tracking.customer_name} confirmed receipt of order. Rating: ${rating}/5`,
      JSON.stringify({ rating, remarks })
    ]
  );

  // Also update BOM if present
  try {
    await query(
      `UPDATE public.bom_orders 
       SET status = 'DELIVERED', updated_at = NOW() 
       WHERE code = $1 OR bom_code = $1`,
      [tracking.bom_code]
    );
  } catch (_) {}

  // Broadcast to connected clients
  broadcastCustomerTrackingUpdate(tracking.tracking_token, {
    bomCode: tracking.bom_code,
    stage: 'DELIVERED',
    message: 'Delivery confirmed by customer'
  });

  return { success: true, message: 'Delivery confirmed successfully. Thank you!' };
}

/**
 * Regenerate Tracking Token
 */
export async function regenerateTrackingToken(bomCode) {
  const newToken = generateSecureTrackingToken();
  const newHash = hashTrackingToken(newToken);

  const res = await query(
    `UPDATE public.order_tracking 
     SET tracking_token = $1, token_hash = $2, status = 'ACTIVE', updated_at = NOW()
     WHERE bom_code = $3
     RETURNING *`,
    [newToken, newHash, bomCode]
  );

  if (res.rows.length === 0) {
    throw new Error(`Order tracking for BOM ${bomCode} does not exist.`);
  }

  const updated = res.rows[0];
  const trackingUrl = `https://${process.env.TRACKING_DOMAIN || 'track.businz.com'}/order/${newToken}`;

  // Log event
  await query(
    `INSERT INTO public.order_tracking_events (
      tracking_id, bom_code, stage, title, description, actor_role
    ) VALUES (
      $1, $2, $3, 'Tracking Link Regenerated', 'Administrative user regenerated tracking link and invalidated previous token.', 'Administrator'
    )`,
    [updated.id, bomCode, updated.current_stage]
  );

  return { ...updated, tracking_url: trackingUrl };
}

/**
 * Revoke Tracking Token
 */
export async function revokeTrackingToken(bomCode) {
  const res = await query(
    `UPDATE public.order_tracking 
     SET status = 'REVOKED', updated_at = NOW()
     WHERE bom_code = $1
     RETURNING *`,
    [bomCode]
  );

  if (res.rows.length === 0) {
    throw new Error(`Order tracking for BOM ${bomCode} does not exist.`);
  }

  const updated = res.rows[0];

  await query(
    `INSERT INTO public.order_tracking_events (
      tracking_id, bom_code, stage, title, description, actor_role
    ) VALUES (
      $1, $2, $3, 'Tracking Link Revoked', 'Administrator deactivated customer tracking access.', 'Administrator'
    )`,
    [updated.id, bomCode, updated.current_stage]
  );

  return updated;
}

function buildSalesIsolationFilter(salesPersonCode, salesPersonEmail, salesPersonName, startIdx = 1) {
  const code = String(salesPersonCode || '').trim().toUpperCase();
  const email = String(salesPersonEmail || '').trim().toLowerCase();
  const name = String(salesPersonName || '').trim().toLowerCase();
  if (!code && !email && !name) return { clause: '', params: [] };

  if (/^SE-\d{3,4}$/.test(code)) {
    return {
      clause: `(UPPER(COALESCE(b.sales_person_code, b.created_by_id, '')) = $${startIdx})`,
      params: [code]
    };
  }
  const orParts = [];
  const params = [];
  let idx = startIdx;
  if (code) {
    orParts.push(`UPPER(COALESCE(b.sales_person_code, b.created_by_id, '')) = $${idx++}`);
    params.push(code);
  }
  if (email) {
    orParts.push(`LOWER(COALESCE(b.sales_person_email, '')) = $${idx++}`);
    params.push(email);
  }
  if (name) {
    orParts.push(`LOWER(COALESCE(b.sales_person, b.created_by, '')) = $${idx++}`);
    params.push(name);
  }
  return { clause: orParts.length ? `(${orParts.join(' OR ')})` : '', params };
}

/**
 * Internal Tracking List Query with pagination and filtering
 */
export async function getInternalTrackingOrders({ search = '', stage = '', page = 1, limit = 10, salesPersonCode = '', salesPersonEmail = '', salesPersonName = '' } = {}) {
  const offset = Math.max(0, (page - 1) * limit);
  const conditions = [];
  const params = [];
  let pIdx = 1;

  if (search) {
    conditions.push(`(t.bom_code ILIKE $${pIdx} OR t.source_pi_no ILIKE $${pIdx} OR t.customer_name ILIKE $${pIdx} OR t.customer_mobile ILIKE $${pIdx})`);
    params.push(`%${search.trim()}%`);
    pIdx++;
  }

  if (stage && stage !== 'ALL') {
    conditions.push(`t.current_stage = $${pIdx}`);
    params.push(stage);
    pIdx++;
  }

  const salesFilter = buildSalesIsolationFilter(salesPersonCode, salesPersonEmail, salesPersonName, pIdx);
  if (salesFilter.clause) {
    conditions.push(salesFilter.clause);
    params.push(...salesFilter.params);
    pIdx += salesFilter.params.length;
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  // Get total count
  const countRes = await query(
    `SELECT COUNT(*) FROM public.order_tracking t LEFT JOIN public.bom_orders b ON (b.code = t.bom_code OR b.bom_code = t.bom_code) ${whereClause}`,
    params
  );
  const totalCount = parseInt(countRes.rows[0].count, 10);

  // Query records (extracting only lightweight items/dispatch_packing/vehicleLoading paths — never heavy doc blobs)
  const querySql = `
    SELECT 
      t.id, t.bom_code, t.source_pi_no, t.tracking_token, t.customer_name, 
      t.customer_mobile, t.status, t.current_stage, t.packing_percentage,
      t.access_count, t.last_accessed_at, t.created_at, t.updated_at,
      b.transporter_name, b.vehicle_no, b.lr_no, b.invoice_no,
      b.items as items_json,
      b.dispatch_packing as dispatch_packing_json,
      b.accounts_verification->'_extra_data'->'vehicleLoading' as vehicle_loading_json,
      (SELECT COUNT(*) FROM public.order_tracking_issues i WHERE i.tracking_id = t.id AND i.status = 'OPEN') as open_issues_count
    FROM public.order_tracking t
    LEFT JOIN public.bom_orders b ON (b.code = t.bom_code OR b.bom_code = t.bom_code)
    ${whereClause}
    ORDER BY t.created_at DESC
    LIMIT $${pIdx} OFFSET $${pIdx + 1}
  `;

  params.push(limit, offset);
  const listRes = await query(querySql, params);

  return {
    orders: listRes.rows.map(r => {
      const items = Array.isArray(r.items_json) ? r.items_json : [];
      const dispatchPacking = Array.isArray(r.dispatch_packing_json) ? r.dispatch_packing_json : [];
      const vehicleLoading = (r.vehicle_loading_json && typeof r.vehicle_loading_json === 'object') ? r.vehicle_loading_json : {};
      const packingProg = calculatePackingProgress({ items, dispatchPacking });

      const { items_json, dispatch_packing_json, vehicle_loading_json, ...rest } = r;
      return {
        ...rest,
        transporter_name: r.transporter_name || vehicleLoading.transporterName || null,
        vehicle_no: r.vehicle_no || vehicleLoading.vehicleNumber || vehicleLoading.vehicleNo || null,
        lr_no: r.lr_no || vehicleLoading.lrNumber || vehicleLoading.lrNo || null,
        packed_lines_count: packingProg.packedLines,
        total_lines_count: packingProg.totalLines,
        tracking_url: `https://${process.env.TRACKING_DOMAIN || 'track.businz.com'}/order/${r.tracking_token}`
      };
    }),
    totalCount,
    page,
    limit,
    totalPages: Math.ceil(totalCount / limit)
  };
}

/**
 * Tracking Analytics for CEO / Admin Dashboard
 */
export async function getTrackingAnalytics({ salesPersonCode = '', salesPersonEmail = '', salesPersonName = '' } = {}) {
  const salesFilter = buildSalesIsolationFilter(salesPersonCode, salesPersonEmail, salesPersonName, 1);
  const whereClause = salesFilter.clause ? `WHERE ${salesFilter.clause}` : '';
  const statsRes = await query(`
    SELECT 
      COUNT(*) as total_tracked_orders,
      COUNT(*) FILTER (WHERE t.current_stage = 'RECEIVED_BY_DISPATCH') as awaiting_packing,
      COUNT(*) FILTER (WHERE t.current_stage = 'PACKING_IN_PROGRESS') as packing_in_progress,
      COUNT(*) FILTER (WHERE t.current_stage = 'PACKING_COMPLETED') as packing_completed,
      COUNT(*) FILTER (WHERE t.current_stage = 'INVOICE_GENERATED' OR t.current_stage = 'READY_FOR_LOADING' OR t.current_stage = 'LOADING_IN_PROGRESS') as ready_for_dispatch,
      COUNT(*) FILTER (WHERE t.current_stage = 'DISPATCHED') as in_transit,
      COUNT(*) FILTER (WHERE t.current_stage = 'DELIVERED') as delivered,
      COUNT(*) FILTER (WHERE t.status = 'ACTIVE') as active_links,
      COALESCE(SUM(t.access_count), 0) as total_customer_views
    FROM public.order_tracking t
    LEFT JOIN public.bom_orders b ON (b.code = t.bom_code OR b.bom_code = t.bom_code)
    ${whereClause}
  `, salesFilter.params);

  const issuesRes = await query(`
    SELECT 
      COUNT(*) as total_issues,
      COUNT(*) FILTER (WHERE status = 'OPEN') as open_issues
    FROM public.order_tracking_issues
  `);

  const notificationsRes = await query(`
    SELECT 
      COUNT(*) as total_queued,
      COUNT(*) FILTER (WHERE status = 'SENT') as total_sent,
      COUNT(*) FILTER (WHERE status = 'FAILED') as total_failed,
      COUNT(*) FILTER (WHERE status = 'PENDING') as total_pending
    FROM public.tracking_notification_queue
  `);

  return {
    overview: statsRes.rows[0] || {},
    issues: issuesRes.rows[0] || {},
    notifications: notificationsRes.rows[0] || {}
  };
}

/**
 * Queues a WhatsApp tracking notification with strict idempotency
 */
export async function queueTrackingNotification({
  trackingId,
  bomCode,
  customerPhone,
  customerName,
  companyName,
  triggerEvent,
  templateName = 'order_tracking_started',
  trackingUrl
}) {
  const cleanPhone = String(customerPhone).replace(/[^0-9]/g, '');
  if (!cleanPhone || cleanPhone.length < 10) return null;

  const idempotencyKey = `notif_${bomCode}_${triggerEvent}_${cleanPhone}`;
  const queueId = `NOTIF-${Date.now().toString(36).toUpperCase()}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;

  const templateVariables = [
    customerName,
    companyName,
    bomCode,
    trackingUrl
  ];

  try {
    const res = await query(
      `INSERT INTO public.tracking_notification_queue (
        id, tracking_id, bom_code, customer_phone, customer_name,
        company_name, trigger_event, idempotency_key, channel,
        template_name, template_variables, tracking_url, status,
        created_at, updated_at
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, 'META_CLOUD_API',
        $9, $10, $11, 'PENDING', NOW(), NOW()
      ) ON CONFLICT (idempotency_key) DO NOTHING
      RETURNING *`,
      [
        queueId, trackingId, bomCode, cleanPhone, customerName,
        companyName, triggerEvent, idempotencyKey, templateName,
        JSON.stringify(templateVariables), trackingUrl
      ]
    );

    return res.rows[0] || null;
  } catch (err) {
    console.warn('[Queue Notification Warning]:', err.message);
    return null;
  }
}

/**
 * Background worker to process pending WhatsApp tracking notifications
 */
export async function processNotificationQueueWorker() {
  const token = process.env.WHATSAPP_ACCESS_TOKEN;
  const phoneId = process.env.WHATSAPP_PHONE_NUMBER_ID;

  try {
    const pendingRes = await query(`
      SELECT * FROM public.tracking_notification_queue
      WHERE status = 'PENDING' AND retry_count < max_retries
      ORDER BY created_at ASC
      LIMIT 10
    `);

    for (const item of pendingRes.rows) {
      const { id, customer_phone, customer_name, company_name, bom_code, tracking_url, template_name, retry_count } = item;
      
      // If live credentials are available, send to Meta Cloud API
      if (token && phoneId) {
        try {
          const url = `https://graph.facebook.com/v20.0/${phoneId}/messages`;
          const payload = {
            messaging_product: 'whatsapp',
            to: customer_phone,
            type: 'template',
            template: {
              name: template_name,
              language: { code: 'en' },
              components: [
                {
                  type: 'body',
                  parameters: [
                    { type: 'text', text: customer_name },
                    { type: 'text', text: company_name },
                    { type: 'text', text: bom_code }
                  ]
                },
                {
                  type: 'button',
                  sub_type: 'url',
                  index: '0',
                  parameters: [
                    { type: 'text', text: tracking_url.replace(/^https?:\/\/[^\/]+\//, '') }
                  ]
                }
              ]
            }
          };

          const response = await fetch(url, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify(payload)
          });

          const data = await response.json();
          if (response.ok && data.messages?.[0]?.id) {
            await query(
              `UPDATE public.tracking_notification_queue 
               SET status = 'SENT', meta_message_id = $1, sent_at = NOW(), updated_at = NOW()
               WHERE id = $2`,
              [data.messages[0].id, id]
            );
          } else {
            const errDesc = data.error?.message || JSON.stringify(data);
            await query(
              `UPDATE public.tracking_notification_queue 
               SET retry_count = retry_count + 1, error_message = $1, status = CASE WHEN retry_count + 1 >= max_retries THEN 'FAILED' ELSE 'PENDING' END, updated_at = NOW()
               WHERE id = $2`,
              [errDesc, id]
            );
          }
        } catch (callErr) {
          await query(
            `UPDATE public.tracking_notification_queue 
             SET retry_count = retry_count + 1, error_message = $1, status = CASE WHEN retry_count + 1 >= max_retries THEN 'FAILED' ELSE 'PENDING' END, updated_at = NOW()
             WHERE id = $2`,
            [callErr.message, id]
          );
        }
      } else {
        // Dev/simulated environment: mark sent with simulated id
        await query(
          `UPDATE public.tracking_notification_queue 
           SET status = 'SENT', meta_message_id = $1, sent_at = NOW(), updated_at = NOW()
           WHERE id = $2`,
          [`WA-SIM-${Date.now()}`, id]
        );
      }
    }
  } catch (loopErr) {
    console.warn('[Tracking Notification Worker Notice]:', loopErr.message);
  }
}

/**
 * Broadcasts order update to connected customer SSE clients
 */
export function broadcastCustomerTrackingUpdate(trackingToken, payload) {
  if (!trackingToken) return;
  const clients = customerTrackingSseClients.get(trackingToken);
  if (!clients || clients.size === 0) return;

  const dataString = `event: tracking_update\ndata: ${JSON.stringify({ ...payload, timestamp: new Date().toISOString() })}\n\n`;
  for (const res of clients) {
    try {
      if (!res.writableEnded && !res.destroyed) {
        res.write(dataString);
      } else {
        clients.delete(res);
      }
    } catch (_) {
      clients.delete(res);
    }
  }
}

function escapeHtml(val) {
  return String(val ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * Resolves a customer-safe downloadable/viewable document for /api/track/:token/documents/:docType
 * Never exposes internal margins, purchase costs, or internal remarks.
 */
export async function resolveTrackingDocumentPayload(rawToken, docType) {
  const cleanToken = String(rawToken || '').trim();
  const cleanType = String(docType || '').trim().toLowerCase();
  if (!cleanToken) return { notFound: true, message: 'Invalid tracking token.' };

  let tracking = null;
  let bom = null;

  try {
    const tRes = await query(
      `SELECT * FROM public.order_tracking WHERE tracking_token = $1 OR bom_code = $1 LIMIT 1`,
      [cleanToken]
    );
    if (tRes.rows.length > 0) tracking = tRes.rows[0];
  } catch (_) {}

  if (tracking?.status === 'REVOKED') {
    return { forbidden: true, message: 'This tracking link has been revoked.' };
  }

  const targetBomCode = tracking?.bom_code || cleanToken;
  try {
    const bRes = await query(
      `SELECT * FROM public.bom_orders WHERE code = $1 OR bom_code = $1 OR id = $1 LIMIT 1`,
      [targetBomCode]
    );
    if (bRes.rows.length > 0) {
      const raw = bRes.rows[0];
      bom = raw.bom_data ? { ...raw.bom_data, ...raw } : raw;
    }
  } catch (_) {}

  if (!tracking && !bom) {
    return { notFound: true, message: 'Order tracking record not found.' };
  }

  const safeBom = bom || {
    bom_code: tracking?.bom_code || cleanToken,
    customer_name: tracking?.customer_name || 'Valued Customer',
    items: []
  };
  const bomCode = safeBom.bom_code || safeBom.bomCode || safeBom.code || targetBomCode;
  const customerName = safeBom.customer_name || safeBom.customerName || tracking?.customer_name || 'Valued Customer';
  const piNo = safeBom.source_pi_no || safeBom.sourcePiNo || tracking?.source_pi_no || 'N/A';
  const invNo = safeBom.invoice_no || safeBom.invoiceNo || 'Pending';

  // Helper to resolve uploaded file ref (signed URL, /api/uploads path, or data URL)
  const resolveUploadedDoc = async (docRef) => {
    if (!docRef) return null;
    let parsed = docRef;
    if (typeof docRef === 'string' && docRef.trim().startsWith('{')) {
      try { parsed = JSON.parse(docRef); } catch (_) {}
    }
    if (typeof parsed === 'string') {
      if (parsed.startsWith('data:')) {
        const match = parsed.match(/^data:([^;]+);base64,(.+)$/);
        if (match) {
          return { type: 'buffer', mimeType: match[1], buffer: Buffer.from(match[2], 'base64') };
        }
      }
      if (parsed.startsWith('/api/') || parsed.startsWith('http')) {
        return { type: 'redirect', url: parsed };
      }
    } else if (parsed && typeof parsed === 'object') {
      if (parsed.dataUrl && String(parsed.dataUrl).startsWith('data:')) {
        const match = parsed.dataUrl.match(/^data:([^;]+);base64,(.+)$/);
        if (match) {
          return { type: 'buffer', mimeType: match[1], buffer: Buffer.from(match[2], 'base64') };
        }
      }
      if (parsed.storagePath) {
        try {
          const signed = await createBomDocumentSignedUrl(parsed.storagePath);
          if (signed) return { type: 'redirect', url: signed };
        } catch (_) {}
        return { type: 'redirect', url: `/api/uploads/bom-documents/${String(parsed.storagePath).replace(/^\/+/, '').replace(/^bom-documents\//, '')}` };
      }
      if (parsed.url) return { type: 'redirect', url: parsed.url };
    }
    return null;
  };

  if (cleanType === 'proforma-invoice') {
    const resolved = await resolveUploadedDoc(safeBom.signed_pi_doc || safeBom.signedPiDoc);
    if (resolved) return resolved;
  }
  if (cleanType === 'lr-copy') {
    const lrDoc = safeBom.lrCopyDoc || safeBom.accounts_verification?._extra_data?.lrCopyDoc || safeBom.accounts_verification?._extra_data?.vehicleLoading?.lrCopyDoc;
    const resolved = await resolveUploadedDoc(lrDoc);
    if (resolved) return resolved;
  }
  if (cleanType === 'tax-invoice') {
    const attachedInvoiceDocs = Array.isArray(safeBom.attachedInvoiceDocs)
      ? safeBom.attachedInvoiceDocs
      : (Array.isArray(safeBom.accounts_verification?._extra_data?.attachedInvoiceDocs) ? safeBom.accounts_verification._extra_data.attachedInvoiceDocs : []);
    if (attachedInvoiceDocs.length === 1) {
      const resolved = await resolveUploadedDoc(attachedInvoiceDocs[0]);
      if (resolved) return resolved;
    } else if (attachedInvoiceDocs.length > 1) {
      const linksHtml = attachedInvoiceDocs.map((d, idx) => {
        const docUrl = d?.storagePath
          ? `/api/uploads/bom-documents/${String(d.storagePath).replace(/^\/+/, '').replace(/^bom-documents\//, '')}`
          : (d?.url || d?.dataUrl || '#');
        return `<a class="inv-card" href="${escapeHtml(docUrl)}" target="_blank" rel="noopener noreferrer">
          <div><strong>${escapeHtml(d?.name || `Tax Invoice File ${idx + 1}`)}</strong><div style="font-size:12px;color:#64748B;margin-top:2px;">Click to view or download</div></div>
          <span class="btn" style="padding:7px 14px;font-size:12px;">Open</span>
        </a>`;
      }).join('');
      return {
        type: 'html',
        html: `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8" /><meta name="viewport" content="width=device-width,initial-scale=1.0" /><title>Official Tax Invoice — ${escapeHtml(bomCode)}</title><style>body{font-family:'Inter',-apple-system,sans-serif;background:#F1F5F9;margin:0;padding:32px 16px;color:#0F172A}.wrap{max-width:680px;margin:0 auto;background:#FFF;border:1px solid #E2E8F0;border-radius:16px;padding:28px;box-shadow:0 8px 24px rgba(15,23,42,.06)}.inv-card{display:flex;justify-content:space-between;align-items:center;gap:12px;padding:14px 16px;border:1px solid #E2E8F0;border-radius:12px;text-decoration:none;color:inherit;margin-top:12px;background:#F8FAFC}.inv-card:hover{border-color:#0E7490;background:#ECFEFF}.btn{background:#0E7490;color:#FFF;border-radius:8px;font-weight:700}</style></head><body><div class="wrap"><div style="font-size:12px;font-weight:700;color:#0E7490;text-transform:uppercase;">VRM Structures India Private Limited</div><h2 style="margin:4px 0 4px;">Official Tax Invoice (${escapeHtml(invNo)})</h2><div style="font-size:13px;color:#64748B;margin-bottom:18px;">BOM: <strong>${escapeHtml(bomCode)}</strong> • Customer: <strong>${escapeHtml(customerName)}</strong></div>${linksHtml}</div></body></html>`
      };
    }
  }

  // Generate premium, client-ready printable HTML for structured documents
  const packingProgress = calculatePackingProgress(safeBom);
  const rows = packingProgress.products || [];
  const docTitleMap = {
    'bom': 'Customer Bill of Materials',
    'packing-list': 'Itemized Packing List',
    'tax-invoice': 'Official Tax Invoice Summary',
    'proforma-invoice': 'Proforma Invoice Reference',
    'lr-copy': 'Lorry Receipt (LR) Summary',
    'delivery-challan': 'Delivery Challan Summary'
  };
  const docTitle = docTitleMap[cleanType] || 'Order Document';
  const vehicleLoading = safeBom.vehicleLoading || safeBom.accounts_verification?._extra_data?.vehicleLoading || {};
  const lrNo = safeBom.lr_no || safeBom.lrNo || vehicleLoading.lrNumber || vehicleLoading.lrNo || '';
  const transporter = safeBom.transporter_name || vehicleLoading.transporterName || '';
  const vehicleNo = safeBom.vehicle_no || vehicleLoading.vehicleNumber || vehicleLoading.vehicleNo || '';
  const deliveryAddress = safeBom.delivery_address || safeBom.deliveryAddress || safeBom.address || '';
  const packedPct = packingProgress.percentage || 0;
  const docDateStr = new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });

  const tableRowsHtml = rows.length > 0
    ? rows.map((p, idx) => {
      const statusBadge = p.isFullyPacked
        ? '<span class="badge badge-green">✓ Fully Packed</span>'
        : p.packedQty > 0
          ? `<span class="badge badge-amber">◐ Partial (${escapeHtml(p.packedQty)}/${escapeHtml(p.orderedQty)})</span>`
          : '<span class="badge badge-slate">○ Pending</span>';
      return `
      <tr>
        <td style="color:#64748B;font-weight:600;">${idx + 1}</td>
        <td><span class="code-pill">${escapeHtml(p.code)}</span></td>
        <td style="font-weight:600;color:#0F172A;">${escapeHtml(p.name)}</td>
        <td class="num">${escapeHtml(p.orderedQty)} <span class="uom">${escapeHtml(p.uom)}</span></td>
        ${cleanType === 'packing-list' ? `<td class="num"><strong>${escapeHtml(p.packedQty)}</strong> <span class="uom">/ ${escapeHtml(p.orderedQty)} ${escapeHtml(p.uom)}</span></td><td class="num" style="color:${p.pendingQty > 0 ? '#B45309' : '#64748B'}">${escapeHtml(p.pendingQty)} <span class="uom">${escapeHtml(p.uom)}</span></td><td>${statusBadge}</td>` : ''}
      </tr>`;
    }).join('')
    : `<tr><td colspan="${cleanType === 'packing-list' ? 7 : 4}" style="text-align:center;color:#64748B;padding:28px;">No line items available.</td></tr>`;

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${escapeHtml(docTitle)} — ${escapeHtml(bomCode)}</title>
  <style>
    * { box-sizing: border-box; }
    body { font-family: 'Inter', -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; color: #0F172A; margin: 0; padding: 28px 16px; background: #F1F5F9; }
    .toolbar { max-width: 960px; margin: 0 auto 14px; display: flex; justify-content: space-between; align-items: center; }
    .toolbar-note { font-size: 12px; color: #64748B; font-weight: 600; }
    .btn { background: #0E7490; color: #FFF; border: none; padding: 10px 18px; border-radius: 10px; font-weight: 700; cursor: pointer; font-size: 13px; box-shadow: 0 2px 8px rgba(14,116,144,0.25); }
    .btn:hover { background: #0C637A; }
    .sheet { max-width: 960px; margin: 0 auto; background: #FFF; border: 1px solid #E2E8F0; border-radius: 16px; overflow: hidden; box-shadow: 0 10px 30px rgba(15,23,42,0.07); }
    .banner { background: linear-gradient(135deg, #0E7490 0%, #0F172A 100%); color: #FFF; padding: 26px 32px; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 16px; }
    .brand-row { display: flex; align-items: center; gap: 14px; }
    .logo-box { width: 46px; height: 46px; border-radius: 12px; background: rgba(255,255,255,0.16); border: 1px solid rgba(255,255,255,0.28); display: flex; align-items: center; justify-content: center; font-weight: 900; font-size: 20px; }
    .company { font-size: 19px; font-weight: 800; letter-spacing: -0.3px; }
    .company-sub { font-size: 12px; color: #CBD5E1; margin-top: 3px; }
    .doc-tag { text-align: right; }
    .doc-pill { display: inline-block; background: rgba(255,255,255,0.15); border: 1px solid rgba(255,255,255,0.25); padding: 4px 12px; border-radius: 9999px; font-size: 11px; font-weight: 700; letter-spacing: 0.6px; text-transform: uppercase; margin-bottom: 6px; }
    .doc-title { font-size: 20px; font-weight: 800; }
    .doc-ref { font-size: 12.5px; color: #E2E8F0; margin-top: 2px; }
    .content { padding: 26px 32px; }
    .kpis { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 12px; margin-bottom: 20px; }
    .kpi { background: #F8FAFC; border: 1px solid #E2E8F0; border-radius: 12px; padding: 14px 16px; }
    .kpi-label { font-size: 11px; color: #64748B; text-transform: uppercase; font-weight: 700; letter-spacing: 0.4px; }
    .kpi-val { font-size: 17px; font-weight: 800; color: #0F172A; margin-top: 4px; }
    .bar-bg { width: 100%; height: 6px; background: #E2E8F0; border-radius: 9999px; margin-top: 8px; overflow: hidden; }
    .bar-fill { height: 100%; background: ${packedPct === 100 ? '#10B981' : '#0E7490'}; width: ${packedPct}%; }
    .details { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 14px; background: #F8FAFC; border: 1px solid #E2E8F0; border-radius: 12px; padding: 16px 18px; margin-bottom: 22px; font-size: 13px; }
    .d-label { font-size: 11px; color: #64748B; font-weight: 700; text-transform: uppercase; }
    .d-val { font-weight: 700; color: #0F172A; margin-top: 3px; }
    table { width: 100%; border-collapse: collapse; font-size: 13px; border: 1px solid #E2E8F0; border-radius: 10px; overflow: hidden; }
    th { background: #F1F5F9; color: #334155; text-align: left; padding: 11px 12px; border-bottom: 2px solid #CBD5E1; font-weight: 700; font-size: 11.5px; text-transform: uppercase; letter-spacing: 0.4px; }
    td { padding: 11px 12px; border-bottom: 1px solid #F1F5F9; vertical-align: middle; }
    tbody tr:nth-child(even) { background: #FAFCFF; }
    .num { text-align: right; font-variant-numeric: tabular-nums; white-space: nowrap; }
    .uom { font-size: 11px; color: #64748B; font-weight: 600; }
    .code-pill { display: inline-block; background: #ECFEFF; color: #0E7490; border: 1px solid #CFFAFE; font-weight: 700; font-size: 11.5px; padding: 2px 8px; border-radius: 6px; }
    .badge { display: inline-flex; align-items: center; gap: 4px; font-size: 11.5px; font-weight: 700; padding: 4px 10px; border-radius: 9999px; white-space: nowrap; }
    .badge-green { background: #ECFDF5; color: #059669; border: 1px solid #A7F3D0; }
    .badge-amber { background: #FFFBEB; color: #B45309; border: 1px solid #FDE68A; }
    .badge-slate { background: #F1F5F9; color: #64748B; border: 1px solid #CBD5E1; }
    .footer { margin-top: 24px; padding-top: 16px; border-top: 1px dashed #CBD5E1; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 12px; font-size: 12px; color: #64748B; }
    .verified-seal { display: inline-flex; align-items: center; gap: 6px; background: #ECFDF5; color: #059669; border: 1px solid #A7F3D0; padding: 6px 12px; border-radius: 8px; font-weight: 700; font-size: 12px; }
    @media print {
      body { background: #FFF; padding: 0; }
      .toolbar { display: none; }
      .sheet { border: none; box-shadow: none; border-radius: 0; }
      .banner { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    }
  </style>
</head>
<body>
  <div class="toolbar">
    <div class="toolbar-note">BUSINZ Track • Official Customer Packing Document</div>
    <button class="btn" onclick="window.print()">Print / Download PDF</button>
  </div>
  <div class="sheet">
    <div class="banner">
      <div class="brand-row">
        <div class="logo-box">V</div>
        <div>
          <div class="company">VRM Structures India Private Limited</div>
          <div class="company-sub">Verified Dispatch &amp; Quality Packing Slip</div>
        </div>
      </div>
      <div class="doc-tag">
        <div class="doc-pill">${escapeHtml(docTitle)}</div>
        <div class="doc-title">${escapeHtml(bomCode)}</div>
        <div class="doc-ref">Issued: ${escapeHtml(docDateStr)}</div>
      </div>
    </div>

    <div class="content">
      <div class="kpis">
        <div class="kpi">
          <div class="kpi-label">Packing Completion</div>
          <div class="kpi-val">${packedPct}%</div>
          <div class="bar-bg"><div class="bar-fill"></div></div>
        </div>
        <div class="kpi">
          <div class="kpi-label">Lines Packed</div>
          <div class="kpi-val">${packingProgress.packedLines} / ${packingProgress.totalLines} Items</div>
        </div>
        <div class="kpi">
          <div class="kpi-label">Carrier / Transport</div>
          <div class="kpi-val" style="font-size:14.5px;">${escapeHtml(transporter || 'To Be Assigned')}</div>
        </div>
        <div class="kpi">
          <div class="kpi-label">LR / Vehicle</div>
          <div class="kpi-val" style="font-size:14.5px;">${escapeHtml(lrNo || vehicleNo || 'Awaiting Dispatch')}</div>
        </div>
      </div>

      <div class="details">
        <div><div class="d-label">Customer</div><div class="d-val">${escapeHtml(customerName)}</div></div>
        <div><div class="d-label">Proforma Invoice</div><div class="d-val">${escapeHtml(piNo)}</div></div>
        <div><div class="d-label">Tax Invoice</div><div class="d-val">${escapeHtml(invNo)}</div></div>
        ${deliveryAddress ? `<div><div class="d-label">Delivery Location</div><div class="d-val" style="font-size:12px;">${escapeHtml(deliveryAddress)}</div></div>` : ''}
      </div>

      <table>
        <thead>
          <tr>
            <th style="width:44px">#</th>
            <th style="width:125px">Item Code</th>
            <th>Item Description</th>
            <th class="num" style="width:110px">Ordered</th>
            ${cleanType === 'packing-list' ? '<th class="num" style="width:135px">Packed</th><th class="num" style="width:105px">Pending</th><th style="width:165px">Status</th>' : ''}
          </tr>
        </thead>
        <tbody>${tableRowsHtml}</tbody>
      </table>

      <div class="footer">
        <div class="verified-seal">✓ Verified by VRM Dispatch Team</div>
        <div>Thank you for your business with VRM Structures India Private Limited • Powered by BUSINZ</div>
      </div>
    </div>
  </div>
</body>
</html>`;

  return { type: 'html', html };
}

// Pure-JS Store ZIP builder (zero external dependencies, works on all Node versions)
function crc32Buffer(buf) {
  let crc = 0xFFFFFFFF;
  for (let i = 0; i < buf.length; i++) {
    crc ^= buf[i];
    for (let j = 0; j < 8; j++) {
      crc = (crc >>> 1) ^ (crc & 1 ? 0xEDB88320 : 0);
    }
  }
  return (crc ^ 0xFFFFFFFF) >>> 0;
}

function buildZipBuffer(entries) {
  const localParts = [];
  const centralParts = [];
  let offset = 0;

  for (const entry of entries) {
    const nameBuf = Buffer.from(entry.name, 'utf8');
    const data = Buffer.isBuffer(entry.data) ? entry.data : Buffer.from(entry.data || '');
    const crc = crc32Buffer(data);

    const localHeader = Buffer.alloc(30);
    localHeader.writeUInt32LE(0x04034b50, 0);
    localHeader.writeUInt16LE(20, 4);
    localHeader.writeUInt16LE(0, 6);
    localHeader.writeUInt16LE(0, 8); // Store (no compression)
    localHeader.writeUInt16LE(0, 10);
    localHeader.writeUInt16LE(0, 12);
    localHeader.writeUInt32LE(crc, 14);
    localHeader.writeUInt32LE(data.length, 18);
    localHeader.writeUInt32LE(data.length, 22);
    localHeader.writeUInt16LE(nameBuf.length, 26);
    localHeader.writeUInt16LE(0, 28);

    localParts.push(localHeader, nameBuf, data);

    const centralHeader = Buffer.alloc(46);
    centralHeader.writeUInt32LE(0x02014b50, 0);
    centralHeader.writeUInt16LE(20, 4);
    centralHeader.writeUInt16LE(20, 6);
    centralHeader.writeUInt16LE(0, 8);
    centralHeader.writeUInt16LE(0, 10);
    centralHeader.writeUInt16LE(0, 12);
    centralHeader.writeUInt16LE(0, 14);
    centralHeader.writeUInt32LE(crc, 16);
    centralHeader.writeUInt32LE(data.length, 20);
    centralHeader.writeUInt32LE(data.length, 24);
    centralHeader.writeUInt16LE(nameBuf.length, 28);
    centralHeader.writeUInt16LE(0, 30);
    centralHeader.writeUInt16LE(0, 32);
    centralHeader.writeUInt16LE(0, 34);
    centralHeader.writeUInt16LE(0, 36);
    centralHeader.writeUInt32LE(0, 38);
    centralHeader.writeUInt32LE(offset, 42);

    centralParts.push(centralHeader, nameBuf);
    offset += localHeader.length + nameBuf.length + data.length;
  }

  const centralSize = centralParts.reduce((s, b) => s + b.length, 0);
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0);
  eocd.writeUInt16LE(0, 4);
  eocd.writeUInt16LE(0, 6);
  eocd.writeUInt16LE(entries.length, 8);
  eocd.writeUInt16LE(entries.length, 10);
  eocd.writeUInt32LE(centralSize, 12);
  eocd.writeUInt32LE(offset, 16);
  eocd.writeUInt16LE(0, 20);

  return Buffer.concat([...localParts, ...centralParts, eocd]);
}

/**
 * Packages all packing/loading images (and LR Copy when applicable) into a single ZIP folder
 */
export async function buildTrackingBundleZip(rawToken) {
  const cleanToken = String(rawToken || '').trim();
  if (!cleanToken) return { notFound: true };

  let tracking = null;
  let bom = null;
  try {
    const tRes = await query(
      `SELECT * FROM public.order_tracking WHERE tracking_token = $1 OR bom_code = $1 LIMIT 1`,
      [cleanToken]
    );
    if (tRes.rows.length > 0) tracking = tRes.rows[0];
  } catch (_) {}

  const targetBomCode = tracking?.bom_code || cleanToken;
  try {
    const bRes = await query(
      `SELECT * FROM public.bom_orders WHERE code = $1 OR bom_code = $1 OR id = $1 LIMIT 1`,
      [targetBomCode]
    );
    if (bRes.rows.length > 0) {
      const raw = bRes.rows[0];
      bom = raw.bom_data ? { ...raw.bom_data, ...raw } : raw;
    }
  } catch (_) {}

  if (!tracking && !bom) return { notFound: true };
  if (tracking?.status === 'REVOKED') return { forbidden: true };

  const fs = await import('fs');
  const path = await import('path');
  const bomDocsDir = path.resolve(process.cwd(), 'server', 'uploads', 'bom-documents');

  const resolveFileToBuffer = async (ref, fallbackBaseName) => {
    if (!ref) return null;
    let parsed = ref;
    if (typeof ref === 'string' && ref.trim().startsWith('{')) {
      try { parsed = JSON.parse(ref); } catch (_) {}
    }

    const rawUrl = typeof parsed === 'string' ? parsed : (parsed.dataUrl || parsed.url || '');
    const storagePath = typeof parsed === 'object' ? (parsed.storagePath || '') : '';
    const origName = typeof parsed === 'object' ? (parsed.originalName || parsed.name || '') : '';

    if (rawUrl.startsWith('data:')) {
      const match = rawUrl.match(/^data:([^;]+);base64,(.+)$/);
      if (match) {
        const ext = (match[1].split('/')[1] || 'jpg').replace('jpeg', 'jpg');
        return { name: origName || `${fallbackBaseName}.${ext}`, data: Buffer.from(match[2], 'base64') };
      }
    }

    const candidateRel = storagePath
      ? String(storagePath).replace(/^\/+/, '').replace(/^bom-documents\//, '')
      : rawUrl.includes('/bom-documents/')
        ? rawUrl.split('/bom-documents/')[1].split('?')[0]
        : '';

    if (candidateRel) {
      const safeRel = decodeURIComponent(candidateRel).replace(/\.\./g, '');
      const diskPath = path.join(bomDocsDir, safeRel);
      if (fs.existsSync(diskPath)) {
        return {
          name: origName || path.basename(diskPath) || `${fallbackBaseName}.jpg`,
          data: fs.readFileSync(diskPath)
        };
      }
      try {
        const signed = await createBomDocumentSignedUrl(safeRel);
        if (signed && signed.startsWith('http')) {
          const resp = await fetch(signed);
          if (resp.ok) {
            const arr = await resp.arrayBuffer();
            return { name: origName || path.basename(safeRel) || `${fallbackBaseName}.jpg`, data: Buffer.from(arr) };
          }
        }
      } catch (_) {}
    }

    if (rawUrl.startsWith('http')) {
      try {
        const resp = await fetch(rawUrl);
        if (resp.ok) {
          const arr = await resp.arrayBuffer();
          return { name: origName || `${fallbackBaseName}.jpg`, data: Buffer.from(arr) };
        }
      } catch (_) {}
    }
    return null;
  };

  const safeBom = bom || {};
  const vehicleLoading = safeBom.vehicleLoading || safeBom.accounts_verification?._extra_data?.vehicleLoading || {};
  const packingPhotos =
    safeBom.dispatchPackingMedia?.photos ||
    safeBom.dispatch_packing_media?.photos ||
    safeBom.accounts_verification?._extra_data?.dispatchPackingMedia?.photos ||
    [];
  const loadingPhotos = Array.isArray(vehicleLoading.photos) ? vehicleLoading.photos : [];

  const entries = [];
  const usedNames = new Set();
  const pushUnique = (folder, fileObj) => {
    if (!fileObj || !fileObj.data) return;
    let cleanName = String(fileObj.name || 'file.jpg').replace(/[^a-zA-Z0-9._-]/g, '_');
    let fullName = `${folder}/${cleanName}`;
    let counter = 2;
    while (usedNames.has(fullName)) {
      const dot = cleanName.lastIndexOf('.');
      const numbered = dot > 0 ? `${cleanName.slice(0, dot)}_${counter}${cleanName.slice(dot)}` : `${cleanName}_${counter}`;
      fullName = `${folder}/${numbered}`;
      counter++;
    }
    usedNames.add(fullName);
    entries.push({ name: fullName, data: fileObj.data });
  };

  for (let i = 0; i < packingPhotos.length; i++) {
    const f = await resolveFileToBuffer(packingPhotos[i], `packing_photo_${i + 1}`);
    pushUnique('Packing_Images', f);
  }
  for (let i = 0; i < loadingPhotos.length; i++) {
    const f = await resolveFileToBuffer(loadingPhotos[i], `loading_photo_${i + 1}`);
    pushUnique('Packing_Images', f);
  }

  const lrDoc = safeBom.lrCopyDoc || safeBom.accounts_verification?._extra_data?.lrCopyDoc || vehicleLoading.lrCopyDoc || null;
  if (lrDoc) {
    const lrFile = await resolveFileToBuffer(lrDoc, 'LR_Copy');
    pushUnique('LR_Copy', lrFile);
  }

  if (entries.length === 0) {
    return { empty: true };
  }

  const safeCode = String(targetBomCode || 'Order').replace(/[^a-zA-Z0-9_-]/g, '_');
  return {
    filename: `${safeCode}_Dispatch_Files.zip`,
    buffer: buildZipBuffer(entries)
  };
}
