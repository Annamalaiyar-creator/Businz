// ⚡ Real-Time Instant Data Synchronization Service (WhatsApp-Style Sub-Second Push)
// Connects to /api/realtime-events using Native Server-Sent Events (SSE)
let activeEventSource = null;
let reconnectTimer = null;
let consecutiveErrors = 0;
let sseSupported = null;
let storageUpdateTimer = null;

const emitStorageUpdate = () => {
  if (storageUpdateTimer) return;
  storageUpdateTimer = setTimeout(() => {
    storageUpdateTimer = null;
    try {
      window.dispatchEvent(new Event('controlroom_storage_update'));
    } catch (_) {}
  }, 150);
};

export const initRealtimeSync = () => {
  if (typeof window === 'undefined') return;
  if (activeEventSource) return;

  const connect = () => {
    if (sseSupported === false && consecutiveErrors >= 3) {
      return;
    }

    try {
      if (activeEventSource) {
        try { activeEventSource.close(); } catch (_) {}
        activeEventSource = null;
      }

      activeEventSource = new EventSource('/api/realtime-events');

      activeEventSource.onopen = () => {
        consecutiveErrors = 0;
        sseSupported = true;
        console.log('⚡ [Real-Time Sync] Connected to Server Push Gateway');
      };

      activeEventSource.onmessage = (event) => {
        try {
          if (!event.data) return;
          const data = JSON.parse(event.data);
          const { type, payload } = data;

          if (type === 'connected') return;

          // 1. Inventory & Raw Materials Stock balance
          if (type === 'inventory_updated' || (type === 'store_updated' && payload?.key === 'raw_materials_store')) {
            const mats = payload?.rawMaterials || payload?.storeData;
            if (Array.isArray(mats) && mats.length > 0) {
              try {
                localStorage.setItem('controlroom_raw_materials_store', JSON.stringify(mats));
              } catch (_) {}
            }
            window.dispatchEvent(new CustomEvent('controlroom_raw_materials_update', { detail: payload }));
            window.dispatchEvent(new Event('central_inventory_updated'));
            emitStorageUpdate();
          }

          // 2. Finished Goods & Component Catalog
          if (type === 'item_store_updated' || (type === 'store_updated' && (payload?.key === 'item_store' || payload?.key === 'vrm_prod_inventory'))) {
            const items = payload?.items || payload?.storeData;
            if (Array.isArray(items) && items.length > 0) {
              try {
                localStorage.setItem('controlroom_items_list', JSON.stringify(items));
              } catch (_) {}
            }
            window.dispatchEvent(new CustomEvent('controlroom_items_update', { detail: payload }));
            window.dispatchEvent(new Event('central_inventory_updated'));
            emitStorageUpdate();
          }

          // 3. BOM Orders & Routing
          if (type === 'bom_updated' || (type === 'store_updated' && payload?.key === 'bom_store')) {
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
            window.dispatchEvent(new CustomEvent('controlroom_bom_updated', { detail: payload }));
            window.dispatchEvent(new CustomEvent('controlroom_bom_store_updated', { detail: payload }));
            emitStorageUpdate();
          }

          // 4. Production Work Orders
          if (type === 'workorder_updated' || (type === 'store_updated' && (payload?.key === 'workorder_store' || payload?.key === 'vrm_prod_workorders'))) {
            window.dispatchEvent(new CustomEvent('controlroom_workorder_updated', { detail: payload }));
            emitStorageUpdate();
          }

          // 5. Purchase Orders & Approvals
          if (type === 'po_updated' || (type === 'store_updated' && payload?.key === 'po_store')) {
            window.dispatchEvent(new CustomEvent('controlroom_po_updated', { detail: payload }));
            emitStorageUpdate();
          }

          // 6. Goods Receipt Notes (GRN)
          if (type === 'grn_updated' || (type === 'store_updated' && payload?.key === 'grn_store')) {
            window.dispatchEvent(new CustomEvent('controlroom_grn_completed', { detail: payload }));
            emitStorageUpdate();
          }

          // 7. Proforma Invoices & Invoices
          if (type === 'pi_updated' || (type === 'store_updated' && (payload?.key === 'sales_pi_store' || payload?.key === 'proforma_invoice_store' || payload?.key === 'invoice_store'))) {
            window.dispatchEvent(new CustomEvent('controlroom_pi_updated', { detail: payload }));
            window.dispatchEvent(new CustomEvent('controlroom_invoice_updated', { detail: payload }));
            emitStorageUpdate();
          }

          // 8. CRM Leads, Opportunities, Quotations, and Customers
          if (type === 'crm_updated' || (type === 'store_updated' && (payload?.key?.startsWith('crm_') || payload?.key === 'customer_store'))) {
            window.dispatchEvent(new CustomEvent('controlroom_crm_updated', { detail: payload }));
            window.dispatchEvent(new CustomEvent('controlroom_customer_update', { detail: payload }));
            emitStorageUpdate();
          }

          // 9. Instant WhatsApp Messages
          if (type === 'whatsapp_message') {
            window.dispatchEvent(new CustomEvent('controlroom_whatsapp_message', { detail: payload }));
          }

          // 10. Real-time Workflow Notifications (Instant push across different logins / machines)
          if (type === 'workflow_notification' || (type === 'store_updated' && payload?.key === 'notifications_store')) {
            const notif = payload?.notification || (Array.isArray(payload?.storeData) ? payload.storeData[0] : null);
            if (notif) {
              window.dispatchEvent(new CustomEvent('vrm_workflow_toast', { detail: { ...notif, fromBroadcast: true } }));
              window.dispatchEvent(new Event('vrm_notifications_updated'));
            }
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
          reconnectTimer = setTimeout(connect, 15000);
        } else {
          sseSupported = false;
        }
      };
    } catch (err) {
      consecutiveErrors++;
      if (consecutiveErrors < 5) {
        clearTimeout(reconnectTimer);
        reconnectTimer = setTimeout(connect, 15000);
      }
    }
  };

  connect();
};
