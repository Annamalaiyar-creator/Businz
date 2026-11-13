import React from 'react';
import {
  Trash2, X, AlertTriangle, Info, Layers, FileCheck, AlertCircle, Receipt
} from 'lucide-react';

export default function PiDetailsAndConfirmModals({ ctx }) {
  const {
    onNavigateTab,
    isCeo,
    setViewMode,
    selectedPi,
    setSelectedPi,
    validationAlert,
    setValidationAlert,
    piList,
    getConvertedBomsForPi,
    isTechSupportLogin,
    handleConvertToBom,
    deleteIdx,
    setDeleteIdx,
    editIdx,
    presetSetCount,
    presetKitPrice,
    presetGroups,
    setPresetGroups,
    showClearConfirmModal,
    setShowClearConfirmModal,
    piConfirmModal,
    setPiConfirmModal,
    piNumber,
    isSubmittingPI,
    setIsSubmittingPI,
    vendorName,
    piItems,
    setPiItems,
    calculatePiTotals,
    resetForm,
    executeCreatePI,
    executeDeletePI
  } = ctx;

  return (
    <>
      {/* ==================== VIEW PI DETAILS DIALOG (EXACT DASHBOARD MODAL 1:1) ==================== */}
      {selectedPi && (() => {
        const pi = selectedPi;
        const piNo = pi.piNo || pi.id || 'PI';
        const piDate = pi.date || pi.piDate || pi.createdDate || '—';
        const customer = pi.customerName || pi.customer || pi.companyName || '—';
        const salesPerson = pi.salesPerson || pi.salesperson || pi.salesRep || pi.createdBy || 'Sales Team';
        const items = Array.isArray(pi.items) ? pi.items : [];

        const parseAmt = (val) => {
          if (!val && val !== 0) return 0;
          if (typeof val === 'number') return isNaN(val) ? 0 : val;
          const cleaned = String(val).replace(/[^0-9.-]/g, '');
          const parsed = parseFloat(cleaned);
          return isNaN(parsed) ? 0 : parsed;
        };

        const grandTotal = parseAmt(pi.grandTotal || pi.totalAmount || pi.amount || pi.orderValue || pi.c5 || 0);
        const subtotal = parseAmt(pi.subtotal || pi.unitValue || pi.taxableAmount || (grandTotal > 0 ? Math.round(grandTotal / 1.18) : 0));
        const taxTotal = parseAmt(pi.taxTotal || Math.max(0, grandTotal - subtotal));
        const paymentTerms = pi.paymentTerms || pi.paymentType || pi.terms || '100% Paid';

        const matchedBoms = getConvertedBomsForPi(pi);
        const isBOMConverted = matchedBoms.length > 0 || Boolean(
          pi.status === 'Converted to BOM' ||
          pi.statusType === 'converted' ||
          pi.convertedToBom === true ||
          pi.convertedBomCode ||
          pi.convertedBomNo
        );
        const isConverted = isBOMConverted;
        const linkedBomCode = matchedBoms[0]?.bomCode || matchedBoms[0]?.code || matchedBoms[0]?.id || pi.convertedBomCode || pi.convertedBomNo;

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

        // Fallback single section if items is empty
        if (sections.length === 0 && (pi.presetName || pi.productScope || grandTotal > 0)) {
          sections.push({
            key: 'PRESET_1',
            isPreset: true,
            presetGroupId: 'group_1',
            presetName: pi.presetName || pi.productScope || 'Solar Mounting Structure Kit',
            items: [{
              item: {
                name: pi.presetName || pi.productScope || 'Solar Mounting Structure Kit',
                hsn: '73089090',
                qty: pi.presetSetCount || 1,
                uom: pi.presetUnit || 'SET',
                rate: subtotal,
                gstRate: '18%'
              },
              originalIndex: 0
            }]
          });
        }

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

        const totalComponentCount = sections.reduce((acc, s) => acc + s.items.length, 0);

        return (
          <div
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              backgroundColor: 'rgba(15, 23, 42, 0.65)',
              backdropFilter: 'blur(3px)',
              zIndex: 99999,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '16px'
            }}
            onClick={() => setSelectedPi(null)}
          >
            <div
              style={{
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
              }}
              onClick={(e) => e.stopPropagation()}
            >
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
                        backgroundColor: isBOMConverted ? '#F0FDF4' : '#ECFEFF',
                        color: isBOMConverted ? '#16A34A' : '#0E7490',
                        border: isBOMConverted ? '1px solid #BBF7D0' : '1px solid #A5F3FC'
                      }}>
                        {isBOMConverted ? 'Converted to BOM' : (pi.status || 'Issued')}
                      </span>
                    </div>
                    <div style={{ fontSize: '11.5px', color: '#64748B', marginTop: '2px' }}>
                      Commercial Sales PI • Generated on {piDate} • Executive: <strong>{salesPerson}</strong>
                    </div>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setSelectedPi(null)}
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
                    <div style={{ fontSize: '13px', fontWeight: '800', color: '#0F172A', marginTop: '3px' }}>{totalComponentCount || items.length} Products / Kits</div>
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
                      Quoted Products & Preset Kits ({totalComponentCount || items.length} components)
                    </div>
                    <div style={{ fontSize: '11px', color: '#64748B', fontWeight: '600' }}>
                      Grouped by Preset Kit with distinct pricing & boundaries
                    </div>
                  </div>

                  <div style={{ border: '1px solid #E2E8F0', borderRadius: '10px', overflowX: 'auto' }}>
                    <table style={{ width: '100%', fontSize: '11px', borderCollapse: 'collapse', textAlign: 'left' }}>
                      <thead>
                        <tr style={{ backgroundColor: '#F8FAFC', borderBottom: '1px solid #E2E8F0', color: '#64748B' }}>
                          <th style={{ padding: '8px 10px', width: '38px', textAlign: 'center' }}>#</th>
                          <th style={{ padding: '8px 10px' }}>Product / Component</th>
                          <th style={{ padding: '8px 10px', width: '80px', textAlign: 'center' }}>HSN / SAC</th>
                          <th style={{ padding: '8px 10px', textAlign: 'center', width: '65px' }}>Qty</th>
                          <th style={{ padding: '8px 10px', textAlign: 'center', width: '55px' }}>UOM</th>
                          <th style={{ padding: '8px 10px', textAlign: 'center', width: '75px' }}>Set / kW</th>
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

                              const rawGst = grpConfig?.gstRate || sec.items[0]?.item?.gstRate || pi.gstRate || '18%';
                              const gstPct = parseFloat(String(rawGst).replace('%', '').trim()) || 18;
                              const kitGst = Math.round(taxable * (gstPct / 100));
                              const kitTotal = Math.round(taxable + kitGst);

                              return (
                                <React.Fragment key={sec.key}>
                                  {/* PRESET HEADER BANNER WITH KIT VALUE */}
                                  <tr style={{ backgroundColor: '#F0FDFA', borderTop: '2.5px solid #0E7490', borderBottom: '1.5px solid #A5F3FC' }}>
                                    <td colSpan={9} style={{ padding: '9px 12px' }}>
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
                                            letterSpacing: '0.5px'
                                          }}>
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
                                            Total Qty: {setCount} {pUnit === 'kW' ? 'kW' : (setCount > 1 ? 'Sets' : 'Set')} ({sec.items.length} components)
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
                                        {/* Set / kW Column: Merged vertically in middle for entire preset group */}
                                        {cIdx === 0 ? (
                                          <td
                                            rowSpan={sec.items.length}
                                            style={{
                                              padding: '7px 10px',
                                              textAlign: 'center',
                                              verticalAlign: 'middle',
                                              backgroundColor: '#F8FAFC',
                                              borderLeft: '1px solid #E2E8F0',
                                              borderRight: '1px solid #E2E8F0'
                                            }}
                                          >
                                            {(() => {
                                              const rowIsKw = (pUnit === 'kW' || it.unit === 'KW' || it.uom === 'KW' || String(sec.presetName || '').toLowerCase().includes('kw'));
                                              const numCount = parseFloat(setCount) || 1;
                                              const cleanCountStr = numCount % 1 === 0 ? String(numCount) : String(numCount.toFixed(2).replace(/\.?0+$/, ''));
                                              const unitLabel = rowIsKw ? 'kW' : 'Set';
                                              return (
                                                <span style={{
                                                  display: 'inline-block',
                                                  padding: '2px 8px',
                                                  borderRadius: '6px',
                                                  fontSize: '11px',
                                                  fontWeight: '800',
                                                  backgroundColor: rowIsKw ? '#E0F2FE' : '#ECFEFF',
                                                  color: rowIsKw ? '#0284C7' : '#0E7490',
                                                  border: `1px solid ${rowIsKw ? '#BAE6FD' : '#A5F3FC'}`
                                                }}>
                                                  {cleanCountStr} {unitLabel}
                                                </span>
                                              );
                                            })()}
                                          </td>
                                        ) : null}
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
                                    <td colSpan={9} style={{ padding: '8px 14px', textAlign: 'center' }}>
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
                                  <td colSpan={9} style={{ padding: '9px 12px' }}>
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
                                  const taxRateStr = String(it.gstRate || it.gst || '18%').replace('%', '').trim();
                                  const taxRate = parseFloat(taxRateStr) || 18;
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
                                      <td style={{ padding: '7px 10px', textAlign: 'center', color: '#94A3B8', fontWeight: '700' }}>—</td>
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
                                  <td colSpan={9} style={{ padding: '7px 14px', textAlign: 'center' }}>
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
                            <td colSpan={9} style={{ padding: '16px', textAlign: 'center', color: '#94A3B8' }}>
                              No individual line items listed.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
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
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                  {isBOMConverted && linkedBomCode && (
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedPi(null);
                        window.dispatchEvent(new CustomEvent('controlroom_navigate_tab', { 
                          detail: { tab: 'Sales BOM', targetBom: linkedBomCode } 
                        }));
                        if (typeof onNavigateTab === 'function') {
                          onNavigateTab('Sales BOM');
                        }
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
                      <Layers size={13} /> View Linked BOM ({linkedBomCode}) →
                    </button>
                  )}
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <button
                    type="button"
                    onClick={() => setSelectedPi(null)}
                    style={{
                      padding: '8px 20px',
                      borderRadius: '8px',
                      border: '1px solid #CBD5E1',
                      backgroundColor: '#FFFFFF',
                      color: '#475569',
                      fontSize: '12px',
                      fontWeight: '700',
                      cursor: 'pointer'
                    }}
                  >
                    Close
                  </button>

                  {!isCeo && !isConverted && !isTechSupportLogin && pi.status !== 'Cancelled' && pi.status !== 'Draft' && (
                    <button
                      type="button"
                      onClick={() => {
                        const target = pi;
                        setSelectedPi(null);
                        handleConvertToBom(target);
                      }}
                      style={{
                        padding: '8px 18px',
                        borderRadius: '8px',
                        border: 'none',
                        backgroundColor: '#4F46E5',
                        color: '#FFFFFF',
                        fontSize: '12px',
                        fontWeight: '800',
                        cursor: 'pointer',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '6px',
                        boxShadow: '0 2px 6px rgba(79,70,229,0.3)'
                      }}
                    >
                      <Layers size={14} /> Convert to BOM →
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      {/* ==================== CUSTOM MANDATORY VALIDATION MODAL (MATCHING PO CREATION POPUP) ==================== */}
      {validationAlert && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', backgroundColor: 'rgba(15, 23, 42, 0.4)', backdropFilter: 'blur(4px)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 99999 }}>
          <div style={{ backgroundColor: 'white', borderRadius: '20px', border: '1px solid #e2e8f0', width: '460px', padding: '24px', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)', display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div style={{ width: '42px', height: '42px', borderRadius: '50%', backgroundColor: '#FEF2F2', border: '1px solid #FCA5A5', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#EF4444', flexShrink: 0 }}>
                <AlertCircle size={24} />
              </div>
              <div>
                <h3 style={{ fontSize: '16px', fontWeight: '700', color: '#0F172A', margin: 0 }}>
                  {validationAlert.title || 'Mandatory Fields Required'}
                </h3>
                <p style={{ fontSize: '12px', color: '#64748B', margin: '2px 0 0 0' }}>
                  {validationAlert.message || 'Please complete all required fields to move forward.'}
                </p>
              </div>
            </div>
            <div style={{ backgroundColor: '#F8FAFC', borderRadius: '12px', border: '1px solid #E2E8F0', padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <span style={{ fontSize: '12px', fontWeight: '600', color: '#334155' }}>
                {validationAlert.note || 'You did not fill out the following mandatory box(es):'}
              </span>
              <ul style={{ margin: 0, paddingLeft: '20px', fontSize: '12px', color: '#DC2626', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                {(validationAlert.fields || validationAlert.missingList || []).map((item, idx) => {
                  const label = typeof item === 'object' ? (item.field || item.name || item.message || JSON.stringify(item)) : item;
                  return <li key={idx}><strong>{label}</strong></li>;
                })}
              </ul>
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '4px' }}>
              <button
                onClick={() => {
                  const targetId = validationAlert.firstTargetId;
                  setValidationAlert(null);
                  if (targetId) {
                    setTimeout(() => {
                      const el = document.getElementById(targetId);
                      if (el) {
                        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                        el.focus?.();
                      }
                    }, 100);
                  }
                }}
                style={{ backgroundColor: '#EF4444', color: 'white', border: 'none', borderRadius: '10px', padding: '10px 22px', fontSize: '13px', fontWeight: '700', cursor: 'pointer', boxShadow: '0 4px 6px -1px rgba(239, 68, 68, 0.2)' }}
              >
                OK, I'll fill it
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ==================== DELETE CONFIRMATION POPUP ==================== */}
      {deleteIdx !== null && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            backgroundColor: 'rgba(15, 23, 42, 0.4)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            zIndex: 1000
          }}
        >
          {/* Main Card Frame with White Padding */}
          <div
            style={{
              backgroundColor: 'white',
              borderRadius: '24px',
              border: '1px solid #e2e8f0',
              width: '420px',
              padding: '16px',
              boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1), 0 10px 10px -5px rgba(0,0,0,0.04)',
              display: 'flex',
              flexDirection: 'column',
              gap: '14px'
            }}
          >
            {/* Embedded Red Header Pill Band: URGENT */}
            <div
              style={{
                backgroundColor: '#ff4d4d',
                color: 'white',
                fontSize: '12px',
                fontWeight: '800',
                height: '34px',
                borderRadius: '10px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                letterSpacing: '0.15em'
              }}
            >
              URGENT
            </div>

            {/* Inner box with dashed border - clean white background */}
            <div
              style={{
                padding: '16px',
                border: '1.5px dashed #cbd5e1',
                borderRadius: '16px',
                display: 'flex',
                flexDirection: 'column',
                gap: '12px',
                backgroundColor: 'white'
              }}
            >
              {/* Title & Date Row */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                <h3 style={{ fontSize: '17px', fontWeight: 'bold', color: '#1e293b', margin: 0, letterSpacing: '-0.02em' }}>
                  Delete Performa Invoice?
                </h3>
                <span style={{ fontSize: '11px', color: '#94a3b8', fontWeight: '600' }}>
                  {piList[deleteIdx].piDate}
                </span>
              </div>

              {/* Description */}
              <p style={{ fontSize: '12px', color: '#64748b', lineHeight: '1.5', margin: 0 }}>
                Are you sure you want to permanently delete Performa Invoice <strong style={{ color: '#0f172a' }}>{piList[deleteIdx].piNo}</strong> for <strong>{piList[deleteIdx].vendor}</strong>? This action cannot be undone.
              </p>

              {/* Bottom line inside dashed area: Cancel on same line as Delete PI */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: '16px', marginTop: '6px' }}>
                <button
                  onClick={() => setDeleteIdx(null)}
                  style={{
                    border: 'none',
                    backgroundColor: 'transparent',
                    color: '#64748b',
                    fontSize: '12px',
                    fontWeight: 'bold',
                    cursor: 'pointer',
                    padding: 0
                  }}
                >
                  Cancel
                </button>
                <button
                  onClick={executeDeletePI}
                  style={{
                    backgroundColor: '#fee2e2',
                    color: '#ef4444',
                    border: 'none',
                    borderRadius: '8px',
                    padding: '6px 14px',
                    fontSize: '11px',
                    fontWeight: 'bold',
                    cursor: 'pointer'
                  }}
                >
                  Delete PI
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ==================== PI CONFIRMATION MODALS (CANCEL, DRAFT, CREATE) ==================== */}
      {piConfirmModal && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            backgroundColor: 'rgba(15, 23, 42, 0.5)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            zIndex: 1000
          }}
        >
          <div
            style={{
              backgroundColor: 'white',
              borderRadius: '16px',
              border: '1px solid #E2E8F0',
              width: '440px',
              padding: '24px',
              boxShadow: '0 20px 25px -5px rgba(0,0,0,0.15)',
              display: 'flex',
              flexDirection: 'column',
              gap: '16px'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
              <div
                style={{
                  width: '40px',
                  height: '40px',
                  borderRadius: '10px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: piConfirmModal === 'cancel' ? '#FEF2F2' : (piConfirmModal === 'draft' ? '#FFFBEB' : '#ECFEFF'),
                  color: piConfirmModal === 'cancel' ? '#EF4444' : (piConfirmModal === 'draft' ? '#D97706' : '#0E7490'),
                  flexShrink: 0
                }}
              >
                {piConfirmModal === 'cancel' ? <AlertTriangle size={20} /> : <FileCheck size={20} />}
              </div>
              <div>
                <h3 style={{ fontSize: '16px', fontWeight: '800', color: '#0F172A', margin: 0 }}>
                  {piConfirmModal === 'cancel' ? 'Discard Proforma Invoice?' : (piConfirmModal === 'draft' ? 'Save as Draft?' : 'Release Proforma Invoice?')}
                </h3>
                <span style={{ fontSize: '11px', color: '#64748B' }}>
                  {piConfirmModal === 'cancel' ? 'Unsaved modifications will be permanently lost' : (piConfirmModal === 'draft' ? 'Progress will be saved in Draft state' : 'Commercial document confirmation')}
                </span>
              </div>
            </div>

            <div style={{ fontSize: '12px', color: '#475569', lineHeight: '1.6', backgroundColor: '#F8FAFC', padding: '12px', borderRadius: '8px', border: '1px solid #E2E8F0' }}>
              {piConfirmModal === 'cancel' ? (
                <span>Are you sure you want to discard this Proforma Invoice? Any configured line items, pack structures, and addresses will be erased.</span>
              ) : piConfirmModal === 'draft' ? (
                <span>Save this Proforma Invoice as a <strong>Draft</strong>. It will be stored safely and can be edited, completed, or converted at any time later.</span>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <div><strong>Company:</strong> {vendorName || 'Not specified'}</div>
                  <div><strong>PI Number:</strong> {editIdx !== null ? (piNumber || 'N/A') : 'Auto Generated'}</div>
                  <div><strong>Total Value:</strong> ₹{calculatePiTotals().grand.toLocaleString('en-IN', { minimumFractionDigits: 2 })} (incl. GST)</div>
                  <div><strong>Line Items / Scope:</strong> {piItems.length} material lines configured</div>
                </div>
              )}
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '4px' }}>
              <button
                type="button"
                onClick={() => {
                  setIsSubmittingPI(false);
                  setPiConfirmModal(null);
                }}
                style={{
                  padding: '8px 16px',
                  borderRadius: '8px',
                  backgroundColor: '#FFFFFF',
                  color: '#475569',
                  border: '1px solid #CBD5E1',
                  fontSize: '12px',
                  fontWeight: '700',
                  cursor: 'pointer',
                  opacity: 1
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isSubmittingPI}
                onClick={() => {
                  if (piConfirmModal === 'cancel') {
                    setPiConfirmModal(null);
                    resetForm();
                    setViewMode('list');
                  } else if (piConfirmModal === 'draft') {
                    executeCreatePI(true);
                  } else {
                    executeCreatePI(false);
                  }
                }}
                style={{
                  padding: '8px 18px',
                  borderRadius: '8px',
                  backgroundColor: piConfirmModal === 'cancel' ? '#EF4444' : (piConfirmModal === 'draft' ? '#0E7490' : '#10B981'),
                  color: 'white',
                  border: 'none',
                  fontSize: '12px',
                  fontWeight: '800',
                  cursor: isSubmittingPI ? 'not-allowed' : 'pointer',
                  opacity: isSubmittingPI ? 0.7 : 1,
                  boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
                }}
              >
                {isSubmittingPI
                  ? 'Generating Number & Saving...'
                  : (piConfirmModal === 'cancel' ? 'Yes, Discard' : (piConfirmModal === 'draft' ? 'Save Draft' : 'Confirm & Release PI'))}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ==================== CLEAR ALL ITEMS CONFIRMATION MODAL ==================== */}
      {showClearConfirmModal && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            backgroundColor: 'rgba(15, 23, 42, 0.5)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            zIndex: 1000
          }}
        >
          <div
            style={{
              backgroundColor: 'white',
              borderRadius: '16px',
              border: '1px solid #FECDD3',
              width: '400px',
              padding: '24px',
              boxShadow: '0 20px 25px -5px rgba(0,0,0,0.15)',
              display: 'flex',
              flexDirection: 'column',
              gap: '16px'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div style={{ width: '40px', height: '40px', borderRadius: '10px', backgroundColor: '#FFF1F2', color: '#E11D48', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Trash2 size={20} />
              </div>
              <div>
                <h3 style={{ fontSize: '15px', fontWeight: '800', color: '#0F172A', margin: 0 }}>
                  Clear All Line Items?
                </h3>
                <span style={{ fontSize: '11px', color: '#64748B' }}>This will remove all preset kits and items from the PI</span>
              </div>
            </div>

            <p style={{ fontSize: '12px', color: '#475569', margin: 0, lineHeight: '1.5' }}>
              Are you sure you want to clear all {piItems.length} item lines? This action cannot be undone.
            </p>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button
                type="button"
                onClick={() => setShowClearConfirmModal(false)}
                style={{ padding: '8px 16px', borderRadius: '8px', backgroundColor: '#FFFFFF', color: '#475569', border: '1px solid #CBD5E1', fontSize: '12px', fontWeight: '700', cursor: 'pointer' }}
              >
                Keep Items
              </button>
              <button
                type="button"
                onClick={() => {
                  setPiItems([]);
                  setPresetGroups({});
                  setShowClearConfirmModal(false);
                }}
                style={{ padding: '8px 18px', borderRadius: '8px', backgroundColor: '#E11D48', color: 'white', border: 'none', fontSize: '12px', fontWeight: '800', cursor: 'pointer' }}
              >
                Yes, Clear All
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
