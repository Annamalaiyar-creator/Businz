import { useState, useEffect } from 'react';
import { getPurchaseOrders, getVendors, getItems } from '../../services/businzDataService';
import { fetchWithTimeout } from '../../utils/fetchWithTimeout';

export function usePoDataSync({ getPoStage }) {
  const [poList, setPoList] = useState([]);
  const [tableLoading, setTableLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [zohoVendors, setZohoVendors] = useState([]);
  const [zohoItems, setZohoItems] = useState([]);

  const fetchZohoPOs = async (isBackground = false) => {
    if (!isBackground) {
      setTableLoading(true);
    }
    try {
      const safePOs = await getPurchaseOrders();
      const normalize = (s) => String(s || '').replace(/[/_\-\s]/g, '').toLowerCase();

      const mergeWithPrev = (incomingList, currentPrev) => {
        const prevMap = new Map();
        currentPrev.forEach(p => {
          const pNo = normalize(p.poNo);
          const pId = normalize(p.id);
          const pZohoId = normalize(p.zohoId);
          if (pNo) prevMap.set(pNo, p);
          if (pId) prevMap.set(pId, p);
          if (pZohoId) prevMap.set(pZohoId, p);
        });

        const mergedIncoming = incomingList.map(p => {
          const pNo = normalize(p.poNo);
          const pId = normalize(p.id);
          const pZohoId = normalize(p.zohoId);
          const existing = prevMap.get(pNo) || prevMap.get(pId) || prevMap.get(pZohoId);
          if (existing) {
            const stageRank = {
              'PURE_DRAFT': 0,
              'Draft': 1,
              'MD_APPROVED': 2,
              'PAYMENT_PROCESSED': 3,
              'PROCEED_PO': 4,
              'PARTIALLY_RECEIVED': 5,
              'CLOSED': 6,
              'REJECTED': 7
            };
            const existingRank = stageRank[getPoStage(existing)] || 1;
            const incomingRank = stageRank[getPoStage(p)] || 1;
            const keepIncoming = incomingRank >= existingRank;
            const incomingItems = Array.isArray(p.items) && p.items.length > 0 
              ? p.items 
              : (Array.isArray(p.line_items) && p.line_items.length > 0 ? p.line_items : []);
            const existingItems = Array.isArray(existing.items) && existing.items.length > 0 
              ? existing.items 
              : (Array.isArray(existing.line_items) && existing.line_items.length > 0 ? existing.line_items : []);

            const effStatus = keepIncoming ? (p.status || existing.status) : existing.status;
            const effStatusType = keepIncoming ? (p.statusType || existing.statusType) : existing.statusType;
            const effTotalOrd = (p.totalOrderedQty !== undefined && Number(p.totalOrderedQty) > 0) ? p.totalOrderedQty : (existing.totalOrderedQty !== undefined ? existing.totalOrderedQty : (incomingItems.length > 0 ? incomingItems.reduce((s, it) => s + Number(it.qty || 0), 0) : existingItems.reduce((s, it) => s + Number(it.qty || 0), 0)));
            const effTotalRec = (p.totalReceivedQty !== undefined && Number(p.totalReceivedQty) >= 0) ? p.totalReceivedQty : (existing.totalReceivedQty !== undefined ? existing.totalReceivedQty : (p.totalReceived !== undefined ? p.totalReceived : existing.totalReceived));
            const effRemaining = effTotalOrd !== undefined && effTotalRec !== undefined ? Math.max(0, Number(effTotalOrd) - Number(effTotalRec)) : (p.totalRemainingQty !== undefined ? p.totalRemainingQty : existing.totalRemainingQty);

            return {
              ...existing,
              ...p,
              status: effStatus,
              statusType: effStatusType,
              totalOrderedQty: effTotalOrd,
              totalReceivedQty: effTotalRec,
              totalRemainingQty: effRemaining,
              totalReceived: effTotalRec,
              receivingProgressPct: (Number(effTotalOrd) > 0 && Number(effTotalRec) >= 0) ? ((Number(effTotalRec) / Number(effTotalOrd)) * 100).toFixed(1) : (p.receivingProgressPct || existing.receivingProgressPct || '0.0'),
              grnCount: p.grnCount !== undefined ? p.grnCount : existing.grnCount,
              approvedBy: existing.approvedBy || p.approvedBy,
              approvedAt: existing.approvedAt || p.approvedAt || p.approved_at,
              approvedDate: existing.approvedDate || p.approvedDate,
              approvedTime: existing.approvedTime || p.approvedTime,
              createdAt: existing.createdAt || p.createdAt || p.created_at,
              approvalRemarks: existing.approvalRemarks || p.approvalRemarks,
              paymentDetails: p.paymentDetails || existing.paymentDetails,
              proceedDetails: p.proceedDetails || existing.proceedDetails,
              items: incomingItems.length > 0 ? incomingItems : existingItems,
              vendor: (existing.vendor && existing.vendor !== 'Vendor' && existing.vendor !== 'Annamalaiyar') ? existing.vendor : (p.vendor || existing.vendor || 'Vendor'),
              deliveryAddress: (p.deliveryAddress && p.deliveryAddress !== '—' && p.deliveryAddress !== '') ? p.deliveryAddress : (existing.deliveryAddress || '—'),
              billingAddress: (p.billingAddress && p.billingAddress !== '—' && p.billingAddress !== '') ? p.billingAddress : (existing.billingAddress || '—'),
              paymentTerms: (p.paymentTerms && p.paymentTerms !== 'Net 30 Days') ? p.paymentTerms : (existing.paymentTerms || p.paymentTerms || 'Due on Receipt'),
              advancePaidPct: p.advancePaidPct !== undefined ? p.advancePaidPct : existing.advancePaidPct,
              advancePendingPct: p.advancePendingPct !== undefined ? p.advancePendingPct : existing.advancePendingPct,
              notes: (p.notes && p.notes !== '') ? p.notes : (existing.notes || ''),
              terms: (p.terms && p.terms !== '') ? p.terms : (existing.terms || ''),
              scope: p.scope || existing.scope || 'Vendor Scope',
              priority: p.priority || existing.priority || 'High',
              transportName: p.transportName || existing.transportName || '',
              shippingCharges: p.shippingCharges !== undefined ? p.shippingCharges : (existing.shippingCharges || 0),
              otherCharges: p.otherCharges !== undefined ? p.otherCharges : (existing.otherCharges || 0),
              discountPct: p.discountPct !== undefined ? p.discountPct : (existing.discountPct || 0),
              purchaser: (p.purchaser && p.purchaser !== '—') ? p.purchaser : (existing.purchaser || '—'),
              amount: (p.amount && p.amount !== '₹0.00' && p.amount !== '₹ 0.00') ? p.amount : (existing.amount || p.amount)
            };
          }
          return p;
        });

        if (Array.isArray(incomingList) && incomingList.length === 0) {
          return [];
        }

        const existingKeys = new Set(mergedIncoming.map(p => normalize(p?.poNo || p?.id)));
        const safePrev = Array.isArray(currentPrev) ? currentPrev : [];
        const localOnly = safePrev.filter(p => {
          if (!p) return false;
          const k1 = normalize(p.poNo);
          const k2 = normalize(p.id);
          return (k1 && !existingKeys.has(k1)) && (k2 && !existingKeys.has(k2));
        });

        return [...mergedIncoming, ...localOnly];
      };

      const updateIfChanged = (incoming) => {
        setPoList(prev => {
          const merged = mergeWithPrev(incoming, prev);
          if (Array.isArray(prev) && prev.length === merged.length) {
            try {
              if (JSON.stringify(prev) === JSON.stringify(merged)) {
                return prev;
              }
            } catch (_) {}
          }
          return merged;
        });
      };

      if (Array.isArray(safePOs)) {
        updateIfChanged(safePOs);
      } else {
        const response = await fetchWithTimeout('/api/purchaseorders', { timeout: 25000 }).catch(() => null);
        if (response && response.ok) {
          const zohoPOs = await response.json().catch(() => []);
          if (Array.isArray(zohoPOs)) {
            updateIfChanged(zohoPOs);
          }
        }
      }
    } catch (err) {
      console.error("Error fetching POs:", err);
    } finally {
      if (!isBackground) {
        setTableLoading(false);
      }
    }
  };

  const handleManualRefresh = async () => {
    setIsRefreshing(true);
    try {
      await fetchZohoPOs(true);
    } finally {
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    const fetchZohoDropdowns = async () => {
      try {
        const [safeVendors, safeItems] = await Promise.all([
          getVendors(),
          getItems()
        ]);
        if (Array.isArray(safeVendors) && safeVendors.length > 0) {
          setZohoVendors(safeVendors);
        } else {
          const vRes = await fetchWithTimeout('/api/vendors', { timeout: 25000 }).catch(() => null);
          if (vRes && vRes.ok) {
            const vData = await vRes.json().catch(() => []);
            setZohoVendors(vData || []);
          }
        }

        if (Array.isArray(safeItems) && safeItems.length > 0) {
          setZohoItems(safeItems);
        } else {
          const iRes = await fetchWithTimeout('/api/items', { timeout: 25000 }).catch(() => null);
          if (iRes && iRes.ok) {
            const iData = await iRes.json().catch(() => []);
            setZohoItems(iData || []);
          }
        }
      } catch (err) {
        console.error("Failed to fetch dropdown resources:", err);
      }
    };
    fetchZohoPOs();
    fetchZohoDropdowns();

    // Instant Real-Time Push Listener: Refetches POs the millisecond another user creates, approves, or modifies a PO
    const handlePoPush = () => {
      fetchZohoPOs(true);
    };

    const handleGrnCompleted = (e) => {
      const grn = e?.detail;
      if (grn) {
        const clean = (s) => String(s || '').replace(/[/_\-\s]/g, '').toLowerCase();
        const poRef = clean(grn.poRef || grn.poNo);
        setPoList(prev => prev.map(p => {
          const pNo = clean(p.poNo);
          const pId = clean(p.id);
          const pZohoId = clean(p.zohoId);
          if (poRef && (pNo === poRef || pId === poRef || pZohoId === poRef)) {
            const isClosed = String(grn.status || '').toUpperCase().includes('CLOSED') || 
                             String(grn.status || '').toUpperCase().includes('FULLY') || 
                             grn.forceClosePO === true;
            const newStatus = isClosed ? 'CLOSED / FULLY RECEIVED' : 'OPEN / PARTIALLY RECEIVED';
            const accepted = Number(grn.acceptedQty !== undefined ? grn.acceptedQty : (grn.receivedQty || 0));
            const newRec = Number(p.totalReceivedQty || p.totalReceived || 0) + accepted;
            const newOrd = Number(p.totalOrderedQty || 0);
            return {
              ...p,
              status: newStatus,
              statusType: isClosed ? 'closed' : 'partially_received',
              order_status: isClosed ? 'closed' : 'received',
              totalReceivedQty: newRec,
              totalReceived: newRec,
              totalRemainingQty: Math.max(0, newOrd - newRec),
              receivingProgressPct: newOrd > 0 ? ((newRec / newOrd) * 100).toFixed(1) : (isClosed ? '100.0' : '0.0'),
              grnCount: (Number(p.grnCount) || 0) + 1
            };
          }
          return p;
        }));
      }
      fetchZohoPOs(true);
    };

    window.addEventListener('controlroom_po_updated', handlePoPush);
    window.addEventListener('controlroom_storage_update', handlePoPush);
    window.addEventListener('controlroom_grn_completed', handleGrnCompleted);

    return () => {
      window.removeEventListener('controlroom_po_updated', handlePoPush);
      window.removeEventListener('controlroom_storage_update', handlePoPush);
      window.removeEventListener('controlroom_grn_completed', handleGrnCompleted);
    };
  }, []);
  return {
    poList,
    setPoList,
    tableLoading,
    setTableLoading,
    isRefreshing,
    setIsRefreshing,
    zohoVendors,
    setZohoVendors,
    zohoItems,
    setZohoItems,
    fetchZohoPOs,
    handleManualRefresh
  };
}
