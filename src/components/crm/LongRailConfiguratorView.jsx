import React, { useState, useMemo, useEffect } from 'react';
import {
  Plus, Trash2, Check, Layers, Sliders, RotateCcw, Boxes
} from 'lucide-react';
import {
  DEFAULT_LONG_RAIL_PARAMS,
  DEFAULT_LONG_RAIL_ROWS,
  getLongRailStockMap,
  calculateLongRailStructure
} from '../../utils/longRailConfigurator';
import { centralInventoryStore } from '../../utils/centralInventoryStore';
import MasterStructureProfileDropdown from './MasterStructureProfileDropdown';

const inputStyle = {
  width: '100%',
  height: '34px',
  borderRadius: '8px',
  border: '1px solid #CBD5E1',
  padding: '0 8px',
  fontSize: '12px',
  fontWeight: '700',
  color: '#0F172A',
  backgroundColor: '#FFFFFF',
  boxSizing: 'border-box',
  outline: 'none'
};

const compactNumInputStyle = {
  width: '56px',
  height: '30px',
  borderRadius: '6px',
  border: '1px solid #CBD5E1',
  padding: '0 6px',
  fontSize: '12px',
  fontWeight: '700',
  color: '#0F172A',
  textAlign: 'center',
  backgroundColor: '#FFFFFF',
  boxSizing: 'border-box',
  outline: 'none'
};

export default function LongRailConfiguratorView({
  masterStructureValue,
  onMasterStructureChange,
  onApplyToQuote,
  onClose
}) {
  const [params, setParams] = useState(DEFAULT_LONG_RAIL_PARAMS);
  const [rows, setRows] = useState([{ id: 'r1', panels: '', rows: '' }]);
  const [insertionMode, setInsertionMode] = useState('group'); // 'group' | 'itemized'
  const [showRatesEditor, setShowRatesEditor] = useState(false);
  const [stockMap, setStockMap] = useState(() => {
    try {
      return getLongRailStockMap(centralInventoryStore.getInventoryItems());
    } catch (_) {
      return { 1200: 0, 1800: 0, 2400: 0, 3600: 0, 4800: 0 };
    }
  });

  useEffect(() => {
    const refreshStock = () => {
      try {
        setStockMap(getLongRailStockMap(centralInventoryStore.getInventoryItems()));
      } catch (_) {}
    };
    window.addEventListener('central_inventory_updated', refreshStock);
    window.addEventListener('controlroom_storage_update', refreshStock);
    return () => {
      window.removeEventListener('central_inventory_updated', refreshStock);
      window.removeEventListener('controlroom_storage_update', refreshStock);
    };
  }, []);

  const calcResult = useMemo(() => calculateLongRailStructure(params, rows, stockMap), [params, rows, stockMap]);

  const updateParam = (field, rawVal) => {
    setParams(prev => ({ ...prev, [field]: rawVal === '' ? '' : Number(rawVal) }));
  };

  const updateRate = (rateKey, rawVal) => {
    setParams(prev => ({
      ...prev,
      rates: { ...prev.rates, [rateKey]: rawVal === '' ? '' : Number(rawVal) }
    }));
  };

  const updateRowField = (rowId, field, rawVal) => {
    const val = rawVal === '' ? '' : Math.max(0, parseInt(rawVal, 10) || 0);
    setRows(prev => prev.map(r => (r.id === rowId ? { ...r, [field]: val } : r)));
  };

  const handleAddRow = () => {
    const newId = `lr_${Date.now()}`;
    setRows(prev => [
      ...prev,
      { id: newId, panels: '', rows: '' }
    ]);
  };

  const handleDeleteRow = (rowId) => {
    setRows(prev => (prev.length > 1 ? prev.filter(r => r.id !== rowId) : prev));
  };

  const handleResetSample = () => {
    setParams(DEFAULT_LONG_RAIL_PARAMS);
    setRows(DEFAULT_LONG_RAIL_ROWS);
  };

  const handleApply = () => {
    if (calcResult.items.length === 0) return;

    if (insertionMode === 'group') {
      const grpId = `long_rail_${Date.now()}`;
      const grpTitle = calcResult.title;
      const finalItems = calcResult.items.map(it => ({
        name: it.name,
        category: `${calcResult.systemType} • ${it.category}`,
        specs: `${calcResult.systemType} • ${it.category}`,
        qty: String(it.qty),
        baseQty: it.qty,
        uom: 'NOS',
        unit: 'NOS',
        rate: '0',
        gstRate: '18%',
        hsn: it.hsn || '76109010',
        presetName: grpTitle,
        presetGroupId: grpId,
        isPresetItem: true,
        specDetails: {
          code: it.code,
          category: it.category,
          unitPrice: it.unitPrice
        }
      }));

      onApplyToQuote?.({
        mode: 'group',
        groupId: grpId,
        groupTitle: grpTitle,
        kitPrice: String(calcResult.subtotal),
        setCount: 1,
        items: finalItems,
        result: {
          isKit: true,
          structureType: calcResult.systemType,
          tableTitle: grpTitle,
          totalPanels: calcResult.totalPanels,
          capacityKw: calcResult.totalKw,
          quotedPrice: calcResult.subtotal,
          totalQuotedPrice: calcResult.subtotal,
          grandTotal: calcResult.grandTotal
        }
      });
    } else {
      const finalItems = calcResult.items.map(it => ({
        name: it.name,
        category: `${calcResult.systemType} • ${it.category}`,
        specs: `${calcResult.systemType} • ${it.category}`,
        qty: String(it.qty),
        baseQty: it.qty,
        uom: 'NOS',
        unit: 'NOS',
        rate: String(it.unitPrice),
        gstRate: '18%',
        hsn: it.hsn || '76109010',
        isPresetItem: false,
        presetGroupId: null
      }));

      onApplyToQuote?.({
        mode: 'itemized',
        groupId: null,
        groupTitle: calcResult.title,
        kitPrice: null,
        setCount: 1,
        items: finalItems,
        result: {
          isKit: true,
          structureType: calcResult.systemType,
          tableTitle: calcResult.title,
          totalPanels: calcResult.totalPanels,
          capacityKw: calcResult.totalKw,
          quotedPrice: calcResult.subtotal,
          totalQuotedPrice: calcResult.subtotal,
          grandTotal: calcResult.grandTotal
        }
      });
    }

    onClose?.();
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', padding: '20px 24px', flex: 1, minHeight: 0, overflowY: 'auto' }}>
      {/* Top Row: Master Structure Selector + Quick KPIs */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1.8fr', gap: '16px', alignItems: 'stretch', flexShrink: 0 }}>
        <MasterStructureProfileDropdown
          value={masterStructureValue}
          onChange={onMasterStructureChange}
          activeBadge="Double C Rail 45mm"
        />

        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(4, 1fr)',
          gap: '10px',
          backgroundColor: '#F8FAFC',
          border: '1px solid #E2E8F0',
          borderRadius: '12px',
          padding: '12px 16px',
          alignItems: 'center'
        }}>
          <div>
            <div style={{ fontSize: '10px', fontWeight: '700', color: '#64748B', textTransform: 'uppercase' }}>Panels / Rows</div>
            <div style={{ fontSize: '16px', fontWeight: '900', color: '#0F172A' }}>{calcResult.totalPanels} / {calcResult.totalRows}</div>
          </div>
          <div>
            <div style={{ fontSize: '10px', fontWeight: '700', color: '#64748B', textTransform: 'uppercase' }}>Total Capacity</div>
            <div style={{ fontSize: '16px', fontWeight: '900', color: '#0E7490' }}>{calcResult.totalKw} kW</div>
          </div>
          <div>
            <div style={{ fontSize: '10px', fontWeight: '700', color: '#64748B', textTransform: 'uppercase' }}>Total Rail Length</div>
            <div style={{ fontSize: '16px', fontWeight: '900', color: '#1E293B' }}>{calcResult.totalMeters} m</div>
          </div>
          <div>
            <div style={{ fontSize: '10px', fontWeight: '700', color: '#64748B', textTransform: 'uppercase' }}>Rate / kW (Ex-Tax)</div>
            <div style={{ fontSize: '16px', fontWeight: '900', color: '#059669' }}>₹ {calcResult.perKwRate.toLocaleString('en-IN')}/kW</div>
          </div>
        </div>
      </div>

      {/* Global Parameters */}
      <div style={{ backgroundColor: '#FFFFFF', borderRadius: '12px', border: '1px solid #E2E8F0', padding: '14px 16px', flexShrink: 0 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Sliders size={14} color="#0E7490" />
            <span style={{ fontSize: '12px', fontWeight: '800', color: '#0F172A', textTransform: 'uppercase' }}>
              2. Global Array & Rail Pricing Parameters
            </span>
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              type="button"
              onClick={() => setShowRatesEditor(v => !v)}
              style={{
                border: '1px solid #CBD5E1',
                backgroundColor: showRatesEditor ? '#ECFEFF' : '#F8FAFC',
                color: '#0E7490',
                padding: '4px 10px',
                borderRadius: '8px',
                fontSize: '11px',
                fontWeight: '700',
                cursor: 'pointer'
              }}
            >
              {showRatesEditor ? 'Hide Accessory Rates' : 'Edit Accessory Rates'}
            </button>
            <button
              type="button"
              onClick={handleResetSample}
              style={{
                border: '1px solid #CBD5E1',
                backgroundColor: '#F8FAFC',
                color: '#475569',
                padding: '4px 10px',
                borderRadius: '8px',
                fontSize: '11px',
                fontWeight: '700',
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px'
              }}
            >
              <RotateCcw size={12} /> Reset Defaults
            </button>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: '10px' }}>
          <div>
            <label style={{ display: 'block', fontSize: '10.5px', fontWeight: '700', color: '#64748B', marginBottom: '4px' }}>Panel Width (mm)</label>
            <input type="number" value={params.panelWidth} onChange={e => updateParam('panelWidth', e.target.value)} style={inputStyle} />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: '10.5px', fontWeight: '700', color: '#64748B', marginBottom: '4px' }}>Clearance (mm)</label>
            <input type="number" value={params.clearance} onChange={e => updateParam('clearance', e.target.value)} style={inputStyle} />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: '10.5px', fontWeight: '700', color: '#64748B', marginBottom: '4px' }}>Pnl to Pnl (mm)</label>
            <input type="number" value={params.pnlToPnl} onChange={e => updateParam('pnlToPnl', e.target.value)} style={inputStyle} />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: '10.5px', fontWeight: '700', color: '#64748B', marginBottom: '4px' }}>No. of Rails</label>
            <select value={params.noOfRails} onChange={e => updateParam('noOfRails', e.target.value)} style={inputStyle}>
              <option value={2}>2 Rails</option>
              <option value={3}>3 Rails</option>
            </select>
          </div>
          <div>
            <label style={{ display: 'block', fontSize: '10.5px', fontWeight: '700', color: '#64748B', marginBottom: '4px' }}>Panel Wp</label>
            <input type="number" value={params.panelWp} onChange={e => updateParam('panelWp', e.target.value)} style={inputStyle} />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: '10.5px', fontWeight: '700', color: '#64748B', marginBottom: '4px' }}>Rail Cost (₹/m)</label>
            <input type="number" value={params.railCostPerMtr} onChange={e => updateParam('railCostPerMtr', e.target.value)} style={inputStyle} />
          </div>
        </div>

        {showRatesEditor && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '8px', marginTop: '12px', paddingTop: '12px', borderTop: '1px dashed #E2E8F0' }}>
            {[
              ['lAngle', 'L Angle (₹)'],
              ['hexaBoltLAngle', 'Hexa Bolt L-Angle (₹)'],
              ['endClamp', 'End Clamp (₹)'],
              ['midClamp', 'Mid Clamp (₹)'],
              ['allenBolt', 'Allen Bolt (₹)'],
              ['tNut', 'T Nut (₹)'],
              ['epdmWasher', 'EPDM Washer (₹)'],
              ['selfTappingScrew', 'Self Tap Screw (₹)'],
              ['joinerPlate', 'Joiner Plate (₹)'],
              ['hexaBoltJoiner', 'Hexa Bolt Joiner (₹)']
            ].map(([k, lbl]) => (
              <div key={k}>
                <label style={{ display: 'block', fontSize: '10px', fontWeight: '700', color: '#64748B', marginBottom: '3px' }}>{lbl}</label>
                <input type="number" step="0.5" value={params.rates[k]} onChange={e => updateRate(k, e.target.value)} style={inputStyle} />
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Row-by-Row Rail Cut Matrix */}
      <div style={{ backgroundColor: '#FFFFFF', borderRadius: '12px', border: '1px solid #E2E8F0', overflow: 'hidden', flexShrink: 0 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', borderBottom: '1px solid #F1F5F9', backgroundColor: '#F8FAFC', flexWrap: 'wrap', gap: '8px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            <Layers size={14} color="#0E7490" />
            <span style={{ fontSize: '12px', fontWeight: '800', color: '#0F172A', textTransform: 'uppercase' }}>
              3. Row Layout &amp; Standard Rail Cut Breakdown (mm)
            </span>
            <span style={{ fontSize: '10.5px', fontWeight: '700', backgroundColor: '#ECFEFF', color: '#0E7490', padding: '2px 8px', borderRadius: '999px', border: '1px solid #A5F3FC' }}>
              Auto-fitted from Live Stock
            </span>
            {calcResult.hasStockShortage && (
              <span style={{ fontSize: '10.5px', fontWeight: '700', backgroundColor: '#FEF2F2', color: '#DC2626', padding: '2px 8px', borderRadius: '999px', border: '1px solid #FECACA' }}>
                Insufficient Stock for some rows
              </span>
            )}
          </div>
          <button
            type="button"
            onClick={handleAddRow}
            style={{
              border: 'none',
              backgroundColor: '#0E7490',
              color: '#FFFFFF',
              padding: '6px 12px',
              borderRadius: '8px',
              fontSize: '11.5px',
              fontWeight: '700',
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '5px'
            }}
          >
            <Plus size={13} /> Add Row
          </button>
        </div>

        <div style={{ maxHeight: '260px', overflowY: 'auto', overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
            <thead style={{ position: 'sticky', top: 0, zIndex: 1 }}>
              <tr style={{ backgroundColor: '#F1F5F9', color: '#475569', textAlign: 'center', borderBottom: '1px solid #E2E8F0' }}>
                <th style={{ padding: '8px' }}>Panels</th>
                <th style={{ padding: '8px' }}>Rows</th>
                <th style={{ padding: '8px' }}>Req. Length</th>
                {[1200, 1800, 2400, 3600, 4800].map(len => (
                  <th key={len} style={{ padding: '8px' }}>
                    <div>{len} mm</div>
                    <div style={{ fontSize: '10px', fontWeight: '700', color: (stockMap[len] || 0) > 0 ? '#059669' : '#DC2626' }}>
                      Stock: {stockMap[len] || 0}
                    </div>
                  </th>
                ))}
                <th style={{ padding: '8px' }}>Prop. Length</th>
                <th style={{ padding: '8px' }}>Extra</th>
                <th style={{ padding: '8px' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {calcResult.computedRows.map((row, idx) => {
                const rawRow = rows[idx] || row;
                return (
                <tr key={row.id} style={{ borderBottom: '1px solid #F1F5F9', textAlign: 'center', backgroundColor: row.stockShortage ? '#FFFBEB' : 'transparent' }}>
                  <td style={{ padding: '6px' }}>
                    <input type="number" min="1" placeholder="0" value={rawRow.panels} onChange={e => updateRowField(row.id, 'panels', e.target.value)} style={compactNumInputStyle} />
                  </td>
                  <td style={{ padding: '6px' }}>
                    <input type="number" min="1" placeholder="0" value={rawRow.rows} onChange={e => updateRowField(row.id, 'rows', e.target.value)} style={compactNumInputStyle} />
                  </td>
                  <td style={{ padding: '6px', fontWeight: '700', color: '#0F172A' }}>{row.requiredLength}</td>
                  {[1200, 1800, 2400, 3600, 4800].map(len => (
                    <td key={len} style={{ padding: '6px', fontWeight: '800', color: row.pieces[len] > 0 ? '#0E7490' : '#94A3B8' }}>
                      {row.pieces[len]}
                    </td>
                  ))}
                  <td style={{ padding: '6px', fontWeight: '700', color: '#0E7490' }}>{row.proposedLength}</td>
                  <td style={{ padding: '6px', fontWeight: '800', color: row.extraLength < 0 ? '#DC2626' : '#059669' }}>
                    {row.extraLength >= 0 ? `+${row.extraLength}` : row.extraLength}
                  </td>
                  <td style={{ padding: '6px' }}>
                    <div style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                      {row.stockShortage && (
                        <span title="Available stock is not enough for this row; showing standard fit" style={{ fontSize: '10px', fontWeight: '800', color: '#B45309', backgroundColor: '#FEF3C7', padding: '2px 5px', borderRadius: '4px' }}>
                          Low Stock
                        </span>
                      )}
                      <button
                        type="button"
                        onClick={() => handleDeleteRow(row.id)}
                        disabled={rows.length <= 1}
                        title="Remove row"
                        style={{ border: '1px solid #FECACA', backgroundColor: '#FEF2F2', color: '#DC2626', borderRadius: '6px', padding: '4px 6px', cursor: rows.length <= 1 ? 'not-allowed' : 'pointer', opacity: rows.length <= 1 ? 0.4 : 1 }}
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                  </td>
                </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr style={{ backgroundColor: '#ECFEFF', fontWeight: '800', color: '#0E7490', textAlign: 'center', borderTop: '1px solid #A5F3FC' }}>
                <td colSpan={3} style={{ padding: '8px', textAlign: 'right' }}>Total Rail Pieces (× {params.noOfRails} Rails):</td>
                <td style={{ padding: '8px' }}>{calcResult.railTotals[1200]}</td>
                <td style={{ padding: '8px' }}>{calcResult.railTotals[1800]}</td>
                <td style={{ padding: '8px' }}>{calcResult.railTotals[2400]}</td>
                <td style={{ padding: '8px' }}>{calcResult.railTotals[3600]}</td>
                <td style={{ padding: '8px' }}>{calcResult.railTotals[4800]}</td>
                <td colSpan={3} style={{ padding: '8px' }}>{calcResult.totalMeters} Total Meters</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      {/* Double C Rail with L Bracket BOM Table */}
      <div style={{ backgroundColor: '#FFFFFF', borderRadius: '12px', border: '1px solid #E2E8F0', overflow: 'hidden', flexShrink: 0 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', borderBottom: '1px solid #F1F5F9', backgroundColor: '#F8FAFC' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Boxes size={14} color="#0E7490" />
            <span style={{ fontSize: '12px', fontWeight: '800', color: '#0F172A', textTransform: 'uppercase' }}>
              4. Double C Rail with L Bracket — Generated BOM ({calcResult.items.length} Line Items)
            </span>
          </div>
          <div style={{ fontSize: '12px', fontWeight: '800', color: '#0F172A' }}>
            Subtotal: <span style={{ color: '#0E7490' }}>₹ {calcResult.subtotal.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
            {' '}| Tax (18%): <span>₹ {calcResult.gstAmount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
            {' '}| Grand Total: <span style={{ color: '#059669' }}>₹ {calcResult.grandTotal.toLocaleString('en-IN')}</span>
          </div>
        </div>

        <div style={{ maxHeight: '240px', overflowY: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
            <thead>
              <tr style={{ backgroundColor: '#F8FAFC', color: '#64748B', textAlign: 'left', borderBottom: '1px solid #E2E8F0' }}>
                <th style={{ padding: '8px 14px' }}>Description</th>
                <th style={{ padding: '8px 14px' }}>Category</th>
                <th style={{ padding: '8px 14px', textAlign: 'right' }}>Quantity</th>
                <th style={{ padding: '8px 14px', textAlign: 'right' }}>Unit Price (₹)</th>
                <th style={{ padding: '8px 14px', textAlign: 'right' }}>Total (₹)</th>
              </tr>
            </thead>
            <tbody>
              {calcResult.items.map((it) => (
                <tr key={it.code} style={{ borderBottom: '1px solid #F1F5F9' }}>
                  <td style={{ padding: '7px 14px', fontWeight: '700', color: '#0F172A' }}>{it.name}</td>
                  <td style={{ padding: '7px 14px', color: '#64748B' }}>{it.category}</td>
                  <td style={{ padding: '7px 14px', textAlign: 'right', fontWeight: '700' }}>{it.qty}</td>
                  <td style={{ padding: '7px 14px', textAlign: 'right' }}>{it.unitPrice.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                  <td style={{ padding: '7px 14px', textAlign: 'right', fontWeight: '800', color: '#0E7490' }}>
                    {it.total.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Footer Actions */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px', paddingTop: '4px', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '12px', fontWeight: '700', color: '#475569' }}>Insert into Quotation as:</span>
          <button
            type="button"
            onClick={() => setInsertionMode('group')}
            style={{
              border: insertionMode === 'group' ? '1.5px solid #0E7490' : '1px solid #CBD5E1',
              backgroundColor: insertionMode === 'group' ? '#ECFEFF' : '#FFFFFF',
              color: insertionMode === 'group' ? '#0E7490' : '#475569',
              padding: '6px 12px',
              borderRadius: '8px',
              fontSize: '12px',
              fontWeight: '700',
              cursor: 'pointer'
            }}
          >
            Preset Kit (Grouped)
          </button>
          <button
            type="button"
            onClick={() => setInsertionMode('itemized')}
            style={{
              border: insertionMode === 'itemized' ? '1.5px solid #0E7490' : '1px solid #CBD5E1',
              backgroundColor: insertionMode === 'itemized' ? '#ECFEFF' : '#FFFFFF',
              color: insertionMode === 'itemized' ? '#0E7490' : '#475569',
              padding: '6px 12px',
              borderRadius: '8px',
              fontSize: '12px',
              fontWeight: '700',
              cursor: 'pointer'
            }}
          >
            Individual Line Items
          </button>
        </div>

        <div style={{ display: 'flex', gap: '10px' }}>
          <button
            type="button"
            onClick={onClose}
            style={{ border: '1px solid #CBD5E1', backgroundColor: '#FFFFFF', color: '#475569', padding: '10px 18px', borderRadius: '10px', fontSize: '13px', fontWeight: '700', cursor: 'pointer' }}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleApply}
            disabled={calcResult.items.length === 0}
            style={{
              border: 'none',
              background: 'linear-gradient(135deg, #075985 0%, #0E7490 100%)',
              color: '#FFFFFF',
              padding: '10px 22px',
              borderRadius: '10px',
              fontSize: '13px',
              fontWeight: '800',
              cursor: calcResult.items.length === 0 ? 'not-allowed' : 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '7px',
              boxShadow: '0 2px 8px rgba(14, 116, 144, 0.35)'
            }}
          >
            <Check size={16} />
            Apply Long Rail BOM to Quotation (₹ {calcResult.subtotal.toLocaleString('en-IN')})
          </button>
        </div>
      </div>
    </div>
  );
}
