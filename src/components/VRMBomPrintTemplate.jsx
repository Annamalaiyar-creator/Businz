import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Printer, X } from 'lucide-react';
import { getCachedBranding, fetchMasterBranding, subscribeBrandingUpdates } from '../services/brandingService';
import { VRM_OFFICIAL_LOGO } from '../utils/vrmOfficialAssets';
import { isFixedQuantityPreset } from '../vrmHdgProposalPresets';

// Helper to clean, deduplicate and format addresses into neat lines
function formatAddressLines(rawAddr, city, state, pin) {
  let combined = String(rawAddr || '').trim();
  if (!combined && !city && !state && !pin) return ['Address on file'];

  // Deduplicate repeated comma-separated tokens (e.g. repeated "Chennai, Tamil Nadu, PIN: 600098")
  const rawSegments = combined.split(',').map(s => s.trim()).filter(Boolean);
  const seen = new Set();
  const deduped = [];
  for (const seg of rawSegments) {
    const key = seg.toLowerCase().replace(/[^a-z0-9]/g, '');
    if (!seen.has(key)) {
      seen.add(key);
      deduped.push(seg);
    }
  }

  // Ensure city, state, pin are present if known
  const joinedLower = deduped.join(', ').toLowerCase();
  if (city && !joinedLower.includes(String(city).toLowerCase())) {
    deduped.push(city);
  }
  if (state && !joinedLower.includes(String(state).toLowerCase())) {
    deduped.push(state);
  }
  if (pin && !deduped.join(' ').includes(String(pin))) {
    deduped.push(`PIN: ${pin}`);
  }

  // Group into clean street line and location line
  const streetParts = [];
  const locParts = [];
  for (const seg of deduped) {
    const lower = seg.toLowerCase();
    if (lower.includes('pin') || /^\d{6}$/.test(seg)) {
      locParts.push(seg.toLowerCase().includes('pin') ? seg : `PIN: ${seg}`);
    } else if (state && lower.includes(String(state).toLowerCase())) {
      locParts.unshift(seg);
    } else if (city && lower.includes(String(city).toLowerCase())) {
      locParts.unshift(seg);
    } else {
      streetParts.push(seg);
    }
  }

  const lines = [];
  if (streetParts.length > 0) lines.push(streetParts.join(', '));
  if (locParts.length > 0) lines.push(Array.from(new Set(locParts)).join(', '));

  return lines.length > 0 ? lines : ['Address on file'];
}

// Helper to clean and format dates strictly to DD/MM/YYYY
function formatDateDDMMYYYY(val) {
  if (!val) return '—';
  const s = String(val).trim();
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) {
    return `${m[3]}/${m[2]}/${m[1]}`;
  }
  const d = new Date(s);
  if (!isNaN(d.getTime())) {
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    return `${day}/${month}/${year}`;
  }
  return s;
}

export function VRMBomPrintSheet({ bomData, id = "printable-bom-document", isSales = false, userRole = '' }) {
  const [branding, setBranding] = useState(getCachedBranding);
  const effectiveRole = userRole || (typeof localStorage !== 'undefined' ? (localStorage.getItem('controlroom_user_role') || '') : '');
  const isDispatchRole = /dispatch/i.test(effectiveRole);
  const isSalesUser = Boolean(isSales || !isDispatchRole || /sales/i.test(effectiveRole));

  useEffect(() => {
    let isMounted = true;
    fetchMasterBranding().then(b => {
      if (isMounted && b) setBranding(b);
    });
    const unsub = subscribeBrandingUpdates(b => {
      if (isMounted && b) setBranding(b);
    });
    return () => {
      isMounted = false;
      unsub();
    };
  }, []);

  if (!bomData) return null;

  const b = bomData;

  // Fallback to source PI for fallback data if BOM has missing fields, items, or kit metadata
  let matchedPi = null;
  try {
    const piNum = b.sourcePiNo || b.source_pi_no || b.piNo;
    const bCode = b.bomCode || b.code || b.id;
    const rawPi = (typeof localStorage !== 'undefined') && (localStorage.getItem('controlroom_sales_pi_store') || localStorage.getItem('sales_pi_store') || localStorage.getItem('proforma_invoices'));
    if (rawPi) {
      const pis = JSON.parse(rawPi);
      if (Array.isArray(pis)) {
        matchedPi = pis.find(p => p && (
          (piNum && (p.piNo === piNum || p.id === piNum || p.estimate_number === piNum)) ||
          (bCode && (p.convertedBomCode === bCode || p.convertedBomNo === bCode))
        ));
      }
    }
  } catch {}

  let items = (Array.isArray(b.items) && b.items.length > 0)
    ? b.items
    : (Array.isArray(b.lineItems) && b.lineItems.length > 0)
      ? b.lineItems
      : (Array.isArray(b.materials) && b.materials.length > 0)
        ? b.materials
        : (matchedPi && Array.isArray(matchedPi.items) && matchedPi.items.length > 0)
          ? matchedPi.items
          : (Array.isArray(b.dispatchPacking) && b.dispatchPacking.length > 0)
            ? b.dispatchPacking
            : [];

  // If items only has bare dispatchPacking without codes/rates/presets, and matchedPi has rich items, prefer matchedPi.items
  if (items.length > 0 && !items.some(it => it.code || it.rate || it.isPresetItem || it.presetName) && matchedPi && Array.isArray(matchedPi.items) && matchedPi.items.length > 0) {
    items = matchedPi.items;
  }

  // 1. Build preset groups dictionary from BOM or matched PI
  let presetGroupsObj = {};
  if (b.presetGroups) {
    if (Array.isArray(b.presetGroups)) {
      b.presetGroups.forEach((g, idx) => {
        if (g && (g.groupId || g.presetId || g.presetName)) {
          const gid = g.groupId || g.presetId || `grp_${idx}`;
          presetGroupsObj[gid] = g;
        }
      });
    } else if (typeof b.presetGroups === 'object') {
      presetGroupsObj = { ...b.presetGroups };
    }
  }
  if (Object.keys(presetGroupsObj).length === 0 && matchedPi?.presetGroups) {
    if (Array.isArray(matchedPi.presetGroups)) {
      matchedPi.presetGroups.forEach((g, idx) => {
        if (g && (g.groupId || g.presetId || g.presetName)) {
          const gid = g.groupId || g.presetId || `grp_${idx}`;
          presetGroupsObj[gid] = g;
        }
      });
    } else if (typeof matchedPi.presetGroups === 'object') {
      presetGroupsObj = { ...matchedPi.presetGroups };
    }
  }

  // 2. Enrich items with preset kit names and group IDs
  const piItems = (matchedPi && Array.isArray(matchedPi.items)) ? matchedPi.items : [];
  const enrichedItems = items.map((it, idx) => {
    let pName = it.presetName || it.kitName;
    let pGroupId = it.presetGroupId;
    let isPreset = Boolean(it.isPresetItem || pGroupId || pName);
    let itemBaseQty = it.baseQty;

    // If missing on item, lookup from matched PI item by code or name or index
    if (piItems.length > 0) {
      const itCode = (it.code || '').trim().toUpperCase();
      const itName = (it.name || it.itemName || '').trim().toLowerCase();
      const matchedPiItem = piItems.find(piIt => 
        (piIt.id && it.id && piIt.id === it.id) ||
        (itCode && piIt.code && piIt.code.trim().toUpperCase() === itCode) ||
        (itName && piIt.name && piIt.name.trim().toLowerCase() === itName)
      ) || (!pName && !pGroupId ? piItems[idx] : null);

      if (matchedPiItem) {
        if (!pName) pName = matchedPiItem.presetName || matchedPiItem.kitName;
        if (!pGroupId) pGroupId = matchedPiItem.presetGroupId;
        if (!isPreset) isPreset = Boolean(matchedPiItem.isPresetItem || pGroupId || pName);
        if ((itemBaseQty == null || itemBaseQty === '') && matchedPiItem.baseQty != null && matchedPiItem.baseQty !== '') {
          itemBaseQty = matchedPiItem.baseQty;
        }
      }
    }

    // If still missing, check if BOM has a global presetName
    if (!pName && !pGroupId && (b.presetName || matchedPi?.presetName)) {
      if (it.isPresetItem || (parseFloat(it.rate || 0) === 0 && (b.unitValue || b.orderValue)) || Object.keys(presetGroupsObj).length <= 1) {
        pName = b.presetName || matchedPi?.presetName;
        pGroupId = Object.keys(presetGroupsObj)[0] || 'default_kit';
        isPreset = true;
      }
    }

    // Resolve name from presetGroupsObj if groupId is present
    if (pGroupId && presetGroupsObj[pGroupId]?.presetName && !pName) {
      pName = presetGroupsObj[pGroupId].presetName;
    }

    return {
      ...it,
      originalIndex: idx,
      presetName: pName,
      presetGroupId: pGroupId,
      isPresetItem: isPreset,
      baseQty: itemBaseQty
    };
  });

  // 3. Group into Distinct Kits and Standalone Items
  const kitGroupsMap = new Map();
  const standaloneItems = [];

  enrichedItems.forEach(item => {
    if (item.isPresetItem || item.presetGroupId || item.presetName) {
      const key = item.presetGroupId || item.presetName || 'default_kit';
      if (!kitGroupsMap.has(key)) {
        const grpMeta = (item.presetGroupId && presetGroupsObj[item.presetGroupId]) || {};
        const pName = grpMeta.presetName || item.presetName || b.presetName || matchedPi?.presetName || 'Preset Kit';
        const sCount = grpMeta.setCount || item.setCount || b.presetSetCount || matchedPi?.presetSetCount || 1;
        kitGroupsMap.set(key, {
          groupId: key,
          presetId: grpMeta.presetId || item.presetId || null,
          presetName: pName,
          setCount: sCount,
          items: []
        });
      }
      const currentGroup = kitGroupsMap.get(key);
      if ((!currentGroup.setCount || Number(currentGroup.setCount) <= 1) && item.setCount && Number(item.setCount) > 1) {
        currentGroup.setCount = item.setCount;
      }
      currentGroup.items.push(item);
    } else {
      standaloneItems.push(item);
    }
  });

  const kitGroups = Array.from(kitGroupsMap.values());
  const hasMultipleKits = kitGroups.length > 1;
  const hasAnyKits = kitGroups.length > 0;

  // Helper to determine the actual total quantity for BOM printout
  const getItemQty = (item) => {
    return parseFloat(item.qty || item.bomQty || item.quantity || item.targetQty || item.orderedQty || item.packedQty || item.itemQty || 0) || 0;
  };

  // Helper to determine the entire quantity for fixed-quantity presets (12 presets)
  const getEntireKitItemQty = (item, setCount) => {
    const sCount = parseInt(setCount) || 1;
    const baseQ = parseFloat(item.baseQty) || (parseFloat(item.qty || item.bomQty || item.quantity) || 1);
    const entireQty = Math.round(baseQ * sCount * 100) / 100;
    return entireQty > 0 ? entireQty : (parseFloat(item.qty) || sCount);
  };

  // Helper to determine strictly the 1-set quantity for BOM printout (Option 2)
  const getItemPerSetQty = (item, setCount) => {
    // 1. Check if explicit baseQty (quantity per 1 set) is available
    if (item.baseQty !== undefined && item.baseQty !== null && item.baseQty !== '' && !isNaN(parseFloat(item.baseQty))) {
      const bq = parseFloat(item.baseQty);
      if (bq > 0) return Math.round(bq * 100) / 100;
    }
    // 2. If setCount is greater than 1, calculate baseQty = totalQty / setCount
    const sCount = Number(setCount || item.setCount || b.presetSetCount || matchedPi?.presetSetCount || 1);
    const total = parseFloat(item.qty || item.bomQty || item.quantity || item.targetQty || item.orderedQty || item.packedQty || item.itemQty || 0) || 0;
    if (sCount > 1 && total > 0) {
      return Math.round((total / sCount) * 100) / 100;
    }
    return total;
  };

  // Extract clean addresses
  const bObj = b.billingAddressObj || {};
  let rawBAddr = bObj.address || b.billingAddress || b.billingStreet || b.customerBillingAddress || '';
  let bCity = bObj.city || b.billingCity || '';
  let bState = bObj.state || b.billingState || '';
  let bPin = bObj.pincode || b.billingPincode || '';

  const dObj = b.deliveryAddressObj || {};
  let rawDAddr = dObj.address || b.deliveryAddress || b.shippingStreet || (b.sameAsBilling ? rawBAddr : '');
  let dCity = dObj.city || b.shippingCity || (b.sameAsBilling ? bCity : '');
  let dState = dObj.state || b.shippingState || (b.sameAsBilling ? bState : '');
  let dPin = dObj.pincode || b.shippingPincode || (b.sameAsBilling ? bPin : '');

  // Fallback to source PI addresses if missing
  if ((!rawBAddr && !bCity) || (!rawDAddr && !dCity)) {
    if (matchedPi) {
      const piBObj = matchedPi.billingAddressObj || {};
      rawBAddr = rawBAddr || piBObj.address || matchedPi.billingAddress || matchedPi.billingStreet || '';
      bCity = bCity || piBObj.city || matchedPi.billingCity || '';
      bState = bState || piBObj.state || matchedPi.billingState || '';
      bPin = bPin || piBObj.pincode || matchedPi.billingPincode || '';

      const piDObj = matchedPi.deliveryAddressObj || {};
      rawDAddr = rawDAddr || piDObj.address || matchedPi.deliveryAddress || matchedPi.shippingStreet || (matchedPi.sameAsBilling ? rawBAddr : '');
      dCity = dCity || piDObj.city || matchedPi.shippingCity || (matchedPi.sameAsBilling ? bCity : '');
      dState = dState || piDObj.state || matchedPi.shippingState || (matchedPi.sameAsBilling ? bState : '');
      dPin = dPin || piDObj.pincode || matchedPi.shippingPincode || (matchedPi.sameAsBilling ? bPin : '');
    }
  }

  const billingLines = formatAddressLines(rawBAddr, bCity, bState, bPin);
  const deliveryLines = formatAddressLines(rawDAddr, dCity, dState, dPin);

  const bomNumber = b.bomCode || b.code || b.piNo || b.id || 'BOM-001';
  const rawBomDate = b.date || b.bomDate || b.piDate || b.salesConfirmedAt || (b.createdAt ? String(b.createdAt).substring(0, 10) : new Date().toISOString().split('T')[0]);
  const orderDateFormatted = formatDateDDMMYYYY(rawBomDate);

  const rawTransportMode = b.transportMode || b.transport_mode || 'Transport';
  const transporterName = b.transporterName || b.transporter_name || '';
  const transportDisplay = transporterName && !rawTransportMode.toLowerCase().includes(transporterName.toLowerCase())
    ? `${rawTransportMode} (${transporterName})`
    : rawTransportMode;

  const destinationDisplay = (b.destination && String(b.destination).trim() && !['—', '-'].includes(String(b.destination).trim()))
    ? String(b.destination).trim()
    : (b.deliveryAddressObj?.city || b.billingAddressObj?.city || '—');

  const isDispatchUser = (name) => {
    if (!name) return false;
    const lower = String(name).toLowerCase().trim();
    return lower === 'anu' || lower.includes('dispatch') || lower.includes('fulfillment');
  };
  let salesPersonName = b.salesPerson || b.salesPersonName || b.salesperson || b.c3 || '';
  if (!salesPersonName || salesPersonName.toLowerCase() === 'sales' || salesPersonName === 'Sales Department' || isDispatchUser(salesPersonName)) {
    if (matchedPi && (matchedPi.salesPerson || matchedPi.salesperson || matchedPi.createdBy)) {
      salesPersonName = matchedPi.salesPerson || matchedPi.salesperson || matchedPi.createdBy;
    } else {
      salesPersonName = (b.createdBy && !isDispatchUser(b.createdBy) && b.createdBy.toLowerCase() !== 'sales') ? b.createdBy : 'Annamalaiyar';
    }
  }

  let resolvedCustomer = (b.customerName && !['Customer', 'Customer Order', 'Teorainn Solar Pvt Ltd', '—', '-'].includes(String(b.customerName).trim()))
    ? b.customerName
    : (b.companyName && !['Customer', 'Customer Order', 'Teorainn Solar Pvt Ltd', '—', '-'].includes(String(b.companyName).trim()))
      ? b.companyName
      : (b.vendor || b.clientName || b.c2 || '');

  if ((!resolvedCustomer || ['Customer', 'Customer Order', 'Teorainn Solar Pvt Ltd', '—', '-'].includes(String(resolvedCustomer).trim())) && matchedPi) {
    resolvedCustomer = matchedPi.companyName || matchedPi.customerName || matchedPi.vendor || '';
  }

  if (!resolvedCustomer || ['Customer', 'Customer Order', 'Teorainn Solar Pvt Ltd', '—', '-'].includes(String(resolvedCustomer).trim())) {
    resolvedCustomer = 'Valued Customer';
  }

  const totalQuantity = Math.round(
    enrichedItems.reduce((sum, it) => {
      const itSetCount = it.setCount || (it.presetGroupId && kitGroupsMap.get(it.presetGroupId)?.setCount) || b.presetSetCount || matchedPi?.presetSetCount || 1;
      const isFixed = isFixedQuantityPreset(it.presetGroupId || it.presetId, it.presetName || it.name) ||
        (it.presetGroupId && kitGroupsMap.has(it.presetGroupId) && isFixedQuantityPreset(kitGroupsMap.get(it.presetGroupId).presetId, kitGroupsMap.get(it.presetGroupId).presetName));
      if (isFixed) {
        return sum + getEntireKitItemQty(it, itSetCount);
      }
      return sum + getItemPerSetQty(it, itSetCount);
    }, 0) * 100
  ) / 100;
  const totalQuantityTaken = items.reduce((sum, item) => sum + (parseFloat(item.quantityTaken || item.qtyTaken || item.takenQty || 0) || 0), 0);

  const boxesVal = b.noOfBoxes || b.boxesCount || b.boxes || b.no_of_boxes || '';
  const bundlesVal = b.noOfBundles || b.bundlesCount || b.bundles || b.no_of_bundles || '';
  const bagsVal = b.noOfBags || b.bagsCount || b.bags || b.no_of_bags || '';

  return (
    <div
      id={id}
      style={{
        width: '100%',
        boxSizing: 'border-box',
        backgroundColor: '#FFFFFF',
        color: '#0F172A',
        fontFamily: "'Segoe UI', -apple-system, BlinkMacSystemFont, Roboto, Arial, sans-serif",
        fontSize: '10.5px',
        lineHeight: '1.35',
        padding: '16px 20px',
        overflow: 'visible'
      }}
    >
      <style>
        {`
          @page {
            size: A4 portrait;
            margin: 8mm 10mm;
          }

          @media print {
            html, body {
              width: 100% !important;
              height: auto !important;
              min-height: 0 !important;
              overflow: visible !important;
              overflow-x: visible !important;
              overflow-y: visible !important;
              background: #ffffff !important;
              margin: 0 !important;
              padding: 0 !important;
            }

            body.vrm-bom-print-active > *:not(.vrm-bom-modal-overlay),
            body.vrm-bom-print-active #root,
            body:has(.vrm-bom-modal-overlay) > *:not(.vrm-bom-modal-overlay),
            body:has(.vrm-bom-modal-overlay) #root,
            body > *:not(.vrm-bom-modal-overlay) {
              display: none !important;
              height: 0 !important;
              max-height: 0 !important;
              margin: 0 !important;
              padding: 0 !important;
              overflow: hidden !important;
            }

            .no-print,
            .no-print * {
              display: none !important;
              height: 0 !important;
              margin: 0 !important;
              padding: 0 !important;
            }

            .vrm-bom-modal-overlay {
              position: static !important;
              display: block !important;
              padding: 0 !important;
              margin: 0 !important;
              background: transparent !important;
              backdrop-filter: none !important;
              -webkit-backdrop-filter: none !important;
              overflow: visible !important;
              overflow-x: visible !important;
              overflow-y: visible !important;
              height: auto !important;
              min-height: 0 !important;
              max-height: none !important;
              width: 100% !important;
              max-width: 100% !important;
              top: auto !important;
              bottom: auto !important;
              left: auto !important;
              right: auto !important;
            }

            .vrm-bom-modal-card {
              position: static !important;
              display: block !important;
              max-width: 100% !important;
              width: 100% !important;
              box-shadow: none !important;
              border-radius: 0 !important;
              overflow: visible !important;
              overflow-x: visible !important;
              overflow-y: visible !important;
              height: auto !important;
              min-height: 0 !important;
              max-height: none !important;
              background: transparent !important;
              margin: 0 !important;
              padding: 0 !important;
            }

            #${id},
            #${id} * {
              visibility: visible !important;
              -webkit-print-color-adjust: exact !important;
              print-color-adjust: exact !important;
            }

            #${id} div,
            #${id} table,
            #${id} tbody,
            #${id} thead,
            #${id} tfoot,
            #${id} tr,
            #${id} td,
            #${id} th {
              overflow: visible !important;
              overflow-x: visible !important;
              overflow-y: visible !important;
            }

            /* Natural flow layout: begins at top of Page 1 and paginates cleanly onto subsequent pages */
            #${id} {
              visibility: visible !important;
              position: relative !important;
              left: 0 !important;
              top: 0 !important;
              width: 100% !important;
              max-width: 100% !important;
              min-height: 0 !important;
              height: auto !important;
              box-shadow: none !important;
              border-radius: 0 !important;
              border: none !important;
              padding: 0 !important;
              margin: 0 !important;
              overflow: visible !important;
              overflow-x: visible !important;
              overflow-y: visible !important;
              background: #ffffff !important;
              display: block !important;
            }

            table {
              page-break-inside: auto !important;
              break-inside: auto !important;
              width: 100% !important;
              border-collapse: collapse !important;
            }

            thead {
              display: table-header-group !important;
            }

            tfoot {
              display: table-row-group !important;
              page-break-inside: avoid !important;
              break-inside: avoid !important;
            }

            tr {
              page-break-inside: avoid !important;
              break-inside: avoid !important;
            }

            .print-avoid-break {
              page-break-inside: avoid !important;
              break-inside: avoid !important;
            }
          }
        `}
      </style>

      {/* 1. CLEAN OFFICIAL HEADER (LEFT: LOGO + INFO | RIGHT: TITLE) */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        borderBottom: '2.5px solid #0E7490',
        paddingBottom: '10px',
        marginBottom: '10px',
        width: '100%',
        boxSizing: 'border-box',
        pageBreakInside: 'avoid',
        breakInside: 'avoid'
      }}>
        {/* Left: Logo & Company Information */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px', flex: 1, minWidth: 0, paddingRight: '16px' }}>
          <img
            src={branding.logoUrl || VRM_OFFICIAL_LOGO}
            alt="VRM Structures Logo"
            style={{ height: '48px', maxWidth: '170px', objectFit: 'contain', flexShrink: 0 }}
            onError={(e) => { e.currentTarget.src = VRM_OFFICIAL_LOGO; }}
          />
          <div style={{ minWidth: 0 }}>
            <h2 style={{ margin: 0, fontSize: '17px', fontWeight: '900', color: '#0E7490', letterSpacing: '-0.3px', whiteSpace: 'nowrap' }}>
              VRM STRUCTURES INDIA PVT LTD
            </h2>
            <div style={{ fontSize: '10.5px', color: '#334155', lineHeight: '1.4', marginTop: '3px' }}>
              1427, GNT Road, Nagappa Industrial Estate, Puzhal, Chennai, Tamil Nadu - 600066<br />
              <strong style={{ color: '#0F172A' }}>GSTIN:</strong> 33AAGCV4262N1ZZ &nbsp;|&nbsp; <strong style={{ color: '#0F172A' }}>Phone:</strong> +91 98847 20789 &nbsp;|&nbsp; <strong style={{ color: '#0F172A' }}>Email:</strong> sales@vrmstructures.com
            </div>
          </div>
        </div>

        {/* Right: Document Title */}
        <div style={{ textAlign: 'right', flexShrink: 0 }}>
          <div style={{ fontSize: '20px', fontWeight: '900', color: '#0E7490', textTransform: 'uppercase', letterSpacing: '0.5px', lineHeight: '1.2' }}>
            ORDER LIST
          </div>
          <div style={{ fontSize: '11px', fontWeight: '700', color: '#64748B', marginTop: '3px' }}>
            Official Material Specification
          </div>
        </div>
      </div>

      {/* 2. DEDICATED METADATA BAR (NEVER OVERLAPS) */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: '1.2fr 1fr 1.2fr 1.2fr 1.1fr',
        border: '1px solid #CBD5E1',
        borderRadius: '5px',
        backgroundColor: '#F8FAFC',
        marginBottom: '10px',
        fontSize: '11px',
        width: '100%',
        boxSizing: 'border-box',
        pageBreakInside: 'avoid',
        breakInside: 'avoid'
      }}>
        <div style={{ padding: '6px 10px', borderRight: '1px solid #CBD5E1' }}>
          <span style={{ color: '#64748B', fontWeight: '700', display: 'block', fontSize: '9.5px', textTransform: 'uppercase', letterSpacing: '0.3px' }}>Order Number</span>
          <span style={{ color: '#0E7490', fontWeight: '800', fontSize: '12px' }}>{bomNumber}</span>
        </div>
        <div style={{ padding: '6px 10px', borderRight: '1px solid #CBD5E1' }}>
          <span style={{ color: '#64748B', fontWeight: '700', display: 'block', fontSize: '9.5px', textTransform: 'uppercase', letterSpacing: '0.3px' }}>Order Date</span>
          <span style={{ color: '#0F172A', fontWeight: '700', fontSize: '11.5px' }}>{orderDateFormatted}</span>
        </div>
        <div style={{ padding: '6px 10px', borderRight: '1px solid #CBD5E1' }}>
          <span style={{ color: '#64748B', fontWeight: '700', display: 'block', fontSize: '9.5px', textTransform: 'uppercase', letterSpacing: '0.3px' }}>Transport Mode</span>
          <span style={{ color: '#0F172A', fontWeight: '700', fontSize: '11.5px' }}>{transportDisplay}</span>
        </div>
        <div style={{ padding: '6px 10px', borderRight: '1px solid #CBD5E1' }}>
          <span style={{ color: '#64748B', fontWeight: '700', display: 'block', fontSize: '9.5px', textTransform: 'uppercase', letterSpacing: '0.3px' }}>Destination</span>
          <span style={{ color: '#0F172A', fontWeight: '700', fontSize: '11.5px' }}>{destinationDisplay}</span>
        </div>
        <div style={{ padding: '6px 10px' }}>
          <span style={{ color: '#64748B', fontWeight: '700', display: 'block', fontSize: '9.5px', textTransform: 'uppercase', letterSpacing: '0.3px' }}>Sales Person</span>
          <span style={{ color: '#0F172A', fontWeight: '700', fontSize: '11.5px' }}>{salesPersonName}</span>
        </div>
      </div>

      {/* 3. BILLING ADDRESS & SHIPPING ADDRESS */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        border: '1px solid #CBD5E1',
        borderRadius: '4px',
        overflow: 'visible',
        marginBottom: '10px',
        backgroundColor: '#FFFFFF',
        width: '100%',
        boxSizing: 'border-box',
        pageBreakInside: 'avoid',
        breakInside: 'avoid'
      }}>
        {/* Bill To Column */}
        <div style={{ borderRight: '1px solid #CBD5E1', display: 'flex', flexDirection: 'column', boxSizing: 'border-box' }}>
          <div style={{
            backgroundColor: '#ECFEFF',
            borderBottom: '1px solid #CBD5E1',
            padding: '5px 10px',
            color: '#0E7490',
            fontSize: '11px',
            fontWeight: '800',
            textTransform: 'uppercase',
            letterSpacing: '0.3px'
          }}>
            Customer &amp; Billing Address (Bill To)
          </div>
          <div style={{ padding: '7px 10px', fontSize: '11px', lineHeight: '1.4', wordBreak: 'break-word', flex: 1, boxSizing: 'border-box' }}>
            <div style={{ fontWeight: '800', color: '#0F172A', fontSize: '12.5px', marginBottom: '2px' }}>
              {resolvedCustomer}
            </div>
            {b.companyName && b.companyName !== resolvedCustomer && (
              <div style={{ color: '#475569', fontWeight: '600', marginBottom: '2px', fontSize: '11px' }}>{b.companyName}</div>
            )}
            {b.contactPerson && (
              <div style={{ color: '#475569', fontSize: '11px' }}>
                <strong>Contact:</strong> {b.contactPerson}
              </div>
            )}
            {b.gstNo && b.gstNo !== '—' && (
              <div style={{ color: '#0E7490', fontSize: '11px', fontWeight: '700' }}>
                <strong>GSTIN:</strong> {b.gstNo}
              </div>
            )}
            <div style={{ color: '#334155', marginTop: '2px' }}>
              {billingLines.map((line, idx) => (
                <div key={idx} style={{ lineHeight: '1.3' }}>{line}</div>
              ))}
            </div>
            {b.mobile && b.mobile !== '—' && (
              <div style={{ marginTop: '2px', fontSize: '11px', color: '#334155' }}><strong>Phone:</strong> {b.mobile}</div>
            )}
            {b.email && b.email !== '—' && (
              <div style={{ fontSize: '11px', color: '#334155' }}><strong>Email:</strong> {b.email}</div>
            )}
          </div>
        </div>

        {/* Ship To Column */}
        <div style={{ display: 'flex', flexDirection: 'column', boxSizing: 'border-box' }}>
          <div style={{
            backgroundColor: '#F8FAFC',
            borderBottom: '1px solid #CBD5E1',
            padding: '5px 10px',
            color: '#475569',
            fontSize: '11px',
            fontWeight: '800',
            textTransform: 'uppercase',
            letterSpacing: '0.3px'
          }}>
            Delivery Destination &amp; Consignee (Ship To)
          </div>
          <div style={{ padding: '7px 10px', fontSize: '11px', lineHeight: '1.4', wordBreak: 'break-word', flex: 1, boxSizing: 'border-box' }}>
            <div style={{ fontWeight: '800', color: '#0F172A', fontSize: '12.5px', marginBottom: '2px' }}>
              {resolvedCustomer} — Delivery Site
            </div>
            <div style={{ color: '#334155', marginTop: '2px' }}>
              {deliveryLines.map((line, idx) => (
                <div key={idx} style={{ lineHeight: '1.3' }}>{line}</div>
              ))}
            </div>
            {(b.siteContact || b.contactPerson || b.mobile) && (b.siteContact !== '—' && b.mobile !== '—') && (
              <div style={{ marginTop: '2px', fontSize: '11px', color: '#334155' }}>
                <strong>Site Contact:</strong> {b.siteContact || b.contactPerson || b.mobile}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 4. MATERIAL SPECIFICATIONS TABLE (LARGER TEXT, SET COLUMN IN MIDDLE, QUANTITY TAKEN) */}
      <table style={{
        width: '100%',
        borderCollapse: 'collapse',
        border: '1px solid #CBD5E1',
        marginBottom: '14px',
        fontSize: '13px',
        boxSizing: 'border-box'
      }}>
        <thead>
          <tr style={{ backgroundColor: '#0E7490', color: '#FFFFFF', fontWeight: '800' }}>
            <th style={{ padding: '8px 6px', width: '38px', textAlign: 'center', borderRight: '1px solid rgba(255,255,255,0.3)', borderBottom: '1px solid #0E7490', fontSize: '12.5px', boxSizing: 'border-box' }}>#</th>
            <th style={{ padding: '8px 12px', textAlign: 'left', borderRight: '1px solid rgba(255,255,255,0.3)', borderBottom: '1px solid #0E7490', fontSize: '13px', boxSizing: 'border-box' }}>Product / Material Name</th>
            <th style={{ padding: '8px 6px', width: '65px', textAlign: 'center', borderRight: '1px solid rgba(255,255,255,0.3)', borderBottom: '1px solid #0E7490', fontSize: '12.5px', boxSizing: 'border-box' }}>Set</th>
            <th style={{ padding: '8px 6px', width: '65px', textAlign: 'center', borderRight: '1px solid rgba(255,255,255,0.3)', borderBottom: '1px solid #0E7490', fontSize: '12.5px', boxSizing: 'border-box' }}>UOM</th>
            <th style={{ padding: '8px 6px', width: '95px', textAlign: 'center', borderRight: '1px solid rgba(255,255,255,0.3)', borderBottom: '1px solid #0E7490', fontSize: '13px', boxSizing: 'border-box' }}>
              Quantity
            </th>
            <th style={{ padding: '8px 6px', width: '125px', textAlign: 'center', borderBottom: '1px solid #0E7490', fontSize: '13px', boxSizing: 'border-box' }}>Quantity Taken</th>
          </tr>
        </thead>
        <tbody>
          {enrichedItems.length === 0 ? (
            <tr>
              <td colSpan={6} style={{ padding: '20px', textAlign: 'center', color: '#94A3B8', fontSize: '13px' }}>
                No itemized materials in this BOM record.
              </td>
            </tr>
          ) : hasAnyKits ? (
            <React.Fragment>
              {kitGroups.map((kg, kIdx) => {
                const kitColor = kIdx % 2 === 0 ? '#0E7490' : '#4F46E5';
                const kitBg = kIdx % 2 === 0 ? '#ECFEFF' : '#EEF2FF';
                const kitBorder = kIdx % 2 === 0 ? '#A5F3FC' : '#C7D2FE';

                return (
                  <React.Fragment key={`kit_${kg.groupId}_${kIdx}`}>
                    {/* Kit Section Header Banner */}
                    <tr
                      style={{
                        backgroundColor: kitBg,
                        borderTop: `2.5px solid ${kitColor}`,
                        borderBottom: `1.5px solid ${kitBorder}`,
                        pageBreakInside: 'avoid',
                        breakInside: 'avoid',
                        pageBreakAfter: 'avoid',
                        breakAfter: 'avoid'
                      }}
                    >
                      <td
                        colSpan={6}
                        style={{
                          padding: '8px 12px',
                          backgroundColor: kitBg
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                            <span
                              style={{
                                display: 'inline-block',
                                backgroundColor: kitColor,
                                color: '#FFFFFF',
                                padding: '3px 10px',
                                borderRadius: '4px',
                                fontSize: '12px',
                                fontWeight: '900',
                                letterSpacing: '0.4px',
                                textTransform: 'uppercase'
                              }}
                            >
                              KIT {kIdx + 1}
                            </span>
                            <span style={{ color: '#0F172A', fontSize: '14px', fontWeight: '800' }}>
                              {kg.presetName}
                            </span>
                            <span
                              style={{
                                display: 'inline-block',
                                backgroundColor: '#FFFFFF',
                                color: kitColor,
                                border: `1.5px solid ${kitBorder}`,
                                padding: '2px 8px',
                                borderRadius: '12px',
                                fontSize: '11.5px',
                                fontWeight: '800'
                              }}
                            >
                              Total Quantity: {kg.setCount || 1} {Number(kg.setCount || 1) === 1 ? 'Set' : 'Sets'}
                            </span>
                          </div>
                          <div style={{ fontSize: '12px', color: '#475569', fontWeight: '700' }}>
                            {kg.items.length} {kg.items.length === 1 ? 'Component' : 'Components'}
                          </div>
                        </div>
                      </td>
                    </tr>

                    {/* Items in this kit */}
                    {kg.items.map((item, itemIdx) => {
                      const isFixedKit = isFixedQuantityPreset(kg.presetId || kg.groupId, kg.presetName) || isFixedQuantityPreset(item.presetGroupId, item.presetName || item.name);
                      const qty = isFixedKit ? getEntireKitItemQty(item, kg.setCount) : getItemPerSetQty(item, kg.setCount);
                      const qtyTaken = (item.quantityTaken !== undefined && item.quantityTaken !== null && item.quantityTaken !== '')
                        ? item.quantityTaken
                        : ((item.qtyTaken !== undefined && item.qtyTaken !== null && item.qtyTaken !== '')
                          ? item.qtyTaken
                          : ((item.takenQty !== undefined && item.takenQty !== null && item.takenQty !== '') ? item.takenQty : ''));
                      const itemName = item.name || item.itemName || item.productName || item.item_name || 'Custom Product Item';

                      const midIdx = Math.floor(kg.items.length / 2);
                      const isMiddle = itemIdx === midIdx;
                      const isFirst = itemIdx === 0;
                      const isLast = itemIdx === kg.items.length - 1;

                      return (
                        <tr
                          key={`kit_item_${item.id || itemIdx}`}
                          style={{
                            backgroundColor: itemIdx % 2 === 1 ? '#F8FAFC' : '#FFFFFF',
                            pageBreakInside: 'avoid',
                            breakInside: 'avoid'
                          }}
                        >
                          <td style={{ padding: '7px 6px', textAlign: 'center', color: '#475569', borderRight: '1px solid #E2E8F0', borderBottom: '1px solid #CBD5E1', fontSize: '13px', fontWeight: '700' }}>
                            {hasMultipleKits ? `${kIdx + 1}.${itemIdx + 1}` : itemIdx + 1}
                          </td>
                          <td style={{ padding: '7px 12px', borderRight: '1px solid #E2E8F0', borderBottom: '1px solid #CBD5E1', wordBreak: 'break-word' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                              <strong style={{ color: '#0F172A', fontSize: '13.5px' }}>{itemName}</strong>
                              {hasMultipleKits && (
                                <span style={{ fontSize: '10.5px', padding: '1px 6px', borderRadius: '4px', backgroundColor: kitBg, color: kitColor, fontWeight: '800', border: `1px solid ${kitBorder}` }}>
                                  Kit {kIdx + 1}
                                </span>
                              )}
                            </div>
                          </td>

                          {/* SET COLUMN: Seamless vertical strip with NO horizontal lines inside; completely empty for fixed-quantity presets */}
                          <td
                            style={{
                              padding: (isMiddle && !isFixedKit) ? '4px 6px' : '0',
                              textAlign: 'center',
                              verticalAlign: 'middle',
                              color: '#0E7490',
                              backgroundColor: '#FFFFFF',
                              borderRight: '1px solid #CBD5E1',
                              borderLeft: '1px solid #CBD5E1',
                              borderTop: isFirst ? '1px solid #CBD5E1' : '1px hidden transparent',
                              borderBottom: isLast ? '1px solid #CBD5E1' : '1px hidden transparent',
                              whiteSpace: 'nowrap'
                            }}
                          >
                            {(isMiddle && !isFixedKit) ? (
                              <div style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                                <span style={{ fontSize: '16px', fontWeight: '900', color: '#0E7490', lineHeight: '1.2' }}>
                                  {kg.setCount || 1}
                                </span>
                                <span style={{ fontSize: '10.5px', fontWeight: '800', color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.4px' }}>
                                  {Number(kg.setCount || 1) === 1 ? 'Set' : 'Sets'}
                                </span>
                              </div>
                            ) : null}
                          </td>

                          <td style={{ padding: '7px 6px', textAlign: 'center', color: '#334155', borderRight: '1px solid #E2E8F0', borderBottom: '1px solid #CBD5E1', fontSize: '13px', fontWeight: '700' }}>
                            {item.uom || item.unit || 'NOS'}
                          </td>
                          <td style={{ padding: '7px 6px', textAlign: 'center', fontWeight: '900', color: '#0F172A', borderRight: '1px solid #E2E8F0', borderBottom: '1px solid #CBD5E1', fontSize: '14.5px' }}>
                            {qty}
                          </td>
                          <td style={{ padding: '7px 6px', textAlign: 'center', fontWeight: '800', color: '#0F172A', borderBottom: '1px solid #CBD5E1', fontSize: '14.5px' }}>
                            {qtyTaken !== '' ? qtyTaken : ''}
                          </td>
                        </tr>
                      );
                    })}
                  </React.Fragment>
                );
              })}

              {/* Standalone Items if any */}
              {standaloneItems.length > 0 && (
                <React.Fragment>
                  <tr
                    style={{
                      backgroundColor: '#F1F5F9',
                      borderTop: '2px solid #64748B',
                      borderBottom: '1.5px solid #CBD5E1',
                      pageBreakInside: 'avoid',
                      breakInside: 'avoid',
                      pageBreakAfter: 'avoid',
                      breakAfter: 'avoid'
                    }}
                  >
                    <td
                      colSpan={6}
                      style={{
                        padding: '8px 12px',
                        backgroundColor: '#F1F5F9'
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span
                            style={{
                              display: 'inline-block',
                              backgroundColor: '#475569',
                              color: '#FFFFFF',
                              padding: '3px 10px',
                              borderRadius: '4px',
                              fontSize: '12px',
                              fontWeight: '900',
                              letterSpacing: '0.4px',
                              textTransform: 'uppercase'
                            }}
                          >
                            ADDITIONAL MATERIALS
                          </span>
                          <span style={{ color: '#0F172A', fontSize: '14px', fontWeight: '800' }}>
                            Individual / Loose Components
                          </span>
                        </div>
                        <div style={{ fontSize: '12px', color: '#475569', fontWeight: '700' }}>
                          {standaloneItems.length} {standaloneItems.length === 1 ? 'Component' : 'Components'}
                        </div>
                      </div>
                    </td>
                  </tr>
                  {standaloneItems.map((item, sIdx) => {
                    const qty = getItemQty(item);
                    const qtyTaken = (item.quantityTaken !== undefined && item.quantityTaken !== null && item.quantityTaken !== '')
                      ? item.quantityTaken
                      : ((item.qtyTaken !== undefined && item.qtyTaken !== null && item.qtyTaken !== '')
                        ? item.qtyTaken
                        : ((item.takenQty !== undefined && item.takenQty !== null && item.takenQty !== '') ? item.takenQty : ''));
                    const itemName = item.name || item.itemName || item.productName || item.item_name || 'Custom Product Item';

                    return (
                      <tr
                        key={`standalone_item_${item.id || sIdx}`}
                        style={{
                          borderBottom: '1px solid #CBD5E1',
                          backgroundColor: sIdx % 2 === 1 ? '#F8FAFC' : '#FFFFFF',
                          pageBreakInside: 'avoid',
                          breakInside: 'avoid'
                        }}
                      >
                        <td style={{ padding: '7px 6px', textAlign: 'center', color: '#475569', borderRight: '1px solid #E2E8F0', fontSize: '13px', fontWeight: '700' }}>
                          {hasAnyKits ? `A.${sIdx + 1}` : sIdx + 1}
                        </td>
                        <td style={{ padding: '7px 12px', borderRight: '1px solid #E2E8F0', wordBreak: 'break-word' }}>
                          <strong style={{ color: '#0F172A', fontSize: '13.5px' }}>{itemName}</strong>
                        </td>
                        <td style={{ padding: '7px 6px', textAlign: 'center', color: '#64748B', borderRight: '1px solid #E2E8F0', fontSize: '13px', fontWeight: '600' }}>
                          —
                        </td>
                        <td style={{ padding: '7px 6px', textAlign: 'center', color: '#334155', borderRight: '1px solid #E2E8F0', fontSize: '13px', fontWeight: '700' }}>
                          {item.uom || item.unit || 'NOS'}
                        </td>
                        <td style={{ padding: '7px 6px', textAlign: 'center', fontWeight: '900', color: '#0F172A', borderRight: '1px solid #E2E8F0', fontSize: '14.5px' }}>
                          {qty}
                        </td>
                        <td style={{ padding: '7px 6px', textAlign: 'center', fontWeight: '800', color: '#0F172A', fontSize: '14.5px' }}>
                          {qtyTaken !== '' ? qtyTaken : ''}
                        </td>
                      </tr>
                    );
                  })}
                </React.Fragment>
              )}
            </React.Fragment>
          ) : (
            enrichedItems.map((item, idx) => {
              const fallbackMid = Math.floor(enrichedItems.length / 2);
              const fallbackSetVal = item.setCount || b.presetSetCount || matchedPi?.presetSetCount || '';
              const isFixed = isFixedQuantityPreset(item.presetGroupId || item.presetId, item.presetName || item.name);
              const qty = isFixed
                ? getEntireKitItemQty(item, fallbackSetVal)
                : (fallbackSetVal && Number(fallbackSetVal) > 1
                  ? getItemPerSetQty(item, fallbackSetVal)
                  : getItemQty(item));
              const qtyTaken = (item.quantityTaken !== undefined && item.quantityTaken !== null && item.quantityTaken !== '')
                ? item.quantityTaken
                : ((item.qtyTaken !== undefined && item.qtyTaken !== null && item.qtyTaken !== '')
                  ? item.qtyTaken
                  : ((item.takenQty !== undefined && item.takenQty !== null && item.takenQty !== '') ? item.takenQty : ''));
              const itemName = item.name || item.itemName || item.productName || item.item_name || 'Custom Product Item';

              return (
                <tr
                  key={idx}
                  style={{
                    backgroundColor: idx % 2 === 1 ? '#F8FAFC' : '#FFFFFF',
                    pageBreakInside: 'avoid',
                    breakInside: 'avoid'
                  }}
                >
                  <td style={{ padding: '7px 6px', textAlign: 'center', color: '#475569', borderRight: '1px solid #E2E8F0', borderBottom: '1px solid #CBD5E1', fontSize: '13px', fontWeight: '700' }}>
                    {idx + 1}
                  </td>
                  <td style={{ padding: '7px 12px', borderRight: '1px solid #E2E8F0', borderBottom: '1px solid #CBD5E1', wordBreak: 'break-word' }}>
                    <strong style={{ color: '#0F172A', fontSize: '13.5px' }}>{itemName}</strong>
                  </td>
                  <td
                    style={{
                      padding: (idx === fallbackMid && fallbackSetVal && !isFixed) ? '4px 6px' : '0',
                      textAlign: 'center',
                      verticalAlign: 'middle',
                      color: '#0E7490',
                      backgroundColor: '#FFFFFF',
                      borderRight: '1px solid #CBD5E1',
                      borderLeft: '1px solid #CBD5E1',
                      borderTop: idx === 0 ? '1px solid #CBD5E1' : '1px hidden transparent',
                      borderBottom: idx === enrichedItems.length - 1 ? '1px solid #CBD5E1' : '1px hidden transparent',
                      fontSize: '13px',
                      fontWeight: '800',
                      whiteSpace: 'nowrap'
                    }}
                  >
                    {idx === fallbackMid && fallbackSetVal && !isFixed ? (
                      <div style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                        <span style={{ fontSize: '16px', fontWeight: '900', color: '#0E7490', lineHeight: '1.2' }}>
                          {fallbackSetVal}
                        </span>
                        <span style={{ fontSize: '10.5px', fontWeight: '800', color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.4px' }}>
                          {Number(fallbackSetVal) === 1 ? 'Set' : 'Sets'}
                        </span>
                      </div>
                    ) : null}
                  </td>
                  <td style={{ padding: '7px 6px', textAlign: 'center', color: '#334155', borderRight: '1px solid #E2E8F0', borderBottom: '1px solid #CBD5E1', fontSize: '13px', fontWeight: '700' }}>
                    {item.uom || item.unit || 'NOS'}
                  </td>
                  <td style={{ padding: '7px 6px', textAlign: 'center', fontWeight: '900', color: '#0F172A', borderRight: '1px solid #E2E8F0', borderBottom: '1px solid #CBD5E1', fontSize: '14.5px' }}>
                    {qty}
                  </td>
                  <td style={{ padding: '7px 6px', textAlign: 'center', fontWeight: '800', color: '#0F172A', borderBottom: '1px solid #CBD5E1', fontSize: '14.5px' }}>
                    {qtyTaken !== '' ? qtyTaken : ''}
                  </td>
                </tr>
              );
            })
          )}
        </tbody>
        {items.length > 0 && (
          <tfoot style={{ display: 'table-row-group' }}>
            <tr style={{ backgroundColor: '#F1F5F9', borderTop: '2px solid #0E7490', fontWeight: '800', pageBreakInside: 'avoid', breakInside: 'avoid' }}>
              <td colSpan={4} style={{ padding: '8px 12px', textAlign: 'right', color: '#475569', fontSize: '12.5px', textTransform: 'uppercase', letterSpacing: '0.4px' }}>
                Total (Qty / Set):
              </td>
              <td style={{ padding: '8px 6px', textAlign: 'center', color: '#0E7490', fontSize: '15px', fontWeight: '900', borderRight: '1px solid #CBD5E1' }}>
                {totalQuantity}
              </td>
              <td style={{ padding: '8px 6px', textAlign: 'center', color: '#0E7490', fontSize: '15px', fontWeight: '900' }}>
                {totalQuantityTaken > 0 ? totalQuantityTaken : ''}
              </td>
            </tr>
          </tfoot>
        )}
      </table>

      {/* 5. PACKAGING CONTAINERS (NO. OF BOXES, NO. OF BUNDLES, NO. OF BAGS) */}
      <div
        className="print-avoid-break"
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          gap: '12px',
          marginTop: '14px',
          marginBottom: '16px',
          pageBreakInside: 'avoid',
          breakInside: 'avoid'
        }}
      >
        <div style={{
          border: '1.5px solid #CBD5E1',
          borderRadius: '6px',
          backgroundColor: '#F8FAFC',
          padding: '10px 14px',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          minHeight: '60px',
          boxSizing: 'border-box'
        }}>
          <div style={{ fontSize: '12.5px', fontWeight: '800', color: '#334155', textTransform: 'uppercase', letterSpacing: '0.4px' }}>
            No. of Boxes
          </div>
          <div style={{ fontSize: '15px', fontWeight: '800', color: '#0F172A', marginTop: '5px' }}>
            {boxesVal ? `${boxesVal} Boxes` : <span style={{ color: '#94A3B8', fontWeight: '400' }}>____________________</span>}
          </div>
        </div>

        <div style={{
          border: '1.5px solid #CBD5E1',
          borderRadius: '6px',
          backgroundColor: '#F8FAFC',
          padding: '10px 14px',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          minHeight: '60px',
          boxSizing: 'border-box'
        }}>
          <div style={{ fontSize: '12.5px', fontWeight: '800', color: '#334155', textTransform: 'uppercase', letterSpacing: '0.4px' }}>
            No. of Bundles
          </div>
          <div style={{ fontSize: '15px', fontWeight: '800', color: '#0F172A', marginTop: '5px' }}>
            {bundlesVal ? `${bundlesVal} Bundles` : <span style={{ color: '#94A3B8', fontWeight: '400' }}>____________________</span>}
          </div>
        </div>

        <div style={{
          border: '1.5px solid #CBD5E1',
          borderRadius: '6px',
          backgroundColor: '#F8FAFC',
          padding: '10px 14px',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          minHeight: '60px',
          boxSizing: 'border-box'
        }}>
          <div style={{ fontSize: '12.5px', fontWeight: '800', color: '#334155', textTransform: 'uppercase', letterSpacing: '0.4px' }}>
            No. of Bags
          </div>
          <div style={{ fontSize: '15px', fontWeight: '800', color: '#0F172A', marginTop: '5px' }}>
            {bagsVal ? `${bagsVal} Bags` : <span style={{ color: '#94A3B8', fontWeight: '400' }}>____________________</span>}
          </div>
        </div>
      </div>

      {/* 6. INSPECTION CRITERIA & PACKING VERIFICATION TABLE */}
      <table
        className="print-avoid-break"
        style={{
          width: '100%',
          borderCollapse: 'collapse',
          border: '1.5px solid #CBD5E1',
          marginBottom: '16px',
          fontSize: '13px',
          boxSizing: 'border-box',
          pageBreakInside: 'avoid',
          breakInside: 'avoid'
        }}
      >
        <thead>
          <tr style={{ backgroundColor: '#0E7490', color: '#FFFFFF', fontWeight: '800' }}>
            <th style={{ padding: '8px 8px', width: '50px', textAlign: 'center', borderRight: '1px solid rgba(255,255,255,0.3)', borderBottom: '1px solid #0E7490', fontSize: '12.5px' }}>S.No</th>
            <th style={{ padding: '8px 12px', textAlign: 'left', borderRight: '1px solid rgba(255,255,255,0.3)', borderBottom: '1px solid #0E7490', fontSize: '13px' }}>Inspection Criteria</th>
            <th style={{ padding: '8px 8px', width: '90px', textAlign: 'center', borderRight: '1px solid rgba(255,255,255,0.3)', borderBottom: '1px solid #0E7490', fontSize: '12.5px' }}>Tested</th>
            <th style={{ padding: '8px 12px', width: '160px', textAlign: 'center', borderRight: '1px solid rgba(255,255,255,0.3)', borderBottom: '1px solid #0E7490', fontSize: '12.5px' }}>Packed By</th>
            <th style={{ padding: '8px 12px', width: '160px', textAlign: 'center', borderBottom: '1px solid #0E7490', fontSize: '12.5px' }}>Confirmed By</th>
          </tr>
        </thead>
        <tbody>
          {[
            { sno: 1, criteria: 'Materials Packed & Counted' },
            { sno: 2, criteria: 'Accessories Packed' },
            { sno: 3, criteria: 'Quality Check Done' }
          ].map((row, idx) => (
            <tr
              key={idx}
              style={{
                borderBottom: '1px solid #CBD5E1',
                backgroundColor: idx % 2 === 1 ? '#F8FAFC' : '#FFFFFF',
                height: '44px'
              }}
            >
              <td style={{ padding: '8px 8px', textAlign: 'center', color: '#475569', fontWeight: '700', borderRight: '1px solid #CBD5E1', fontSize: '13px' }}>
                {row.sno}
              </td>
              <td style={{ padding: '8px 12px', borderRight: '1px solid #CBD5E1', color: '#0F172A', fontWeight: '700', fontSize: '13.5px' }}>
                {row.criteria}
              </td>
              <td style={{ padding: '8px 8px', textAlign: 'center', borderRight: '1px solid #CBD5E1' }}>
                <span
                  style={{
                    display: 'inline-block',
                    width: '18px',
                    height: '18px',
                    border: '2px solid #1E293B',
                    borderRadius: '4px',
                    backgroundColor: '#FFFFFF',
                    verticalAlign: 'middle'
                  }}
                />
              </td>
              <td style={{ padding: '8px 12px', borderRight: '1px solid #CBD5E1', textAlign: 'center' }}>
                {/* Empty cell for Packed By signature/name */}
              </td>
              <td style={{ padding: '8px 12px', textAlign: 'center' }}>
                {/* Empty cell for Confirmed By signature/name */}
              </td>
            </tr>
          ))}
        </tbody>
      </table>


      {/* 8. SYSTEM PRINT AUDIT WATERMARK */}
      <div style={{
        marginTop: '12px',
        paddingTop: '6px',
        borderTop: '1px solid #E2E8F0',
        display: 'flex',
        justifyContent: 'space-between',
        fontSize: '9.5px',
        color: '#64748B',
        fontFamily: 'monospace'
      }}>
        <span>VRM BUSINZ ORDER LIST • {bomNumber}</span>
        <span>
          {isSalesUser ? (
            `Printed: ${formatDateDDMMYYYY(new Date())}, ${new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true })}`
          ) : (
            b.dispatchPrintCount > 1 
              ? `Printed: ${formatDateDDMMYYYY(new Date())}, ${new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true })} (Copy #${b.dispatchPrintCount} • 1st Print: ${b.firstPrintTimeStr || 'Recorded'})`
              : `Printed: ${formatDateDDMMYYYY(new Date())}, ${new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true })} (Copy #1)`
          )}
        </span>
      </div>

    </div>
  );
}

function recordBomPrintStatus(targetBom) {
  if (!targetBom) return;
  const bomId = String(targetBom.bomCode || targetBom.code || targetBom.id || '').trim();
  if (!bomId) return;

  const now = new Date();
  const timeStr = now.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });
  const dateStr = formatDateDDMMYYYY(now);
  const storedUser = (typeof localStorage !== 'undefined') ? (localStorage.getItem('controlroom_logged_user_name') || localStorage.getItem('controlroom_user_name') || localStorage.getItem('controlroom_user_email') || '') : '';
  const storedRole = (typeof localStorage !== 'undefined') ? (localStorage.getItem('controlroom_user_role') || '') : '';
  const printedByName = storedUser ? `${storedUser}${storedRole ? ` (${storedRole})` : ''}` : (storedRole || 'Team');

  const prevCount = parseInt(targetBom.dispatchPrintCount, 10) || 0;
  const newPrintCount = prevCount + 1;

  const firstTime = targetBom.firstPrintTimeStr || (prevCount === 0 ? timeStr : (targetBom.dispatchPrintTimeStr || timeStr));
  const secondTime = newPrintCount === 2 ? timeStr : (targetBom.secondPrintTimeStr || (newPrintCount > 2 ? targetBom.secondPrintTimeStr : null));

  const existingHistory = Array.isArray(targetBom.dispatchPrintHistory) ? targetBom.dispatchPrintHistory : [];
  const updatedHistory = [
    ...existingHistory,
    {
      count: newPrintCount,
      time: timeStr,
      date: dateStr,
      by: printedByName,
      timestamp: now.toISOString()
    }
  ];

  const printPayload = {
    dispatchPrinted: true,
    dispatchPrintedAt: now.toISOString(),
    dispatchPrintTimeStr: timeStr,
    dispatchPrintedDateStr: dateStr,
    dispatchPrintedBy: printedByName,
    dispatchPrintCount: newPrintCount,
    firstPrintTimeStr: firstTime,
    secondPrintTimeStr: secondTime,
    dispatchPrintHistory: updatedHistory
  };

  // Dispatch custom browser event for live synchronization across open views
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('vrm_bom_printed', {
      detail: { bomCode: bomId, ...printPayload }
    }));
  }

  // Update local browser stores safely
  if (typeof localStorage !== 'undefined') {
    ['controlroom_bom_store', 'bom_store'].forEach(k => {
      try {
        const raw = localStorage.getItem(k);
        if (raw) {
          const list = JSON.parse(raw);
          if (Array.isArray(list)) {
            const updated = list.map(item => {
              if (String(item.bomCode || item.code || item.id || '').trim() === bomId) {
                return { ...item, ...printPayload };
              }
              return item;
            });
            localStorage.setItem(k, JSON.stringify(updated));
          }
        }
      } catch (_) {}
    });
  }

  // Non-blocking persist to backend
  try {
    fetch(`/api/boms/${encodeURIComponent(bomId)}/print-status`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ printData: printPayload })
    }).catch(() => {});
  } catch (_) {}
}

export default function VRMBomPrintTemplate({ bomData, onClose, autoPrint = true, userRole = '', isSales = false }) {
  const b = bomData || {};
  const hasTrackedRef = useRef(false);

  const storedRole = (typeof localStorage !== 'undefined') ? (localStorage.getItem('controlroom_user_role') || '') : '';
  const effectiveRole = userRole || storedRole || '';
  const isDispatchRole = /dispatch/i.test(effectiveRole);
  const isSalesUser = Boolean(isSales || (!isDispatchRole && !/production/i.test(effectiveRole)) || /sales/i.test(effectiveRole));

  // Physical BOM order printout is taken by Dispatch Head or Production Head
  const isPhysicalPrintTaker = Boolean(
    !isSales && (
      effectiveRole === 'Dispatch Head' ||
      effectiveRole === 'Production Head' ||
      effectiveRole === 'Floor Supervisor' ||
      isDispatchRole ||
      /production/i.test(effectiveRole)
    )
  );

  const handlePrint = () => {
    if (isPhysicalPrintTaker) {
      recordBomPrintStatus(b);
    }
    window.print();
  };

  useEffect(() => {
    if (!bomData) return;
    if (typeof document !== 'undefined') {
      document.body.classList.add('vrm-bom-print-active');
    }
    return () => {
      if (typeof document !== 'undefined') {
        document.body.classList.remove('vrm-bom-print-active');
      }
    };
  }, [bomData]);

  useEffect(() => {
    if (!bomData || !autoPrint || hasTrackedRef.current) return;
    hasTrackedRef.current = true;
    if (isPhysicalPrintTaker) {
      recordBomPrintStatus(bomData);
    }
    const timer = setTimeout(() => {
      window.print();
    }, 400);
    return () => clearTimeout(timer);
  }, [bomData, autoPrint, isPhysicalPrintTaker]);

  if (!bomData) return null;

  const bomNumber = b.bomCode || b.code || b.piNo || b.id || 'BOM Order';

  const modalContent = (
    <div
      className="vrm-bom-modal-overlay"
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(15, 23, 42, 0.75)',
        backdropFilter: 'blur(4px)',
        zIndex: 99999,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        padding: '24px 16px',
        overflowY: 'auto',
        boxSizing: 'border-box'
      }}
    >
      {/* UNIFIED MODAL CARD CONTAINER */}
      <div
        className="vrm-bom-modal-card"
        style={{
          width: '100%',
          maxWidth: '880px',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 20px 50px rgba(0,0,0,0.35)',
          borderRadius: '12px',
          overflow: 'visible',
          backgroundColor: '#FFFFFF',
          boxSizing: 'border-box',
          margin: 'auto 0'
        }}
      >
        {/* TOP FLOATING CONTROL BAR (Hidden when printing) */}
        <div
          className="no-print"
          style={{
            width: '100%',
            backgroundColor: '#0F172A',
            padding: '12px 20px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            color: '#FFFFFF',
            boxSizing: 'border-box',
            borderRadius: '12px 12px 0 0'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ fontWeight: '800', fontSize: '14.5px', letterSpacing: '-0.2px' }}>
              Order List Document — {bomNumber}
            </span>
          </div>
          <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
            <button
              onClick={handlePrint}
              style={{
                backgroundColor: '#0E7490',
                color: '#FFFFFF',
                border: 'none',
                borderRadius: '8px',
                padding: '7px 16px',
                fontSize: '12.5px',
                fontWeight: '700',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                boxShadow: '0 2px 4px rgba(14, 116, 144, 0.3)'
              }}
            >
              <Printer size={14} /> Print
            </button>
            <button
              onClick={onClose}
              title="Close Preview"
              style={{
                backgroundColor: '#334155',
                color: '#FFFFFF',
                border: 'none',
                borderRadius: '8px',
                padding: '7px 11px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            >
              <X size={16} />
            </button>
          </div>
        </div>

        {/* PRINT SHEET CONTENT */}
        <VRMBomPrintSheet bomData={bomData} isSales={isSalesUser} userRole={effectiveRole} />
      </div>
    </div>
  );

  return typeof document !== 'undefined'
    ? createPortal(modalContent, document.body)
    : modalContent;
}
