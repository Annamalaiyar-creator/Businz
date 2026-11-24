import React from 'react';
import StatusBadge from '../StatusBadge';
import { formatAddressObj } from '../../utils/otherViewsShared';

export function getMissingPoFields(isDraft = false, fields = {}) {
  const {
    vendorName,
    deliveryAddress1 = '',
    deliveryAddress2 = '',
    deliveryCity = '',
    deliveryState = '',
    deliveryPincode = '',
    deliveryAddress = '',
    poDate,
    deliveryDate,
    paymentTerms,
    purchaser,
    shipmentPref,
    currency,
    priority,
    items = []
  } = fields;

  const missingFields = [];
  if (!vendorName || String(vendorName).trim() === '') missingFields.push('Vendor Name');
  const effDelAddress = formatAddressObj({ address1: deliveryAddress1, address2: deliveryAddress2, city: deliveryCity, state: deliveryState, pincode: deliveryPincode }) || (deliveryAddress || '').trim();
  if (!effDelAddress || (!deliveryAddress1.trim() && !deliveryCity.trim() && !deliveryAddress.trim())) missingFields.push('Delivery Address');
  if (!poDate || String(poDate).trim() === '') missingFields.push('PO Date');
  if (!deliveryDate || String(deliveryDate).trim() === '') missingFields.push('Expected Delivery Date');
  if (!paymentTerms || String(paymentTerms).trim() === '') missingFields.push('Payment Terms');
  if (!purchaser || String(purchaser).trim() === '') missingFields.push('PO Issued By');
  if (!shipmentPref || String(shipmentPref).trim() === '') missingFields.push('Shipment Preference');
  if (!currency || String(currency).trim() === '') missingFields.push('Currency');
  if (!priority || String(priority).trim() === '') missingFields.push('Priority');

  const validItems = (items || []).filter(it => it && String(it.name || '').trim() !== '' && Number(it.qty) > 0);
  if (validItems.length === 0) {
    missingFields.push('Line Items (Must add at least 1 valid item with Name and Quantity)');
  } else if (!isDraft) {
    const zeroRateItems = validItems.filter(it => !it.isPresetItem && !(Number(it.rate) > 0));
    if (zeroRateItems.length > 0) {
      missingFields.push('Item Rate (₹) must be greater than 0 for all line items');
    }
  }
  return missingFields;
}

export function renderPoStatusBadge(type, label, isAccounts = false) {
  const raw = String(label || type || '').trim();
  if (isAccounts && (raw === 'MD Approved' || raw === 'md_approved')) {
    return <StatusBadge status="Awaiting Accounts Verification" size="sm" />;
  }
  if (raw === 'Draft' || raw === 'DRAFT') {
    return <StatusBadge status="Draft" customLabel="Draft" size="sm" />;
  }
  if (raw === 'Draft / Pending Approval' || raw === 'Pending MD Approval' || raw === 'Pending Approval' || raw === 'pending') {
    return <StatusBadge status="Pending Approval" customLabel="Pending Approval" size="sm" />;
  }
  if (raw === 'CLOSED / FULLY RECEIVED' || raw === 'Closed / Fully Received' || raw.toLowerCase().includes('fully received') || raw.toLowerCase() === 'closed') {
    return <StatusBadge status="Fully Received" customLabel="Fully Received" size="sm" />;
  }
  if (raw === 'OPEN / PARTIALLY RECEIVED' || raw === 'Partially Received' || raw.toLowerCase().includes('partially')) {
    return <StatusBadge status="Partially Received" customLabel="Partially Received" size="sm" />;
  }
  if (raw === 'Payment Processed / Credit Verified' || raw === 'Payment Processed') {
    return <StatusBadge status="Payment Processed" customLabel="Payment Processed" size="sm" />;
  }
  const rawLower = raw.toLowerCase();
  if (rawLower.includes('proceed po') || rawLower === 'proceed_po' || rawLower === 'pending grn') {
    return <StatusBadge status="Proceed PO" label="Pending GRN" size="sm" />;
  }
  if (raw === 'CANCELLED' || raw === 'Cancelled') {
    return <StatusBadge status="Cancelled" customLabel="Cancelled" size="sm" />;
  }
  return <StatusBadge status={label || type} size="sm" />;
}

export function executeDeletePoRecord({ deleteIdx, setDeleteIdx, poList, setPoList, fetchZohoPOs }) {
  if (deleteIdx !== null && poList[deleteIdx]) {
    const targetPO = poList[deleteIdx];
    const targetId = targetPO.poNo || targetPO.id;
    setPoList(prev => prev.filter((_, i) => i !== deleteIdx));
    setDeleteIdx(null);
    if (targetId) {
      fetch(`/api/purchaseorders/${encodeURIComponent(targetId)}`, {
        method: 'DELETE'
      }).then(res => res.json()).then(data => {
        console.log('PO deleted:', data);
        if (fetchZohoPOs) fetchZohoPOs();
      }).catch(err => {
        console.error('Failed to delete PO in backend:', err);
        if (fetchZohoPOs) fetchZohoPOs();
      });
    }
  }
}
