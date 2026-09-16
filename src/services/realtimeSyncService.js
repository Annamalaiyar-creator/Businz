// ⚡ Real-Time Instant Data Synchronization Service (WhatsApp-Style Sub-Second Push)
// Connects to /api/realtime-events using Native Server-Sent Events (SSE)
let activeEventSource = null;
let reconnectTimer = null;

export const initRealtimeSync = () => {
  if (typeof window === 'undefined') return;
  if (activeEventSource) return;

  const connect = () => {
    try {
      activeEventSource = new EventSource('/api/realtime-events');

      activeEventSource.onopen = () => {
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
            window.dispatchEvent(new Event('controlroom_raw_materials_update'));
            window.dispatchEvent(new Event('central_inventory_updated'));
            window.dispatchEvent(new Event('controlroom_storage_update'));
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
            window.dispatchEvent(new Event('controlroom_items_update'));
            window.dispatchEvent(new Event('central_inventory_updated'));
            window.dispatchEvent(new Event('controlroom_storage_update'));
          }

          // 3. BOM Orders & Routing
          if (type === 'bom_updated' || (type === 'store_updated' && payload?.key === 'bom_store')) {
            window.dispatchEvent(new CustomEvent('controlroom_bom_updated', { detail: payload }));
            window.dispatchEvent(new CustomEvent('controlroom_bom_store_updated', { detail: payload }));
            window.dispatchEvent(new Event('controlroom_bom_updated'));
            window.dispatchEvent(new Event('controlroom_storage_update'));
          }

          // 4. Production Work Orders
          if (type === 'workorder_updated' || (type === 'store_updated' && (payload?.key === 'workorder_store' || payload?.key === 'vrm_prod_workorders'))) {
            window.dispatchEvent(new CustomEvent('controlroom_workorder_updated', { detail: payload }));
            window.dispatchEvent(new Event('controlroom_workorder_updated'));
            window.dispatchEvent(new Event('controlroom_storage_update'));
          }

          // 5. Purchase Orders & Approvals
          if (type === 'po_updated' || (type === 'store_updated' && payload?.key === 'po_store')) {
            window.dispatchEvent(new CustomEvent('controlroom_po_updated', { detail: payload }));
            window.dispatchEvent(new Event('controlroom_po_updated'));
            window.dispatchEvent(new Event('controlroom_storage_update'));
          }

          // 6. Goods Receipt Notes (GRN)
          if (type === 'grn_updated' || (type === 'store_updated' && payload?.key === 'grn_store')) {
            window.dispatchEvent(new CustomEvent('controlroom_grn_completed', { detail: payload }));
            window.dispatchEvent(new Event('controlroom_grn_completed'));
            window.dispatchEvent(new Event('controlroom_storage_update'));
          }

          // 7. Proforma Invoices & Invoices
          if (type === 'pi_updated' || (type === 'store_updated' && (payload?.key === 'sales_pi_store' || payload?.key === 'proforma_invoice_store' || payload?.key === 'invoice_store'))) {
            window.dispatchEvent(new CustomEvent('controlroom_pi_updated', { detail: payload }));
            window.dispatchEvent(new CustomEvent('controlroom_invoice_updated', { detail: payload }));
            window.dispatchEvent(new Event('controlroom_storage_update'));
          }

          // 8. CRM Leads, Opportunities, Quotations, and Customers
          if (type === 'crm_updated' || (type === 'store_updated' && (payload?.key?.startsWith('crm_') || payload?.key === 'customer_store'))) {
            window.dispatchEvent(new CustomEvent('controlroom_crm_updated', { detail: payload }));
            window.dispatchEvent(new CustomEvent('controlroom_customer_update', { detail: payload }));
            window.dispatchEvent(new Event('controlroom_storage_update'));
          }

          // 9. Instant WhatsApp Messages
          if (type === 'whatsapp_message') {
            window.dispatchEvent(new CustomEvent('controlroom_whatsapp_message', { detail: payload }));
          }

          // Global broadcast for any custom listeners
          window.dispatchEvent(new CustomEvent('controlroom_realtime_event', { detail: data }));
          window.dispatchEvent(new Event('controlroom_storage_update'));
        } catch (parseErr) {
          // Ignore keepalive comments or non-JSON packets
        }
      };

      activeEventSource.onerror = () => {
        if (activeEventSource) {
          activeEventSource.close();
          activeEventSource = null;
        }
        clearTimeout(reconnectTimer);
        reconnectTimer = setTimeout(connect, 3000);
      };
    } catch (err) {
      clearTimeout(reconnectTimer);
      reconnectTimer = setTimeout(connect, 4000);
    }
  };

  connect();
};
