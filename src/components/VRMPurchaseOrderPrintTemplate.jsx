import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Printer, Download, X } from 'lucide-react';
import { VRM_OFFICIAL_LOGO, VRM_OFFICIAL_STAMP } from '../utils/vrmOfficialAssets';
import { getCachedBranding, fetchMasterBranding } from '../services/brandingService';
import { numberToWordsINR } from './VRMTaxInvoicePrintTemplate';
import { exportSmartMultiPagePdf } from '../utils/smartPdfExporter';
import { isTamilNaduIntra } from '../utils/gstHelper';

const formatPoDate = (raw) => {
  if (!raw) return '—';
  const s = String(raw).trim();
  if (!s) return '—';
  const d = new Date(s);
  if (!isNaN(d.getTime())) {
    return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
  }
  return s;
};

const fmtMoney = (n) => Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const fmtQty = (n) => {
  const num = Number(n || 0);
  return num % 1 === 0 ? String(num) : String(Number(num.toFixed(2)));
};

const resolveCompanyProfile = (locationKey) => {
  const norm = String(locationKey || '').trim().toLowerCase();
  if (norm.includes('ap') || norm.includes('andhra') || norm.includes('tada') || norm.includes('nellore')) {
    return {
      name: 'VRM STRUCTURES INDIA PRIVATE LIMITED',
      address: 'NO 150B, PERUMAL KOVIL STREET, Padi. Tada, District - Thirupati, TADA, Andhra Pradesh - 524401, India',
      gst: '37AAGCV4262N1ZR'
    };
  }
  if (norm.includes('jash') || norm.includes('sun')) {
    return {
      name: 'JASH SUN POWER DYNAMICS PRIVATE LIMITED',
      address: '2nd, 1/135A, JASH SUN, 2nd Street, Elavanthangal, Kelambakkam, Chengalpattu, Tamil Nadu - 603103, India',
      gst: '33AAGCJ6197G1ZC'
    };
  }
  return {
    name: 'VRM STRUCTURES INDIA PRIVATE LIMITED',
    address: '1427, GNT Road, Nagappa Industrial Estate, Puzhal, Chennai, Tamil Nadu 600066, India',
    gst: '33AAGCV4262N1ZZ'
  };
};

export default function VRMPurchaseOrderPrintTemplate({ po, onClose }) {
  const sheetRef = useRef(null);
  const [isExporting, setIsExporting] = useState(false);
  const [branding, setBranding] = useState(() => getCachedBranding());

  useEffect(() => {
    let active = true;
    fetchMasterBranding().then((b) => {
      if (active && b) setBranding(b);
    }).catch(() => {});
    return () => { active = false; };
  }, []);

  if (!po) return null;

  const poNo = po.poNo || po.poNumber || po.id || 'PO-00001';
  const poDateStr = formatPoDate(po.poDate || po.date);
  const deliveryDateStr = po.deliveryDate ? formatPoDate(po.deliveryDate) : '';
  const paymentTerms = po.paymentTerms || 'Net 30 Days';
  const issuedBy = po.purchaser || po.createdBy || 'Procurement';

  const compProfile = resolveCompanyProfile(po.companyLocation || po.branch);
  const vendorName = po.vendorName || po.vendor || 'Vendor';
  const contactPerson = po.contactPerson || '';
  const contactNo = (po.contactNo || po.phone || '').toString().trim();
  const vendorEmail = po.email || '';
  const vendorGst = po.gstNo || po.gstin || '';

  const deliveryAddress = po.deliveryAddress || compProfile.address;
  const billingAddress = po.billingAddress || '';

  const items = Array.isArray(po.items) ? po.items : [];
  const presetGroups = (po.presetGroups && typeof po.presetGroups === 'object') ? po.presetGroups : {};
  const discountPct = Number(po.discountPct || 0);
  const shippingCharges = Number(po.shippingCharges || 0);
  const otherCharges = Number(po.otherCharges || 0);

  const compStateCode = String(compProfile.gst || '').trim().slice(0, 2);
  const vendStateCode = String(vendorGst || '').trim().slice(0, 2);
  const isIntra = (/^\d{2}$/.test(compStateCode) && /^\d{2}$/.test(vendStateCode))
    ? compStateCode === vendStateCode
    : (vendorGst ? isTamilNaduIntra(vendorGst) : isTamilNaduIntra(deliveryAddress));

  let rawSubTotal = 0;
  const gstMap = new Map();

  const normalizedItems = items.map((item, idx) => {
    const qty = Number(item.qty ?? item.quantity ?? 0);
    const rate = Number(item.rate ?? item.unitPrice ?? 0);
    const gRate = (item.tax !== undefined && item.tax !== '' && !isNaN(Number(item.tax))) ? Number(item.tax) : 18;
    const isPresetItem = Boolean(item.isPresetItem && item.presetGroupId);
    const lineTotal = isPresetItem ? 0 : (qty * rate);
    const discountedTaxable = lineTotal * (1 - discountPct / 100);
    const gstAmt = discountedTaxable * (gRate / 100);
    const inclGst = discountedTaxable + gstAmt;

    rawSubTotal += lineTotal;
    if (!isPresetItem) {
      const existing = gstMap.get(gRate) || { rate: gRate, taxable: 0, gstAmt: 0 };
      existing.taxable += discountedTaxable;
      existing.gstAmt += gstAmt;
      gstMap.set(gRate, existing);
    }

    return {
      key: item.id || `${idx}-${item.name || 'item'}`,
      index: idx + 1,
      name: item.name || item.itemName || 'Item',
      description: item.description || '',
      hsn: item.hsn || item.hsn_or_sac || '',
      account: item.account || '',
      qty,
      unit: item.unit || 'NOS',
      rate,
      gRate,
      taxable: discountedTaxable,
      gstAmt,
      inclGst,
      isPresetItem,
      presetGroupId: item.presetGroupId || '',
      presetName: item.presetName || ''
    };
  });

  // Include Pack / Set totals in rawSubTotal & gstMap when presetGroups exist
  const activeGroupIds = new Set(normalizedItems.filter(r => r.isPresetItem).map(r => r.presetGroupId));
  activeGroupIds.forEach((gid) => {
    const grp = presetGroups[gid];
    if (!grp) return;
    const packTotal = Number(grp.kitPrice || 0) * (Number(grp.setCount) || 1);
    const discountedPack = packTotal * (1 - discountPct / 100);
    const grpRate = parseFloat(String(grp.gstRate || '18').replace('%', '')) || 18;
    const grpGstAmt = discountedPack * (grpRate / 100);
    rawSubTotal += packTotal;
    const existing = gstMap.get(grpRate) || { rate: grpRate, taxable: 0, gstAmt: 0 };
    existing.taxable += discountedPack;
    existing.gstAmt += grpGstAmt;
    gstMap.set(grpRate, existing);
  });

  const discountAmt = rawSubTotal * (discountPct / 100);
  const taxableTotal = Math.max(0, rawSubTotal - discountAmt);
  const gstTiers = Array.from(gstMap.values()).sort((a, b) => a.rate - b.rate);
  const totalGst = gstTiers.reduce((acc, t) => acc + t.gstAmt, 0);
  const exactTotal = taxableTotal + totalGst + shippingCharges + otherCharges;
  const roundedTotal = Math.round(exactTotal);
  const roundOffVal = roundedTotal - exactTotal;
  const hasRoundOff = Math.abs(roundOffVal) > 0.001;

  const logoSrc = branding?.logoUrl || (typeof window !== 'undefined' && localStorage.getItem('vrm_constant_logo')) || VRM_OFFICIAL_LOGO;
  const stampSrc = branding?.customStampUrl || (typeof window !== 'undefined' && localStorage.getItem('vrm_constant_stamp')) || VRM_OFFICIAL_STAMP;

  const notesText = String(po.notes || '').trim();
  const termsText = String(po.terms || '').trim();

  const handlePrint = () => {
    window.print();
  };

  const handleDownloadPdf = async () => {
    if (!sheetRef.current || isExporting) return;
    setIsExporting(true);
    try {
      await exportSmartMultiPagePdf(sheetRef.current, `${String(poNo).replace(/[/\\:*?"<>|]/g, '_')}.pdf`);
    } catch (err) {
      console.error('PO PDF export failed:', err);
      window.print();
    } finally {
      setIsExporting(false);
    }
  };

  const content = (
    <div
      id="vrm-po-print-overlay"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 99999,
        backgroundColor: 'rgba(15, 23, 42, 0.72)',
        backdropFilter: 'blur(3px)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        overflowY: 'auto',
        padding: '20px 16px 40px 16px',
        fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif"
      }}
    >
      <style>{`
        @media print {
          body > *:not(#vrm-po-print-overlay) {
            display: none !important;
          }
          #vrm-po-print-overlay {
            position: static !important;
            background: #FFFFFF !important;
            padding: 0 !important;
            margin: 0 !important;
            overflow: visible !important;
            display: block !important;
          }
          #vrm-po-print-toolbar {
            display: none !important;
          }
          #vrm-po-print-sheet {
            box-shadow: none !important;
            margin: 0 !important;
            width: 100% !important;
            max-width: none !important;
          }
        }
      `}</style>

      {/* Top Toolbar */}
      <div
        id="vrm-po-print-toolbar"
        style={{
          width: '100%',
          maxWidth: '210mm',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          backgroundColor: '#0F172A',
          color: '#FFFFFF',
          padding: '10px 16px',
          borderRadius: '10px',
          marginBottom: '16px',
          boxSizing: 'border-box',
          boxShadow: '0 8px 24px rgba(0,0,0,0.25)'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <span style={{ fontSize: '13px', fontWeight: '700' }}>Purchase Order Printout</span>
          <span style={{ fontSize: '12px', color: '#94A3B8', fontWeight: '600' }}>• {poNo}</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <button
            type="button"
            onClick={handlePrint}
            style={{
              backgroundColor: '#0E7490',
              color: '#FFFFFF',
              border: 'none',
              borderRadius: '7px',
              padding: '7px 14px',
              fontSize: '12px',
              fontWeight: '700',
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px'
            }}
          >
            <Printer size={13} /> Print
          </button>
          <button
            type="button"
            onClick={handleDownloadPdf}
            disabled={isExporting}
            style={{
              backgroundColor: '#059669',
              color: '#FFFFFF',
              border: 'none',
              borderRadius: '7px',
              padding: '7px 14px',
              fontSize: '12px',
              fontWeight: '700',
              cursor: isExporting ? 'wait' : 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              opacity: isExporting ? 0.75 : 1
            }}
          >
            <Download size={13} /> {isExporting ? 'Generating PDF...' : 'Download PDF'}
          </button>
          <button
            type="button"
            onClick={onClose}
            style={{
              backgroundColor: '#1E293B',
              color: '#E2E8F0',
              border: '1px solid #334155',
              borderRadius: '7px',
              padding: '7px 12px',
              fontSize: '12px',
              fontWeight: '700',
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '5px'
            }}
          >
            <X size={13} /> Close
          </button>
        </div>
      </div>

      {/* Printable A4 PO Sheet */}
      <div
        id="vrm-po-print-sheet"
        ref={sheetRef}
        style={{
          width: '210mm',
          minHeight: '272mm',
          backgroundColor: '#FFFFFF',
          color: '#0F172A',
          boxShadow: '0 20px 50px rgba(0, 0, 0, 0.35)',
          display: 'flex',
          flexDirection: 'column',
          boxSizing: 'border-box',
          overflow: 'hidden'
        }}
      >
        {/* Top Accent Bar (82% Navy / 18% Orange) */}
        <div style={{ display: 'flex', width: '100%', height: '7px', flexShrink: 0 }}>
          <div style={{ width: '82%', backgroundColor: '#003A70' }} />
          <div style={{ width: '18%', backgroundColor: '#FF9900' }} />
        </div>

        <div style={{ flex: 1, padding: '16px 26px 22px 26px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
          <div>
            {/* 1. TOP HEADER */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '20px' }}>
              <div style={{ flex: '1 1 auto' }}>
                <div style={{ height: '42px', maxWidth: '195px', display: 'flex', alignItems: 'center', marginBottom: '6px' }}>
                  <img
                    src={logoSrc}
                    alt="VRM Structures"
                    style={{ maxHeight: '40px', maxWidth: '185px', width: 'auto', height: 'auto', display: 'block' }}
                    onError={(e) => { e.currentTarget.src = VRM_OFFICIAL_LOGO; }}
                  />
                </div>
                <div style={{ fontSize: '12.5px', fontWeight: '800', color: '#0F3D6E', letterSpacing: '0.2px', textTransform: 'uppercase', marginBottom: '2px' }}>
                  {compProfile.name}
                </div>
                <div style={{ fontSize: '9px', color: '#334155', lineHeight: '1.4', maxWidth: '340px' }}>
                  <div>{compProfile.address}</div>
                  <div style={{ marginTop: '2px' }}>
                    <strong style={{ color: '#0F172A' }}>GSTIN: </strong>
                    <span style={{ fontWeight: '700', color: '#0F172A' }}>{compProfile.gst}</span>
                  </div>
                </div>
              </div>

              <div style={{ textAlign: 'right', flex: '0 0 auto', paddingTop: '2px' }}>
                <div style={{ fontSize: '21px', fontWeight: '800', color: '#0F3D6E', letterSpacing: '0.4px', textTransform: 'uppercase' }}>
                  PURCHASE ORDER
                </div>
                <div style={{ fontSize: '11.5px', fontWeight: '700', color: '#0F172A', marginTop: '3px' }}>
                  {poNo}
                </div>
                <div style={{ fontSize: '9.5px', color: '#64748B', marginTop: '2px' }}>
                  PO Date: <strong style={{ color: '#334155' }}>{poDateStr}</strong>
                </div>
                {deliveryDateStr && (
                  <div style={{ fontSize: '9.5px', color: '#64748B', marginTop: '2px' }}>
                    Expected Delivery: <strong style={{ color: '#334155' }}>{deliveryDateStr}</strong>
                  </div>
                )}
                <div style={{ fontSize: '9.5px', color: '#64748B', marginTop: '8px' }}>
                  PO Issued By: <strong style={{ color: '#334155', fontWeight: '600' }}>{issuedBy}</strong>
                </div>
              </div>
            </div>

            {/* GOLD DIVIDER */}
            <div style={{ height: '2px', backgroundColor: '#D97706', margin: '10px 0 14px 0', width: '100%' }} />

            {/* 2. VENDOR & DELIVERY ADDRESS CARDS */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', columnGap: '14px', marginBottom: '16px', fontSize: '9.5px', lineHeight: '1.45' }}>
              <div style={{ backgroundColor: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: '4px', padding: '10px 14px' }}>
                <div style={{ fontSize: '9px', fontWeight: '800', color: '#0F3D6E', textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: '4px' }}>
                  VENDOR (SUPPLIER)
                </div>
                <div style={{ fontSize: '11px', fontWeight: '800', color: '#0F172A', textTransform: 'uppercase', marginBottom: '3px' }}>
                  {vendorName}
                </div>
                {contactPerson && <div style={{ color: '#334155' }}>Attn: {contactPerson}</div>}
                {contactNo && contactNo !== '—' && <div style={{ color: '#334155' }}>Phone: {contactNo}</div>}
                {vendorEmail && vendorEmail !== '—' && <div style={{ color: '#334155' }}>Email: {vendorEmail}</div>}
                {billingAddress && (
                  <div style={{ marginTop: '4px', color: '#334155' }}>
                    <strong style={{ color: '#0F172A' }}>Billing Address: </strong>
                    <span>{billingAddress}</span>
                  </div>
                )}
                {vendorGst && (
                  <div style={{ marginTop: '4px' }}>
                    <strong style={{ color: '#0F172A' }}>GSTIN: </strong>
                    <span style={{ fontWeight: '700', color: '#0F172A' }}>{vendorGst}</span>
                  </div>
                )}
              </div>

              <div style={{ backgroundColor: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: '4px', padding: '10px 14px' }}>
                <div style={{ fontSize: '9px', fontWeight: '800', color: '#0F3D6E', textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: '4px' }}>
                  DELIVERY ADDRESS
                </div>
                <div style={{ fontSize: '11px', fontWeight: '800', color: '#0F172A', textTransform: 'uppercase', marginBottom: '3px' }}>
                  {compProfile.name}
                </div>
                <div style={{ color: '#334155' }}>{deliveryAddress}</div>
              </div>
            </div>

            {/* 3. ORDER ITEMS TABLE */}
            <div style={{ fontSize: '10.5px', fontWeight: '800', color: '#0F3D6E', textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: '6px' }}>
              ORDER ITEMS
            </div>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '9.5px', marginBottom: '14px' }}>
              <thead>
                <tr style={{ backgroundColor: '#0B3B60', color: '#FFFFFF', fontWeight: '700', fontSize: '8.5px', letterSpacing: '0.3px', textTransform: 'uppercase' }}>
                  <th style={{ padding: '7px 8px', textAlign: 'center', width: '28px' }}>#</th>
                  <th style={{ padding: '7px 10px', textAlign: 'left' }}>ITEM &amp; DESCRIPTION</th>
                  <th style={{ padding: '7px 8px', textAlign: 'center', width: '70px' }}>HSN</th>
                  <th style={{ padding: '7px 8px', textAlign: 'right', width: '55px' }}>QTY</th>
                  <th style={{ padding: '7px 8px', textAlign: 'center', width: '48px' }}>UNIT</th>
                  <th style={{ padding: '7px 8px', textAlign: 'right', width: '76px' }}>RATE (₹)</th>
                  <th style={{ padding: '7px 8px', textAlign: 'right', width: '85px' }}>WITHOUT GST (₹)</th>
                  <th style={{ padding: '7px 10px', textAlign: 'right', width: '88px' }}>WITH GST (₹)</th>
                </tr>
              </thead>
              <tbody>
                {normalizedItems.length === 0 ? (
                  <tr style={{ borderBottom: '1px solid #E2E8F0' }}>
                    <td colSpan="8" style={{ padding: '16px', textAlign: 'center', color: '#94A3B8' }}>
                      No line items added.
                    </td>
                  </tr>
                ) : (() => {
                  let mainCounter = 0;
                  const seenSetGroups = new Set();
                  return normalizedItems.map((row, idx) => {
                    const isSet = row.isPresetItem && row.presetGroupId;
                    const setGroupItems = isSet ? normalizedItems.filter(r => r.presetGroupId === row.presetGroupId) : [];
                    const idxInSet = isSet ? setGroupItems.findIndex(r => r.key === row.key) : -1;
                    const isFirstInSet = isSet && idxInSet === 0;
                    let setNumber = 0;
                    if (isFirstInSet) {
                      seenSetGroups.add(row.presetGroupId);
                      mainCounter += 1;
                      setNumber = mainCounter;
                    } else if (!isSet) {
                      mainCounter += 1;
                    }
                    const displayIndex = isSet ? String.fromCharCode(97 + Math.max(0, idxInSet)) : String(mainCounter);

                    const grp = isSet ? presetGroups[row.presetGroupId] : null;
                    const grpSetCount = grp ? (Number(grp.setCount) || 1) : 1;
                    const grpRate = grp ? (Number(grp.kitPrice) || 0) : 0;
                    const grpTaxable = (grpRate * grpSetCount) * (1 - discountPct / 100);
                    const grpGstPct = grp ? (parseFloat(String(grp.gstRate || '18').replace('%', '')) || 18) : 18;
                    const grpInclGst = grpTaxable + grpTaxable * (grpGstPct / 100);

                    return (
                      <React.Fragment key={row.key}>
                        {isFirstInSet && grp && (
                          <tr style={{ backgroundColor: '#EFF6FF', borderTop: '1.5px solid #93C5FD', borderBottom: '1px solid #BFDBFE' }}>
                            <td style={{ padding: '8px 8px', textAlign: 'center', fontWeight: '800', color: '#0F3D6E', fontSize: '11.5px' }}>
                              {setNumber}
                            </td>
                            <td colSpan="7" style={{ padding: '8px 10px', fontWeight: '800', color: '#0F3D6E', fontSize: '11.5px', letterSpacing: '0.2px' }}>
                              {grp.presetName || row.presetName}
                            </td>
                          </tr>
                        )}
                        <tr style={{ borderBottom: '1px solid #E2E8F0', backgroundColor: isSet ? '#FAFCFF' : '#FFFFFF' }}>
                          <td style={{ padding: isSet ? '7px 6px 7px 16px' : '7px 8px', textAlign: isSet ? 'right' : 'center', verticalAlign: 'top', color: '#64748B', fontWeight: '600' }}>
                            {displayIndex}
                          </td>
                          <td style={{ padding: isSet ? '7px 10px 7px 22px' : '7px 10px', verticalAlign: 'top' }}>
                            <div style={{ fontWeight: '700', color: '#0F172A', fontSize: '9.8px' }}>{row.name}</div>
                            {row.description ? (
                              <div style={{ color: '#475569', fontSize: '8.3px', marginTop: '2px', lineHeight: '1.35', whiteSpace: 'pre-wrap' }}>
                                {row.description}
                              </div>
                            ) : null}
                          </td>
                          <td style={{ padding: '7px 8px', textAlign: 'center', verticalAlign: 'top', color: '#475569' }}>
                            {row.hsn || '—'}
                          </td>
                          <td style={{ padding: '7px 8px', textAlign: 'right', verticalAlign: 'top', color: '#0F172A', fontWeight: '600' }}>
                            {fmtQty(row.qty)}
                          </td>
                          <td style={{ padding: '7px 8px', textAlign: 'center', verticalAlign: 'top', color: '#475569' }}>
                            {row.unit}
                          </td>
                          {isSet ? (
                            isFirstInSet ? (
                              <>
                                <td rowSpan={setGroupItems.length} style={{ padding: '7px 8px', textAlign: 'right', verticalAlign: 'middle', color: '#0F172A', fontWeight: '600', borderLeft: '1px solid #E2E8F0' }}>
                                  {fmtMoney(grpRate)}
                                </td>
                                <td rowSpan={setGroupItems.length} style={{ padding: '7px 8px', textAlign: 'right', verticalAlign: 'middle', color: '#0F172A', fontWeight: '600' }}>
                                  {fmtMoney(grpTaxable)}
                                </td>
                                <td rowSpan={setGroupItems.length} style={{ padding: '7px 10px', textAlign: 'right', verticalAlign: 'middle', fontWeight: '700', color: '#0F172A' }}>
                                  {fmtMoney(grpInclGst)}
                                </td>
                              </>
                            ) : null
                          ) : (
                            <>
                              <td style={{ padding: '7px 8px', textAlign: 'right', verticalAlign: 'top', color: '#0F172A' }}>
                                {fmtMoney(row.rate)}
                              </td>
                              <td style={{ padding: '7px 8px', textAlign: 'right', verticalAlign: 'top', color: '#0F172A' }}>
                                {fmtMoney(row.taxable)}
                              </td>
                              <td style={{ padding: '7px 10px', textAlign: 'right', verticalAlign: 'top', fontWeight: '700', color: '#0F172A' }}>
                                {fmtMoney(row.inclGst)}
                              </td>
                            </>
                          )}
                        </tr>
                      </React.Fragment>
                    );
                  });
                })()}
              </tbody>
            </table>

            {/* 4. GST SUMMARY TABLE */}
            {gstTiers.length > 0 && (
              <div style={{ marginBottom: '16px', pageBreakInside: 'avoid' }}>
                <div style={{ fontSize: '9.5px', fontWeight: '800', color: '#0F3D6E', textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: '5px' }}>
                  GST SUMMARY
                </div>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '9px' }}>
                  <thead>
                    <tr style={{ backgroundColor: '#F1F5F9', borderTop: '1px solid #CBD5E1', borderBottom: '1px solid #CBD5E1', color: '#475569', fontWeight: '700', fontSize: '8px', textTransform: 'uppercase' }}>
                      <th style={{ padding: '6px 8px', textAlign: 'left' }}>RATE</th>
                      <th style={{ padding: '6px 8px', textAlign: 'right' }}>TAXABLE (₹)</th>
                      {isIntra ? (
                        <>
                          <th style={{ padding: '6px 8px', textAlign: 'right' }}>CGST (₹)</th>
                          <th style={{ padding: '6px 8px', textAlign: 'right' }}>SGST (₹)</th>
                        </>
                      ) : (
                        <th style={{ padding: '6px 8px', textAlign: 'right' }}>IGST (₹)</th>
                      )}
                      <th style={{ padding: '6px 8px', textAlign: 'right' }}>TOTAL GST (₹)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {gstTiers.map((t) => {
                      const halfAmt = t.gstAmt / 2;
                      return (
                        <tr key={t.rate} style={{ borderBottom: '1px solid #E2E8F0' }}>
                          <td style={{ padding: '5px 8px', color: '#0F172A' }}>{t.rate}%</td>
                          <td style={{ padding: '5px 8px', textAlign: 'right', color: '#0F172A' }}>{fmtMoney(t.taxable)}</td>
                          {isIntra ? (
                            <>
                              <td style={{ padding: '5px 8px', textAlign: 'right', color: '#334155' }}>{fmtMoney(halfAmt)}</td>
                              <td style={{ padding: '5px 8px', textAlign: 'right', color: '#334155' }}>{fmtMoney(halfAmt)}</td>
                            </>
                          ) : (
                            <td style={{ padding: '5px 8px', textAlign: 'right', color: '#334155' }}>{fmtMoney(t.gstAmt)}</td>
                          )}
                          <td style={{ padding: '5px 8px', textAlign: 'right', fontWeight: '600', color: '#0F172A' }}>{fmtMoney(t.gstAmt)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

            {/* 5. BOTTOM GRID: PAYMENT TERMS & NOTES/TERMS (LEFT) | TOTALS, GRAND TOTAL, WORDS & STAMP (RIGHT) */}
            <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 52fr) minmax(0, 48fr)', columnGap: '24px', marginTop: '6px', fontSize: '9.2px', width: '100%', boxSizing: 'border-box', pageBreakInside: 'avoid' }}>
              <div>
                <div style={{ marginBottom: '12px' }}>
                  <div style={{ fontSize: '9.5px', fontWeight: '800', color: '#0F3D6E', textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: '4px' }}>
                    PAYMENT TERMS
                  </div>
                  <div style={{ fontWeight: '700', color: '#0F172A' }}>{paymentTerms}</div>
                </div>

                {notesText && (
                  <div style={{ marginBottom: '12px' }}>
                    <div style={{ fontSize: '9.5px', fontWeight: '800', color: '#0F3D6E', textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: '4px' }}>
                      NOTES &amp; REMARKS
                    </div>
                    <div style={{ fontSize: '8.8px', color: '#334155', lineHeight: '1.5', whiteSpace: 'pre-wrap' }}>
                      {notesText}
                    </div>
                  </div>
                )}

                <div>
                  <div style={{ fontSize: '9.5px', fontWeight: '800', color: '#0F3D6E', textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: '4px' }}>
                    TERMS &amp; CONDITIONS
                  </div>
                  {termsText ? (
                    <div style={{ fontSize: '8.8px', color: '#334155', lineHeight: '1.55', whiteSpace: 'pre-wrap' }}>
                      {termsText}
                    </div>
                  ) : (
                    <div style={{ fontSize: '8.8px', color: '#334155', lineHeight: '1.55' }}>
                      <div>1. Please quote PO number ({poNo}) on all invoices &amp; challans.</div>
                      <div>2. Goods must conform strictly to order specifications.</div>
                      <div>3. Delivery must be completed on or before the expected date.</div>
                      <div>4. Payment will be processed per agreed terms ({paymentTerms}).</div>
                    </div>
                  )}
                </div>
              </div>

              <div>
                <div style={{ fontSize: '9.5px', lineHeight: '1.65', marginBottom: '8px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', color: '#475569' }}>
                    <span>Subtotal</span>
                    <span style={{ fontWeight: '700', color: '#0F172A' }}>₹{fmtMoney(rawSubTotal)}</span>
                  </div>
                  {discountPct > 0 && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', color: '#DC2626' }}>
                      <span>Discount ({discountPct}%)</span>
                      <span style={{ fontWeight: '700' }}>- ₹{fmtMoney(discountAmt)}</span>
                    </div>
                  )}
                  {isIntra ? (
                    <>
                      <div style={{ display: 'flex', justifyContent: 'space-between', color: '#475569' }}>
                        <span>Total CGST</span>
                        <span style={{ fontWeight: '700', color: '#0F172A' }}>₹{fmtMoney(totalGst / 2)}</span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', color: '#475569' }}>
                        <span>Total SGST</span>
                        <span style={{ fontWeight: '700', color: '#0F172A' }}>₹{fmtMoney(totalGst / 2)}</span>
                      </div>
                    </>
                  ) : (
                    <div style={{ display: 'flex', justifyContent: 'space-between', color: '#475569' }}>
                      <span>Total IGST</span>
                      <span style={{ fontWeight: '700', color: '#0F172A' }}>₹{fmtMoney(totalGst)}</span>
                    </div>
                  )}
                  {shippingCharges > 0 && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', color: '#475569' }}>
                      <span>Shipping Charges</span>
                      <span style={{ fontWeight: '700', color: '#0F172A' }}>₹{fmtMoney(shippingCharges)}</span>
                    </div>
                  )}
                  {otherCharges > 0 && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', color: '#475569' }}>
                      <span>Other Charges</span>
                      <span style={{ fontWeight: '700', color: '#0F172A' }}>₹{fmtMoney(otherCharges)}</span>
                    </div>
                  )}
                  {hasRoundOff && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', color: '#475569' }}>
                      <span>Round-off</span>
                      <span style={{ fontWeight: '700', color: '#0F172A' }}>₹{roundOffVal.toFixed(2)}</span>
                    </div>
                  )}
                </div>

                <div style={{
                  backgroundColor: '#0B3B60',
                  color: '#FFFFFF',
                  padding: '9px 12px',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: '10px'
                }}>
                  <span style={{ fontSize: '10px', fontWeight: '800', letterSpacing: '0.5px' }}>GRAND TOTAL</span>
                  <span style={{ fontSize: '16px', fontWeight: '900' }}>
                    ₹{fmtMoney(roundedTotal)}
                  </span>
                </div>

                <div style={{ marginBottom: '12px' }}>
                  <div style={{ fontSize: '8px', fontWeight: '700', color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.4px' }}>
                    AMOUNT IN WORDS
                  </div>
                  <div style={{ fontSize: '9.5px', fontWeight: '800', color: '#0F172A', marginTop: '2px', lineHeight: '1.35' }}>
                    {numberToWordsINR(roundedTotal)}
                  </div>
                </div>

                <div style={{ display: 'flex', justifyContent: 'center', marginTop: '8px' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
                    <img
                      src={stampSrc}
                      alt="Authorized Signatory Stamp"
                      style={{ height: '78px', width: 'auto', maxWidth: '150px', objectFit: 'contain', display: 'block' }}
                      onError={(e) => { e.currentTarget.src = VRM_OFFICIAL_STAMP; }}
                    />
                    <div style={{ fontSize: '9px', fontWeight: '600', color: '#475569' }}>Authorized Signatory</div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Footer Bar */}
          <div style={{
            borderTop: '1px solid #CBD5E1',
            paddingTop: '8px',
            marginTop: '18px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            fontSize: '8px',
            color: '#64748B'
          }}>
            <span>{branding?.companyName || 'VRM Structures India Private Limited'} • Purchase Order</span>
            <span>{poNo} • Page 1 of 1</span>
          </div>
        </div>
      </div>
    </div>
  );

  return typeof document !== 'undefined' ? createPortal(content, document.body) : content;
}
