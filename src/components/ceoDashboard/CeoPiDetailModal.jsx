import React from 'react';
import { Boxes, ExternalLink, Factory, Receipt, X } from 'lucide-react';
import { parseAmt } from './ceoDashboardUtils';
import { extractGstRate } from '../../utils/gstHelper';

export default function CeoPiDetailModal({
  viewingPiModal,
  setViewingPiModal,
  setViewingBomModal,
  allBomList = [],
  onNavigateTab
}) {
  if (!viewingPiModal) return null;
          const pi = viewingPiModal;
        const piNo = pi.piNo || pi.id || 'PI';
        const piDate = pi.date || pi.piDate || '—';
        const customer = pi.customerName || pi.customer || pi.companyName || '—';
        const salesPerson = pi.salesPerson || pi.createdBy || 'Sales Team';
        const items = Array.isArray(pi.items) ? pi.items : [];
        const grandTotal = parseAmt(pi.grandTotal || pi.totalAmount || pi.amount || 0);
        const piMult = 1 + (extractGstRate(pi.gstRate, 18) / 100);
        const subtotal = parseAmt(pi.subtotal || pi.subTotal || pi.taxableAmount || (grandTotal > 0 ? grandTotal / piMult : 0));
        const taxTotal = parseAmt(pi.taxTotal || pi.gstAmount || (grandTotal - subtotal));
        const paymentTerms = pi.paymentTerms || pi.terms || '100% Advance / Net 30';
        const isBOMConverted = Boolean(pi.bomConverted || pi.bomCode);
        const matchingBom = isBOMConverted ? allBomList.find(b => (b.bomCode === pi.bomCode || b.id === pi.bomCode || b.sourcePiNo === piNo)) : null;

        return (
          <div style={{
            position: 'fixed',
            top: 0, left: 0, right: 0, bottom: 0,
            backgroundColor: 'rgba(15, 23, 42, 0.65)',
            backdropFilter: 'blur(3px)',
            zIndex: 99999,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '16px'
          }}>
            <div style={{
              backgroundColor: '#FFFFFF',
              borderRadius: '20px',
              width: '920px',
              maxWidth: '100%',
              maxHeight: '90vh',
              display: 'flex',
              flexDirection: 'column',
              boxShadow: '0 25px 50px -12px rgba(15, 23, 42, 0.35)',
              border: '1px solid #E2E8F0',
              overflow: 'hidden'
            }}>
              {/* Header */}
              <div style={{
                padding: '16px 22px',
                borderBottom: '1px solid #E2E8F0',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                backgroundColor: '#F8FAFC'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <div style={{
                    width: '38px',
                    height: '38px',
                    borderRadius: '10px',
                    backgroundColor: '#ECFEFF',
                    color: '#0E7490',
                    border: '1px solid #A5F3FC',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0
                  }}>
                    <Receipt size={20} />
                  </div>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ fontSize: '15px', fontWeight: '800', color: '#0F172A' }}>
                        Proforma Invoice • {piNo}
                      </span>
                      <span style={{
                        fontSize: '10px',
                        fontWeight: '800',
                        padding: '2px 8px',
                        borderRadius: '999px',
                        backgroundColor: '#ECFEFF',
                        color: '#0E7490',
                        border: '1px solid #A5F3FC'
                      }}>
                        {pi.status || 'Active'}
                      </span>
                      {isBOMConverted && (
                        <span style={{
                          fontSize: '10px',
                          fontWeight: '800',
                          padding: '2px 8px',
                          borderRadius: '999px',
                          backgroundColor: '#F0FDF4',
                          color: '#16A34A',
                          border: '1px solid #BBF7D0'
                        }}>
                          ✓ BOM Generated {pi.bomCode ? `(${pi.bomCode})` : ''}
                        </span>
                      )}
                    </div>
                    <div style={{ fontSize: '11.5px', color: '#64748B', marginTop: '2px' }}>
                      Commercial Sales PI • Generated on {piDate} • Executive: <strong>{salesPerson}</strong>
                    </div>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setViewingPiModal(null)}
                  style={{
                    border: 'none',
                    background: 'none',
                    width: '32px',
                    height: '32px',
                    borderRadius: '8px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                    color: '#64748B',
                    backgroundColor: '#F1F5F9'
                  }}
                >
                  <X size={18} />
                </button>
              </div>

              {/* Body */}
              <div style={{ padding: '18px 22px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                {/* Info Cards Grid */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '10px' }}>
                  <div style={{ backgroundColor: '#F8FAFC', padding: '10px 12px', borderRadius: '10px', border: '1px solid #E2E8F0' }}>
                    <div style={{ fontSize: '10.5px', color: '#64748B', fontWeight: '700', textTransform: 'uppercase' }}>Customer / Client</div>
                    <div style={{ fontSize: '13px', fontWeight: '800', color: '#0F172A', marginTop: '3px' }}>{customer}</div>
                    {pi.customerPhone && <div style={{ fontSize: '11px', color: '#64748B', marginTop: '2px' }}>📞 {pi.customerPhone}</div>}
                  </div>
                  <div style={{ backgroundColor: '#F8FAFC', padding: '10px 12px', borderRadius: '10px', border: '1px solid #E2E8F0' }}>
                    <div style={{ fontSize: '10.5px', color: '#64748B', fontWeight: '700', textTransform: 'uppercase' }}>Payment Terms</div>
                    <div style={{ fontSize: '12px', fontWeight: '700', color: '#0F172A', marginTop: '3px' }}>{paymentTerms}</div>
                    <div style={{ fontSize: '11px', color: '#64748B', marginTop: '2px' }}>Date: {piDate}</div>
                  </div>
                  <div style={{ backgroundColor: '#F8FAFC', padding: '10px 12px', borderRadius: '10px', border: '1px solid #E2E8F0' }}>
                    <div style={{ fontSize: '10.5px', color: '#64748B', fontWeight: '700', textTransform: 'uppercase' }}>Total Line Items</div>
                    <div style={{ fontSize: '13px', fontWeight: '800', color: '#0F172A', marginTop: '3px' }}>{items.length} Products / Kits</div>
                    <div style={{ fontSize: '11px', color: '#64748B', marginTop: '2px' }}>Sales Rep: {salesPerson}</div>
                  </div>
                  <div style={{ backgroundColor: '#ECFEFF', padding: '10px 12px', borderRadius: '10px', border: '1px solid #A5F3FC' }}>
                    <div style={{ fontSize: '10.5px', color: '#0E7490', fontWeight: '800', textTransform: 'uppercase' }}>PI Grand Total</div>
                    <div style={{ fontSize: '16px', fontWeight: '900', color: '#0E7490', marginTop: '3px' }}>
                      ₹ {Math.round(grandTotal).toLocaleString('en-IN')}
                    </div>
                    <div style={{ fontSize: '10.5px', color: '#0E7490', marginTop: '2px' }}>Incl. GST (18%)</div>
                  </div>
                </div>

                {/* Items Table with Grouped Presets and Kit Value Header */}
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px', flexWrap: 'wrap', gap: '6px' }}>
                    <div style={{ fontSize: '12px', fontWeight: '800', color: '#0F172A', textTransform: 'uppercase' }}>
                      Quoted Products & Preset Kits ({items.length} components)
                    </div>
                    <div style={{ fontSize: '11px', color: '#64748B', fontWeight: '600' }}>
                      Grouped by Preset Kit with distinct pricing & boundaries
                    </div>
                  </div>

                  {(() => {
                    let presetGroupsData = pi.presetGroups || {};
                    if (typeof presetGroupsData === 'string') {
                      try {
                        presetGroupsData = JSON.parse(presetGroupsData);
                      } catch (e) {
                        presetGroupsData = {};
                      }
                    }
                    const sections = [];
                    const sectionMap = new Map();

                    const allZeroRates = items.length > 0 && items.every(it => (parseFloat(it.rate || it.price || 0) || 0) === 0);

                    items.forEach((it, idx) => {
                      const isPreset = Boolean(it.isPresetItem || it.presetGroupId || it.presetName || (allZeroRates && pi.presetName));
                      const secKey = isPreset
                        ? (it.presetGroupId || it.presetName || pi.presetName || 'PRESET_1')
                        : '__CUSTOM_ITEMS__';

                      if (!sectionMap.has(secKey)) {
                        const secObj = {
                          key: secKey,
                          isPreset,
                          presetGroupId: it.presetGroupId,
                          presetName: isPreset ? (it.presetName || (it.presetGroupId && presetGroupsData[it.presetGroupId]?.presetName) || pi.presetName || 'Preset Structure Kit') : 'Custom / Standalone Products',
                          items: []
                        };
                        sectionMap.set(secKey, secObj);
                        sections.push(secObj);
                      }
                      sectionMap.get(secKey).items.push({ item: it, originalIndex: idx });
                    });

                    // Pre-compute custom items taxable sum
                    const customTaxableTotal = sections
                      .filter(s => !s.isPreset)
                      .flatMap(s => s.items)
                      .reduce((sum, { item }) => {
                        const q = parseFloat(item.qty !== undefined ? item.qty : (item.quantity || 0)) || 0;
                        const r = parseFloat(item.rate || item.price || 0) || 0;
                        return sum + (q * r);
                      }, 0);

                    const presetTaxablePool = Math.max(0, subtotal - customTaxableTotal);
                    const presetSections = sections.filter(s => s.isPreset);
                    const presetGroupsList = Array.isArray(presetGroupsData)
                      ? presetGroupsData
                      : (presetGroupsData && typeof presetGroupsData === 'object' ? Object.values(presetGroupsData) : []);

                    return (
                      <div style={{ border: '1px solid #E2E8F0', borderRadius: '10px', overflowX: 'auto' }}>
                        <table style={{ width: '100%', fontSize: '11px', borderCollapse: 'collapse', textAlign: 'left' }}>
                          <thead>
                            <tr style={{ backgroundColor: '#F8FAFC', borderBottom: '1px solid #E2E8F0', color: '#64748B' }}>
                              <th style={{ padding: '8px 10px', width: '38px', textAlign: 'center' }}>#</th>
                              <th style={{ padding: '8px 10px' }}>Product / Component</th>
                              <th style={{ padding: '8px 10px', width: '80px', textAlign: 'center' }}>HSN / SAC</th>
                              <th style={{ padding: '8px 10px', textAlign: 'center', width: '65px' }}>Qty</th>
                              <th style={{ padding: '8px 10px', textAlign: 'center', width: '55px' }}>UOM</th>
                              <th style={{ padding: '8px 10px', textAlign: 'center', width: '110px' }}>Rate (₹)</th>
                              <th style={{ padding: '8px 10px', textAlign: 'center', width: '55px' }}>GST</th>
                              <th style={{ padding: '8px 10px', textAlign: 'right', width: '110px' }}>Total (₹)</th>
                            </tr>
                          </thead>
                          <tbody>
                            {sections.length > 0 ? (
                              sections.map((sec, secIdx) => {
                                if (sec.isPreset) {
                                  const presetIdx = presetSections.indexOf(sec);
                                  let grpConfig = (sec.presetGroupId && presetGroupsData[sec.presetGroupId]) || (presetGroupsData[sec.key]) || null;
                                  if (!grpConfig && presetGroupsList.length > 0) {
                                    grpConfig = presetGroupsList.find(g =>
                                      (sec.presetGroupId && (g.id === sec.presetGroupId || g.groupId === sec.presetGroupId)) ||
                                      (sec.presetName && g.presetName && g.presetName.toLowerCase().trim() === sec.presetName.toLowerCase().trim()) ||
                                      (g.name && sec.presetName && g.name.toLowerCase().trim() === sec.presetName.toLowerCase().trim())
                                    ) || null;
                                  }
                                  const setCount = parseFloat(grpConfig?.setCount || grpConfig?.quantity || pi.presetSetCount || 1) || 1;
                                  const pUnit = grpConfig?.unit || grpConfig?.unitType || pi.presetUnit || 'Sets';

                                  // Calculate kit taxable
                                  let taxable = 0;
                                  if (grpConfig?.kitPrice && parseFloat(grpConfig.kitPrice) > 0) {
                                    taxable = (parseFloat(grpConfig.kitPrice) || 0) * setCount;
                                  } else if (pi.presetKitPrice && parseFloat(pi.presetKitPrice) > 0) {
                                    taxable = (parseFloat(pi.presetKitPrice) || 0) * setCount;
                                  } else if (pi.unitValue && parseFloat(pi.unitValue) > 0) {
                                    taxable = parseFloat(pi.unitValue) || 0;
                                  } else if (pi.kitSubtotal && parseFloat(pi.kitSubtotal) > 0) {
                                    taxable = parseFloat(pi.kitSubtotal) || 0;
                                  } else if (presetSections.length === 1) {
                                    taxable = presetTaxablePool || (grandTotal > 0 ? Math.round(grandTotal / 1.18) : 0);
                                  } else if (presetSections.length > 0) {
                                    taxable = Math.round(presetTaxablePool / presetSections.length);
                                  }

                                  const rawGst = grpConfig?.gstRate ?? sec.items[0]?.item?.gstRate ?? pi.gstRate;
                                  const gstPct = extractGstRate(rawGst, 18);
                                  const kitGst = Math.round(taxable * (gstPct / 100));
                                  const kitTotal = Math.round(taxable + kitGst);

                                  return (
                                    <React.Fragment key={sec.key}>
                                      {/* PRESET HEADER BANNER WITH KIT VALUE PROMINENTLY IN THE MIDDLE */}
                                      <tr style={{ backgroundColor: '#F0FDFA', borderTop: '2.5px solid #0E7490', borderBottom: '1.5px solid #A5F3FC' }}>
                                        <td colSpan={8} style={{ padding: '9px 12px' }}>
                                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px' }}>
                                            {/* Left: Preset Badge & Name */}
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                              <span style={{
                                                backgroundColor: '#0E7490',
                                                color: '#FFFFFF',
                                                fontSize: '10.5px',
                                                fontWeight: '900',
                                                padding: '2.5px 8px',
                                                borderRadius: '6px',
                                                letterSpacing: '0.5px',
                                                display: 'inline-flex',
                                                alignItems: 'center',
                                                gap: '4px'
                                              }}>
                                                <Boxes size={12} />
                                                PRESET {presetIdx + 1}
                                              </span>
                                              <strong style={{ fontSize: '13px', color: '#0F172A', fontWeight: '800' }}>
                                                {sec.presetName}
                                              </strong>
                                              <span style={{
                                                fontSize: '11px',
                                                color: '#0E7490',
                                                fontWeight: '700',
                                                backgroundColor: '#ECFEFF',
                                                padding: '2px 8px',
                                                borderRadius: '12px',
                                                border: '1px solid #A5F3FC'
                                              }}>
                                                Total Qty: {setCount} {pUnit} ({sec.items.length} components)
                                              </span>
                                            </div>

                                            {/* Center / Right: PROMINENT PRESET KIT VALUE BADGE */}
                                            <div style={{
                                              display: 'inline-flex',
                                              alignItems: 'center',
                                              gap: '10px',
                                              backgroundColor: '#FFFFFF',
                                              border: '1.5px solid #0E7490',
                                              borderRadius: '8px',
                                              padding: '4px 12px',
                                              boxShadow: '0 1px 3px rgba(14, 116, 144, 0.08)'
                                            }}>
                                              <div style={{ display: 'flex', alignItems: 'baseline', gap: '4px' }}>
                                                <span style={{ fontSize: '9.5px', color: '#64748B', fontWeight: '800', textTransform: 'uppercase' }}>KIT VALUE:</span>
                                                <strong style={{ fontSize: '12.5px', color: '#0F172A', fontWeight: '900' }}>
                                                  ₹ {Math.round(taxable).toLocaleString('en-IN')}
                                                </strong>
                                              </div>
                                              <span style={{ color: '#CBD5E1', fontWeight: '300' }}>|</span>
                                              <div style={{ display: 'flex', alignItems: 'baseline', gap: '4px' }}>
                                                <span style={{ fontSize: '9.5px', color: '#64748B', fontWeight: '800', textTransform: 'uppercase' }}>GST ({gstPct}%):</span>
                                                <strong style={{ fontSize: '11.5px', color: '#0F172A', fontWeight: '800' }}>
                                                  ₹ {kitGst.toLocaleString('en-IN')}
                                                </strong>
                                              </div>
                                              <span style={{ color: '#CBD5E1', fontWeight: '300' }}>|</span>
                                              <div style={{ display: 'flex', alignItems: 'baseline', gap: '4px' }}>
                                                <span style={{ fontSize: '9.5px', color: '#0E7490', fontWeight: '800', textTransform: 'uppercase' }}>TOTAL:</span>
                                                <strong style={{ fontSize: '13.5px', color: '#0E7490', fontWeight: '900' }}>
                                                  ₹ {kitTotal.toLocaleString('en-IN')}
                                                </strong>
                                              </div>
                                            </div>
                                          </div>
                                        </td>
                                      </tr>

                                      {/* Individual Component Items */}
                                      {sec.items.map(({ item: it, originalIndex }, cIdx) => {
                                        const q = parseFloat(it.qty !== undefined ? it.qty : (it.quantity || 0)) || 0;
                                        const r = parseFloat(it.rate || it.price || 0) || 0;
                                        const taxRateStr = String(it.gstRate || it.gst || '18%').replace('%', '').trim();
                                        const taxRate = parseFloat(taxRateStr) || gstPct;
                                        const hasExplicitRate = r > 0;
                                        const taxableItem = q * r;
                                        const itemTotal = taxableItem + (taxableItem * (taxRate / 100));

                                        return (
                                          <tr key={originalIndex} style={{ borderBottom: '1px solid #F1F5F9', backgroundColor: cIdx % 2 === 1 ? '#FAFDFD' : '#FFFFFF' }}>
                                            <td style={{ padding: '7px 10px', color: '#64748B', fontWeight: '700', textAlign: 'center' }}>
                                              {presetIdx + 1}.{cIdx + 1}
                                            </td>
                                            <td style={{ padding: '7px 10px', fontWeight: '700', color: '#0F172A' }}>
                                              <div>{it.name || it.productName || 'Item'}</div>
                                              {it.subPresetName && (
                                                <div style={{ fontSize: '10px', color: '#0D9488', fontWeight: '700', marginTop: '1px' }}>
                                                  ↳ Sub-Kit: {it.subPresetName}
                                                </div>
                                              )}
                                            </td>
                                            <td style={{ padding: '7px 10px', color: '#64748B', textAlign: 'center' }}>{it.hsn || it.hsn_or_sac || '—'}</td>
                                            <td style={{ padding: '7px 10px', textAlign: 'center', fontWeight: '800', color: '#0F172A' }}>{q}</td>
                                            <td style={{ padding: '7px 10px', textAlign: 'center', color: '#64748B' }}>{it.uom || it.unit || 'NOS'}</td>
                                            <td style={{ padding: '7px 10px', textAlign: 'center' }}>
                                              {hasExplicitRate ? (
                                                <span style={{ color: '#475569', fontWeight: '700' }}>₹ {r.toLocaleString('en-IN')}</span>
                                              ) : (
                                                <span style={{ fontSize: '10px', color: '#0E7490', fontWeight: '700', backgroundColor: '#ECFEFF', padding: '2px 7px', borderRadius: '4px', border: '1px solid #CFFAFE' }}>
                                                  Incl. in Kit
                                                </span>
                                              )}
                                            </td>
                                            <td style={{ padding: '7px 10px', textAlign: 'center', color: '#64748B' }}>{taxRate}%</td>
                                            <td style={{ padding: '7px 10px', textAlign: 'right' }}>
                                              {hasExplicitRate ? (
                                                <strong style={{ color: '#0F172A' }}>₹ {Math.round(itemTotal).toLocaleString('en-IN')}</strong>
                                              ) : (
                                                <span style={{ fontSize: '10px', color: '#0E7490', fontWeight: '700', backgroundColor: '#ECFEFF', padding: '2px 7px', borderRadius: '4px', border: '1px solid #CFFAFE' }}>
                                                  Incl. in Kit
                                                </span>
                                              )}
                                            </td>
                                          </tr>
                                        );
                                      })}

                                      {/* END OF PRESET DIVIDER */}
                                      <tr style={{ backgroundColor: '#F0FDFA', borderTop: '1px dashed #99F6E4', borderBottom: '2.5px solid #0E7490' }}>
                                        <td colSpan={8} style={{ padding: '8px 14px', textAlign: 'center' }}>
                                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px' }}>
                                            <div style={{ height: '1.5px', flex: 1, backgroundColor: '#5EEAD4' }} />
                                            <span style={{
                                              fontSize: '11px',
                                              fontWeight: '800',
                                              color: '#0F766E',
                                              backgroundColor: '#CCFBF1',
                                              padding: '3px 12px',
                                              borderRadius: '999px',
                                              border: '1px solid #99F6E4',
                                              letterSpacing: '0.4px',
                                              display: 'inline-flex',
                                              alignItems: 'center',
                                              gap: '6px'
                                            }}>
                                              ✓ END OF PRESET {presetIdx + 1}: {sec.presetName} ({sec.items.length} Components • Total Kit Value: ₹ {kitTotal.toLocaleString('en-IN')})
                                            </span>
                                            <div style={{ height: '1.5px', flex: 1, backgroundColor: '#5EEAD4' }} />
                                          </div>
                                        </td>
                                      </tr>
                                    </React.Fragment>
                                  );
                                }

                                // CUSTOM / STANDALONE PRODUCTS SECTION
                                const customSecTaxable = sec.items.reduce((sum, { item }) => {
                                  const q = parseFloat(item.qty !== undefined ? item.qty : (item.quantity || 0)) || 0;
                                  const r = parseFloat(item.rate || item.price || 0) || 0;
                                  return sum + (q * r);
                                }, 0);

                                return (
                                  <React.Fragment key="custom_section">
                                    {/* START OF CUSTOM PRODUCTS HEADER */}
                                    <tr style={{ backgroundColor: '#F8FAFC', borderTop: '2.5px solid #475569', borderBottom: '1.5px solid #CBD5E1' }}>
                                      <td colSpan={8} style={{ padding: '9px 12px' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px' }}>
                                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                            <span style={{
                                              backgroundColor: '#475569',
                                              color: '#FFFFFF',
                                              fontSize: '10.5px',
                                              fontWeight: '900',
                                              padding: '2.5px 8px',
                                              borderRadius: '6px',
                                              letterSpacing: '0.5px'
                                            }}>
                                              START OF NEW PRODUCTS (STANDALONE)
                                            </span>
                                            <strong style={{ fontSize: '13px', color: '#1E293B', fontWeight: '800' }}>
                                              Additional Materials / Standalone Products ({sec.items.length} items)
                                            </strong>
                                          </div>
                                          <span style={{ fontSize: '11px', color: '#64748B', fontWeight: '700' }}>
                                            Individually Priced Components • Subtotal: ₹ {Math.round(customSecTaxable).toLocaleString('en-IN')}
                                          </span>
                                        </div>
                                      </td>
                                    </tr>

                                    {/* Custom Line Items */}
                                    {sec.items.map(({ item: it, originalIndex }, cIdx) => {
                                      const q = parseFloat(it.qty !== undefined ? it.qty : (it.quantity || 0)) || 0;
                                      const r = parseFloat(it.rate || it.price || 0) || 0;
                                      const taxRate = extractGstRate(it.gstRate ?? it.gst, 18);
                                      const taxableItem = q * r;
                                      const itemTotal = taxableItem + (taxableItem * (taxRate / 100));

                                      return (
                                        <tr key={originalIndex} style={{ borderBottom: '1px solid #F1F5F9', backgroundColor: cIdx % 2 === 1 ? '#F8FAFC' : '#FFFFFF' }}>
                                          <td style={{ padding: '7px 10px', color: '#64748B', fontWeight: '700', textAlign: 'center' }}>
                                            C.{cIdx + 1}
                                          </td>
                                          <td style={{ padding: '7px 10px', fontWeight: '700', color: '#0F172A' }}>
                                            <div>{it.name || it.productName || 'Item'}</div>
                                            {it.category && (
                                              <div style={{ fontSize: '10px', color: '#64748B', marginTop: '1px' }}>
                                                {it.category}
                                              </div>
                                            )}
                                          </td>
                                          <td style={{ padding: '7px 10px', color: '#64748B', textAlign: 'center' }}>{it.hsn || it.hsn_or_sac || '—'}</td>
                                          <td style={{ padding: '7px 10px', textAlign: 'center', fontWeight: '800', color: '#0F172A' }}>{q}</td>
                                          <td style={{ padding: '7px 10px', textAlign: 'center', color: '#64748B' }}>{it.uom || it.unit || 'NOS'}</td>
                                          <td style={{ padding: '7px 10px', textAlign: 'right', color: '#334155', fontWeight: '700' }}>
                                            ₹ {r.toLocaleString('en-IN')}
                                          </td>
                                          <td style={{ padding: '7px 10px', textAlign: 'center', color: '#64748B' }}>{taxRate}%</td>
                                          <td style={{ padding: '7px 10px', textAlign: 'right', fontWeight: '800', color: '#0F172A' }}>
                                            ₹ {Math.round(itemTotal).toLocaleString('en-IN')}
                                          </td>
                                        </tr>
                                      );
                                    })}

                                    {/* END OF CUSTOM PRODUCTS DIVIDER */}
                                    <tr style={{ backgroundColor: '#F8FAFC', borderTop: '1px dashed #CBD5E1', borderBottom: '2.5px solid #475569' }}>
                                      <td colSpan={8} style={{ padding: '7px 14px', textAlign: 'center' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px' }}>
                                          <div style={{ height: '1px', flex: 1, backgroundColor: '#CBD5E1' }} />
                                          <span style={{ fontSize: '11px', fontWeight: '800', color: '#475569', letterSpacing: '0.4px' }}>
                                            ✓ END OF STANDALONE PRODUCTS ({sec.items.length} Items)
                                          </span>
                                          <div style={{ height: '1px', flex: 1, backgroundColor: '#CBD5E1' }} />
                                        </div>
                                      </td>
                                    </tr>
                                  </React.Fragment>
                                );
                              })
                            ) : (
                              <tr>
                                <td colSpan={8} style={{ padding: '16px', textAlign: 'center', color: '#94A3B8' }}>
                                  No individual line items listed.
                                </td>
                              </tr>
                            )}
                          </tbody>
                        </table>
                      </div>
                    );
                  })()}
                </div>

                {/* Financial Summary */}
                <div style={{
                  display: 'flex',
                  justifyContent: 'flex-end',
                  marginTop: '4px'
                }}>
                  <div style={{ width: '280px', display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '12px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', color: '#64748B' }}>
                      <span>Subtotal (Taxable):</span>
                      <strong style={{ color: '#0F172A' }}>₹ {Math.round(subtotal).toLocaleString('en-IN')}</strong>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', color: '#64748B' }}>
                      <span>Estimated GST (18%):</span>
                      <strong style={{ color: '#0F172A' }}>₹ {Math.round(taxTotal).toLocaleString('en-IN')}</strong>
                    </div>
                    <div style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      borderTop: '2px solid #0E7490',
                      paddingTop: '6px',
                      fontSize: '14px',
                      color: '#0E7490'
                    }}>
                      <span><strong>Total Quoted:</strong></span>
                      <strong style={{ fontSize: '15px' }}>₹ {Math.round(grandTotal).toLocaleString('en-IN')}</strong>
                    </div>
                  </div>
                </div>
              </div>

              {/* Footer */}
              <div style={{
                padding: '12px 22px',
                backgroundColor: '#F8FAFC',
                borderTop: '1px solid #E2E8F0',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: '8px'
              }}>
                <div style={{ display: 'flex', gap: '8px' }}>
                  {isBOMConverted && matchingBom && (
                    <button
                      type="button"
                      onClick={() => {
                        setViewingPiModal(null);
                        setViewingBomModal(matchingBom);
                      }}
                      style={{
                        padding: '7px 14px',
                        borderRadius: '8px',
                        border: '1px solid #BBF7D0',
                        backgroundColor: '#F0FDF4',
                        color: '#16A34A',
                        fontSize: '11.5px',
                        fontWeight: '800',
                        cursor: 'pointer',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '4px'
                      }}
                    >
                      <Factory size={13} /> View Linked BOM ({matchingBom.bomCode || matchingBom.id}) →
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => {
                      setViewingPiModal(null);
                      if (onNavigateTab) {
                        onNavigateTab('Performa Invoice', null, null, null);
                      }
                    }}
                    style={{
                      padding: '7px 14px',
                      borderRadius: '8px',
                      border: '1px solid #0E7490',
                      backgroundColor: '#ECFEFF',
                      color: '#0E7490',
                      fontSize: '11.5px',
                      fontWeight: '800',
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '4px'
                    }}
                  >
                    <ExternalLink size={13} /> Open in Proforma Invoice View ↗
                  </button>
                </div>

                <button
                  type="button"
                  onClick={() => setViewingPiModal(null)}
                  style={{
                    padding: '7px 16px',
                    borderRadius: '8px',
                    border: '1px solid #CBD5E1',
                    backgroundColor: '#FFFFFF',
                    color: '#334155',
                    fontSize: '12px',
                    fontWeight: '700',
                    cursor: 'pointer'
                  }}
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        );
}
