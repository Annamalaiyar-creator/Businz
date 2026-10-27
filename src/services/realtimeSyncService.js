// ⚡ Real-Time Instant Data Synchronization Service (WhatsApp-Style Sub-Second Push)
// Connects to /api/realtime-events using Native Server-Sent Events (SSE)
let activeEventSource = null;
let reconnectTimer = null;
let consecutiveErrors = 0;
let sseSupported = null;
let storageUpdateTimer = null;
let lastReceivedSeq = 0;

const emitStorageUpdate = () => {
  if (storageUpdateTimer) return;
  storageUpdateTimer = setTimeout(() => {
    storageUpdateTimer = null;
    try {
      window.dispatchEvent(new Event('controlroom_storage_update'));
    } catch (_) {}
  }, 300);
};

export const initRealtimeSync = () => {
  if (typeof window === 'undefined') return;
  if (activeEventSource) return;

  const connect = () => {
    if (sseSupported === false && consecutiveErrors >= 5) {
      return;
    }

    try {
      if (activeEventSource) {
        try { activeEventSource.close(); } catch (_) {}
        activeEventSource = null;
      }

      const sseUrl = lastReceivedSeq > 0
        ? `/api/realtime-events?lastEventId=${lastReceivedSeq}`
        : '/api/realtime-events';

      activeEventSource = new EventSource(sseUrl);

      activeEventSource.onopen = () => {
        consecutiveErrors = 0;
        sseSupported = true;
        console.log('⚡ [Real-Time Sync] Connected to Server Push Gateway (Seq:', lastReceivedSeq, ')');
      };

      activeEventSource.onmessage = (event) => {
        try {
          if (!event.data) return;
          const data = JSON.parse(event.data);
          if (data.seq) {
            lastReceivedSeq = Math.max(lastReceivedSeq, data.seq);
          }

          const { type, payload, action, recordId } = data;

          if (type === 'connected') return;

          // If missed event gap exceeded buffer or server rebooted, trigger authoritative resync
          if (type === 'resync_required') {
            console.warn('⚡ [Real-Time Sync] Resync required from server:', data.reason || data.message);
            lastReceivedSeq = data.seq || 0;
            emitStorageUpdate();
            return;
          }

          // 1. Inventory & Raw Materials Stock balance
          if (type === 'inventory_updated' || (type === 'store_updated' && payload?.key === 'raw_materials_store')) {
            const mats = payload?.rawMaterials || (Array.isArray(payload?.storeData) ? payload.storeData : null);
            if (Array.isArray(mats) && mats.length > 0) {
              try {
                localStorage.setItem('controlroom_raw_materials_store', JSON.stringify(mats));
              } catch (_) {}
            } else if (payload?.item && payload.item.code) {
              // Direct targeted single-item delta update
              try {
                const existing = JSON.parse(localStorage.getItem('controlroom_raw_materials_store') || '[]');
                const idx = existing.findIndex(m => m && (m.code === payload.item.code || m.id === payload.item.id));
                if (idx !== -1) {
                  existing[idx] = { ...existing[idx], ...payload.item };
                } else {
                  existing.unshift(payload.item);
                }
                localStorage.setItem('controlroom_raw_materials_store', JSON.stringify(existing));
              } catch (_) {}
            } else if (payload?.deletedCodes && Array.isArray(payload.deletedCodes)) {
              try {
                const existing = JSON.parse(localStorage.getItem('controlroom_raw_materials_store') || '[]');
                const remaining = existing.filter(m => m && !payload.deletedCodes.includes(m.code));
                localStorage.setItem('controlroom_raw_materials_store', JSON.stringify(remaining));
              } catch (_) {}
            }
            window.dispatchEvent(new CustomEvent('controlroom_raw_materials_update', { detail: payload }));
            window.dispatchEvent(new Event('central_inventory_updated'));
            // Targeted event dispatched directly to inventory listeners; no generic storage update needed
          }

          // 2. Finished Goods & Component Catalog
          else if (type === 'item_store_updated' || (type === 'store_updated' && (payload?.key === 'item_store' || payload?.key === 'vrm_prod_inventory'))) {
            const items = payload?.items || (Array.isArray(payload?.storeData) ? payload.storeData : null);
            if (Array.isArray(items) && items.length > 0) {
              try {
                localStorage.setItem('controlroom_items_list', JSON.stringify(items));
              } catch (_) {}
            } else if (payload?.item && (payload.item.code || payload.item.itemId || payload.item.id)) {
              // Direct targeted single-item delta update
              try {
                const existing = JSON.parse(localStorage.getItem('controlroom_items_list') || '[]');
                const targetCode = payload.item.code || payload.item.itemId || payload.item.id;
                const idx = existing.findIndex(it => it && (it.code === targetCode || it.itemId === targetCode || it.id === targetCode));
                if (idx !== -1) {
                  existing[idx] = { ...existing[idx], ...payload.item };
                } else {
                  existing.unshift(payload.item);
                }
                localStorage.setItem('controlroom_items_list', JSON.stringify(existing));
              } catch (_) {}
            } else if (payload?.deletedIds && Array.isArray(payload.deletedIds)) {
              try {
                const existing = JSON.parse(localStorage.getItem('controlroom_items_list') || '[]');
                const remaining = existing.filter(it => it && !payload.deletedIds.includes(it.id) && !payload.deletedIds.includes(it.itemId) && !payload.deletedIds.includes(it.code));
                localStorage.setItem('controlroom_items_list', JSON.stringify(remaining));
              } catch (_) {}
            }
            window.dispatchEvent(new CustomEvent('controlroom_items_update', { detail: payload }));
            window.dispatchEvent(new Event('central_inventory_updated'));
            // Targeted event dispatched directly to item listeners; no generic storage update needed
          }

          // 3. BOM Orders & Routing
          else if (type === 'bom_updated' || (type === 'store_updated' && payload?.key === 'bom_store')) {
            if (payload?.printData?.bomCode) {
              window.dispatchEvent(new CustomEvent('vrm_bom_printed', { detail: payload.printData }));
            } else if (payload?.bom?.dispatchPrinted && (payload?.bom?.bomCode || payload?.bom?.id)) {
              window.dispatchEvent(new CustomEvent('vrm_bom_printed', {
                detail: {
                  bomCode: payload.bom.bomCode || payload.bom.code || payload.bom.id,
                  dispatchPrinted: true,
                  dispatchPrintedAt: payload.bom.dispatchPrintedAt,
                  dispatchPrintTimeStr: payload.bom.dispatchPrintTimeStr,
                  dispatchPrintedDateStr: payload.bom.dispatchPrintedDateStr,
                  dispatchPrintedBy: payload.bom.dispatchPrintedBy,
                  dispatchPrintCount: payload.bom.dispatchPrintCount,
                  firstPrintTimeStr: payload.bom.firstPrintTimeStr,
                  secondPrintTimeStr: payload.bom.secondPrintTimeStr,
                  dispatchPrintHistory: payload.bom.dispatchPrintHistory
                }
              }));
            }

            // Direct targeted single BOM delta update into local cache
            if (payload?.bom && typeof payload.bom === 'object') {
              try {
                const existingBoms = JSON.parse(localStorage.getItem('controlroom_bom_store') || '[]');
                const single = payload.bom;
                const k = single.bomCode || single.code || single.id;
                if (k) {
                  const filtered = existingBoms.filter(b => b && b.bomCode !== k && b.code !== k && b.id !== k);
                  localStorage.setItem('controlroom_bom_store', JSON.stringify([single, ...filtered]));
                }
              } catch (_) {}
            } else if ((action === 'delete' || payload?.action === 'delete') && (recordId || payload?.id)) {
              try {
                const targetId = recordId || payload?.id;
                const existingBoms = JSON.parse(localStorage.getItem('controlroom_bom_store') || '[]');
                const remaining = existingBoms.filter(b => b && b.id !== targetId && b.bomCode !== targetId && b.code !== targetId);
                localStorage.setItem('controlroom_bom_store', JSON.stringify(remaining));
              } catch (_) {}
            }

            window.dispatchEvent(new CustomEvent('controlroom_bom_updated', { detail: payload }));
            window.dispatchEvent(new CustomEvent('controlroom_bom_store_updated', { detail: payload }));
          }

          // 4. Production Work Orders
          else if (type === 'workorder_updated' || (type === 'store_updated' && (payload?.key === 'workorder_store' || payload?.key === 'vrm_prod_workorders'))) {
            window.dispatchEvent(new CustomEvent('controlroom_workorder_updated', { detail: payload }));
          }

          // 5. Purchase Orders & Approvals
          else if (type === 'po_updated' || (type === 'store_updated' && payload?.key === 'po_store')) {
            window.dispatchEvent(new CustomEvent('controlroom_po_updated', { detail: payload }));
          }

          // 6. Goods Receipt Notes (GRN)
          else if (type === 'grn_updated' || (type === 'store_updated' && payload?.key === 'grn_store')) {
            window.dispatchEvent(new CustomEvent('controlroom_grn_completed', { detail: payload }));
          }

          // 7. Proforma Invoices & Invoices
          else if (type === 'pi_created' || type === 'pi_updated' || type === 'invoice_updated' || (type === 'store_updated' && (payload?.key === 'sales_pi_store' || payload?.key === 'proforma_invoice_store' || payload?.key === 'invoice_store'))) {
            window.dispatchEvent(new CustomEvent('controlroom_pi_updated', { detail: payload }));
            window.dispatchEvent(new CustomEvent('controlroom_invoice_updated', { detail: payload }));
          }

          // 8. CRM Leads, Opportunities, Quotations, and Customers
          else if (type === 'crm_updated' || type === 'crm_lead_created' || type === 'crm_lead_updated' || type === 'crm_lead_assigned' || type === 'crm_lead_activity_logged' || type === 'crm_lead_status_updated' || (type === 'store_updated' && (payload?.key?.startsWith('crm_') || payload?.key === 'customer_store'))) {
            window.dispatchEvent(new CustomEvent('controlroom_crm_updated', { detail: payload }));
            window.dispatchEvent(new CustomEvent('controlroom_customer_update', { detail: payload }));
          }

          // 9. Instant WhatsApp Messages, Session Updates & Chats Sync
          else if (type === 'whatsapp_message') {
            window.dispatchEvent(new CustomEvent('controlroom_whatsapp_message', { detail: payload }));
          } else if (type === 'whatsapp_session_update') {
            window.dispatchEvent(new CustomEvent('controlroom_whatsapp_session_update', { detail: payload }));
          } else if (type === 'whatsapp_chats_updated') {
            window.dispatchEvent(new CustomEvent('controlroom_whatsapp_chats_updated', { detail: payload }));
          }

          // 10. Real-time Workflow Notifications (Instant push across different logins / machines)
          else if (type === 'workflow_notification' || (type === 'store_updated' && payload?.key === 'notifications_store')) {
            const notif = payload?.notification || (Array.isArray(payload?.storeData) ? payload.storeData[0] : null);
            if (notif && notif.id !== 'NOTIF-001' && !String(notif.title || '').includes('System Central Inventory Initialized')) {
              try {
                const existing = JSON.parse(localStorage.getItem('vrm_live_notifications') || '[]');
                if (!existing.some(e => e.id === notif.id)) {
                  localStorage.setItem('vrm_live_notifications', JSON.stringify([notif, ...existing].slice(0, 50)));
                }
              } catch (_) {}
              window.dispatchEvent(new CustomEvent('vrm_workflow_toast', { detail: { ...notif, fromBroadcast: true } }));
              window.dispatchEvent(new Event('vrm_notifications_updated'));
            }
            // DO NOT call emitStorageUpdate() on notifications to prevent notification fetch storms
          }

          // Global broadcast for any custom listeners
          window.dispatchEvent(new CustomEvent('controlroom_realtime_event', { detail: data }));
        } catch (parseErr) {
          // Ignore keepalive comments or non-JSON packets
        }
      };

      activeEventSource.onerror = () => {
        if (activeEventSource) {
          try { activeEventSource.close(); } catch (_) {}
          activeEventSource = null;
        }
        consecutiveErrors++;
        if (consecutiveErrors < 5) {
          clearTimeout(reconnectTimer);
          reconnectTimer = setTimeout(connect, 10000);
        } else {
          sseSupported = false;
        }
      };
    } catch (err) {
      consecutiveErrors++;
      if (consecutiveErrors < 5) {
        clearTimeout(reconnectTimer);
        reconnectTimer = setTimeout(connect, 10000);
      }
    }
  };

  connect();
};
