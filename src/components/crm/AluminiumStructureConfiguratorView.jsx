import React, { useState, useMemo } from 'react';
import {
  Sliders, RefreshCw, Check, Layers, ShieldCheck,
  Boxes, Sun, LayoutGrid, CheckSquare, Square, Info
} from 'lucide-react';
import {
  DEFAULT_NALCO_PRICE,
  ALUMINIUM_CATALOG,
  calculateAluminiumStructure
} from '../../utils/aluminiumStructureConfigurator';

/**
 * 2D Interactive Solar Rooftop Schematic for Mini Rail / Standing Seam
 */
function AluminiumSchematicView({
  selectedRailDef,
  fixingModel,
  totalPanels,
  totalRows,
  panelWp,
  totalKw,
  railCountPerPanel
}) {
  const isStandingSeam = selectedRailDef.category === 'Standing Seam';

  return (
    <div style={{
      backgroundColor: '#0F172A',
      borderRadius: '14px',
      padding: '20px',
      color: '#FFFFFF',
      display: 'flex',
      flexDirection: 'column',
      gap: '16px',
      border: '1px solid #1E293B',
      boxShadow: 'inset 0 2px 8px rgba(0,0,0,0.4)'
    }}>
      {/* Schematic Header Info */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{
            backgroundColor: isStandingSeam ? '#0E7490' : '#4F46E5',
            color: '#FFFFFF',
            fontSize: '11px',
            fontWeight: '800',
            padding: '3px 8px',
            borderRadius: '6px'
          }}>
            {isStandingSeam ? 'STANDING SEAM' : 'MINI RAIL'}
          </span>
          <span style={{ fontSize: '13px', fontWeight: '800', color: '#F8FAFC' }}>
            {selectedRailDef.name}
          </span>
        </div>
        <div style={{ display: 'flex', gap: '12px', fontSize: '11px', color: '#94A3B8' }}>
          <div>Fixing: <strong style={{ color: '#38BDF8' }}>{fixingModel}</strong></div>
          <div>Panels: <strong style={{ color: '#38BDF8' }}>{totalPanels} ({totalRows} Row{totalRows > 1 ? 's' : ''})</strong></div>
          <div>Capacity: <strong style={{ color: '#38BDF8' }}>{totalKw} kW</strong></div>
        </div>
      </div>

      {/* SVG Elevation Drawing */}
      <div style={{ backgroundColor: '#1E293B', borderRadius: '10px', padding: '14px', overflow: 'hidden' }}>
        <svg viewBox="0 0 680 180" style={{ width: '100%', height: 'auto', display: 'block' }}>
          <defs>
            <linearGradient id="panelGrad" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#1E3A8A" />
              <stop offset="100%" stopColor="#0F172A" />
            </linearGradient>
            <linearGradient id="railGrad" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#94A3B8" />
              <stop offset="50%" stopColor="#E2E8F0" />
              <stop offset="100%" stopColor="#64748B" />
            </linearGradient>
            <linearGradient id="sheetGrad" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#475569" />
              <stop offset="100%" stopColor="#334155" />
            </linearGradient>
          </defs>

          {/* Metal Sheet Roof Profile */}
          <path
            d="M 20 150 L 80 150 L 95 130 L 125 130 L 140 150 L 220 150 L 235 130 L 265 130 L 280 150 L 360 150 L 375 130 L 405 130 L 420 150 L 500 150 L 515 130 L 545 130 L 560 150 L 660 150"
            fill="none"
            stroke="#64748B"
            strokeWidth="3.5"
          />
          <text x="30" y="168" fill="#64748B" fontSize="10" fontFamily="sans-serif">Metal Roof Deck Profile</text>

          {/* Rail 1 */}
          <rect x="98" y="90" width="24" height="40" rx="2" fill="url(#railGrad)" stroke="#475569" strokeWidth="1" />
          {/* Rail 2 */}
          <rect x="238" y="90" width="24" height="40" rx="2" fill="url(#railGrad)" stroke="#475569" strokeWidth="1" />
          {/* Rail 3 */}
          <rect x="378" y="90" width="24" height="40" rx="2" fill="url(#railGrad)" stroke="#475569" strokeWidth="1" />
          {/* Rail 4 */}
          <rect x="518" y="90" width="24" height="40" rx="2" fill="url(#railGrad)" stroke="#475569" strokeWidth="1" />

          {/* Solar Panel 1 */}
          <rect x="102" y="70" width="144" height="18" rx="2" fill="url(#panelGrad)" stroke="#38BDF8" strokeWidth="1.5" />
          <text x="135" y="83" fill="#BAE6FD" fontSize="9" fontWeight="700" fontFamily="sans-serif">Panel 1 ({panelWp}W)</text>

          {/* Solar Panel 2 */}
          <rect x="242" y="70" width="144" height="18" rx="2" fill="url(#panelGrad)" stroke="#38BDF8" strokeWidth="1.5" />
          <text x="275" y="83" fill="#BAE6FD" fontSize="9" fontWeight="700" fontFamily="sans-serif">Panel 2 ({panelWp}W)</text>

          {/* Solar Panel 3 */}
          <rect x="382" y="70" width="144" height="18" rx="2" fill="url(#panelGrad)" stroke="#38BDF8" strokeWidth="1.5" />
          <text x="415" y="83" fill="#BAE6FD" fontSize="9" fontWeight="700" fontFamily="sans-serif">Panel 3 ({panelWp}W)</text>

          {/* End Clamp Left */}
          <polygon points="98,62 108,62 108,72 102,72 102,88 98,88" fill="#F59E0B" stroke="#B45309" strokeWidth="0.8" />
          <text x="75" y="55" fill="#FBBF24" fontSize="8.5" fontWeight="700" fontFamily="sans-serif">End Clamp</text>

          {/* Mid Clamp 1 */}
          <polygon points="242,62 250,62 250,72 242,72" fill="#10B981" stroke="#047857" strokeWidth="0.8" />
          <polygon points="238,62 246,62 246,72 238,72" fill="#10B981" stroke="#047857" strokeWidth="0.8" />
          <text x="228" y="55" fill="#34D399" fontSize="8.5" fontWeight="700" fontFamily="sans-serif">Mid Clamp</text>

          {/* Mid Clamp 2 */}
          <polygon points="382,62 390,62 390,72 382,72" fill="#10B981" stroke="#047857" strokeWidth="0.8" />
          <polygon points="378,62 386,62 386,72 378,72" fill="#10B981" stroke="#047857" strokeWidth="0.8" />

          {/* End Clamp Right */}
          <polygon points="536,62 546,62 546,88 542,88 542,72 536,72" fill="#F59E0B" stroke="#B45309" strokeWidth="0.8" />
          <text x="532" y="55" fill="#FBBF24" fontSize="8.5" fontWeight="700" fontFamily="sans-serif">End Clamp</text>

          {/* Fastener Annotation */}
          {isStandingSeam ? (
            <text x="240" y="145" fill="#A78BFA" fontSize="8.5" fontFamily="sans-serif">Grub Screw Fixing</text>
          ) : (
            <text x="235" y="145" fill="#A78BFA" fontSize="8.5" fontFamily="sans-serif">Riveting + EPDM Sheet</text>
          )}
        </svg>
      </div>

      {/* Top Layout Grid Mini-Preview */}
      <div>
        <div style={{ fontSize: '11px', fontWeight: '700', color: '#94A3B8', marginBottom: '8px', textTransform: 'uppercase' }}>
          Top Grid Arrangement ({totalRows} Row{totalRows > 1 ? 's' : ''} × {Math.round(totalPanels / totalRows)} Panels per Row)
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          {Array.from({ length: Math.min(totalRows, 4) }).map((_, rIdx) => {
            const panelsInRow = Math.min(Math.round(totalPanels / totalRows), 12);
            return (
              <div key={rIdx} style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                <span style={{ fontSize: '9px', color: '#64748B', width: '42px' }}>R{rIdx + 1}:</span>
                {Array.from({ length: panelsInRow }).map((_, pIdx) => (
                  <div
                    key={pIdx}
                    style={{
                      flex: 1,
                      height: '24px',
                      backgroundColor: '#1E3A8A',
                      border: '1px solid #38BDF8',
                      borderRadius: '3px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '8px',
                      color: '#BAE6FD',
                      fontWeight: '700'
                    }}
                  >
                    P{pIdx + 1}
                  </div>
                ))}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export default function AluminiumStructureConfiguratorView({
  onApplyToQuote,
  onClose
}) {
  // 1. Master Configuration Inputs
  const [selectedRailId, setSelectedRailId] = useState('ssr_100');
  const [fixingModel, setFixingModel] = useState('Standing Seam'); // 'Standing Seam' | 'Riviting' | 'Adhesive'
  const [panels, setPanels] = useState(4);
  const [rows, setRows] = useState(1);
  const [panelWp, setPanelWp] = useState(625);
  const [railCountPerPanel, setRailCountPerPanel] = useState(2);
  const [grubScrewsPerRail, setGrubScrewsPerRail] = useState(2);
  const [setCount, setSetCount] = useState(1);

  // 2. Pricing & Master Commodity Rates Drawer
  const [showRatesDrawer, setShowRatesDrawer] = useState(false);
  const [nalcoPrice, setNalcoPrice] = useState(DEFAULT_NALCO_PRICE);
  const [marginPct, setMarginPct] = useState(30);

  // 3. Tab for Preview ('schematic' | 'bom')
  const [activeTab, setActiveTab] = useState('schematic');
  const [bomSearch, setBomSearch] = useState('');

  // Selected Rail Object
  const selectedRailDef = useMemo(() => {
    return ALUMINIUM_CATALOG.find(x => x.id === selectedRailId) || ALUMINIUM_CATALOG[0];
  }, [selectedRailId]);

  // Update fixing model automatically when rail category changes
  const handleRailChange = (railId) => {
    setSelectedRailId(railId);
    const def = ALUMINIUM_CATALOG.find(x => x.id === railId);
    if (def?.category === 'Standing Seam') {
      setFixingModel('Standing Seam');
    } else if (fixingModel === 'Standing Seam') {
      setFixingModel('Riviting');
    }
  };

  // 4. Live Calculation Engine (100% Excel Parity)
  const calcResult = useMemo(() => {
    const marginMultiplier = 1 + ((parseFloat(marginPct) || 30) / 100);
    return calculateAluminiumStructure({
      rowsConfig: [{ panels: parseFloat(panels) || 1, rows: parseFloat(rows) || 1 }],
      panelWp: parseFloat(panelWp) || 625,
      selectedRailId,
      fixingModel,
      railCountPerPanel: parseFloat(railCountPerPanel) || 2,
      grubScrewsPerRail: parseFloat(grubScrewsPerRail) || 2,
      nalcoPrice: parseFloat(nalcoPrice) || DEFAULT_NALCO_PRICE,
      margin: marginMultiplier
    });
  }, [panels, rows, panelWp, selectedRailId, fixingModel, railCountPerPanel, grubScrewsPerRail, nalcoPrice, marginPct]);

  // Filtered BOM
  const filteredBom = useMemo(() => {
    if (!bomSearch.trim()) return calcResult.items;
    const q = bomSearch.toLowerCase();
    return calcResult.items.filter(it => it.name.toLowerCase().includes(q) || it.category.toLowerCase().includes(q));
  }, [calcResult.items, bomSearch]);

  // Multiply by Set Count
  const totalQuotedAmount = parseFloat((calcResult.totalAmount * setCount).toFixed(2));
  const totalQuotedPanels = calcResult.totalPanels * setCount;
  const totalQuotedKw = parseFloat((calcResult.totalKw * setCount).toFixed(3));

  // 5. Handle Apply to Quotation
  const handleApply = () => {
    const finalItems = calcResult.items.map(it => {
      const multQty = it.qty * setCount;
      return {
        name: it.name,
        specs: `${calcResult.systemType} • ${it.category}`,
        qty: String(multQty),
        baseQty: multQty,
        uom: 'NOS',
        unit: 'NOS',
        rate: '0',
        gstRate: '18%',
        hsn: it.hsn || '76109010',
        presetName: calcResult.title,
        presetGroupId: `ALU-MMS-${Date.now()}`,
        isPresetItem: true
      };
    });

    const groupId = `ALU-MMS-${Date.now()}`;
    const groupTitle = calcResult.title;

    onApplyToQuote?.({
      mode: 'group',
      groupId,
      groupTitle,
      kitPrice: String(calcResult.totalAmount),
      setCount,
      items: finalItems,
      result: {
        structureType: calcResult.systemType,
        tableTitle: calcResult.title,
        totalPanels: totalQuotedPanels,
        totalKw: totalQuotedKw,
        quotedPrice: calcResult.totalAmount,
        totalQuotedPrice: totalQuotedAmount
      }
    });

    onClose?.();
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
      {/* 1. Commodity Rate Drawer */}
      {showRatesDrawer && (
        <div style={{
          backgroundColor: '#FFFFFF',
          borderBottom: '2px solid #E2E8F0',
          padding: '14px 28px',
          display: 'flex',
          flexDirection: 'column',
          gap: '10px',
          flexShrink: 0
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '13px', fontWeight: '800', color: '#0F172A' }}>
                Commodity & Margin Settings (NALCO Benchmark)
              </span>
              <span style={{ fontSize: '11px', color: '#64748B' }}>
                Governs raw aluminium piece cost and margins
              </span>
            </div>
            <button
              onClick={() => {
                setNalcoPrice(DEFAULT_NALCO_PRICE);
                setMarginPct(30);
              }}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '5px',
                background: 'transparent',
                border: 'none',
                color: '#0E7490',
                fontSize: '11.5px',
                fontWeight: '700',
                cursor: 'pointer'
              }}
            >
              <RefreshCw size={12} /> Reset to Defaults
            </button>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '14px' }}>
            {/* NALCO Rate */}
            <div style={{
              backgroundColor: '#F8FAFC',
              border: '1px solid #CBD5E1',
              borderRadius: '8px',
              padding: '8px 12px'
            }}>
              <label style={{ fontSize: '11px', fontWeight: '700', color: '#475569', display: 'block' }}>
                NALCO Aluminium Rate (₹/kg)
              </label>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '4px' }}>
                <span style={{ fontWeight: '800', color: '#64748B' }}>₹</span>
                <input
                  type="number"
                  value={nalcoPrice}
                  onChange={(e) => setNalcoPrice(parseFloat(e.target.value) || 0)}
                  style={{
                    width: '100%',
                    border: 'none',
                    background: 'transparent',
                    fontSize: '14px',
                    fontWeight: '800',
                    color: '#0F172A',
                    outline: 'none'
                  }}
                />
              </div>
            </div>

            {/* Margin % */}
            <div style={{
              backgroundColor: '#F8FAFC',
              border: '1px solid #CBD5E1',
              borderRadius: '8px',
              padding: '8px 12px'
            }}>
              <label style={{ fontSize: '11px', fontWeight: '700', color: '#475569', display: 'block' }}>
                Margin Markup (%)
              </label>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '4px' }}>
                <input
                  type="number"
                  value={marginPct}
                  onChange={(e) => setMarginPct(parseFloat(e.target.value) || 0)}
                  style={{
                    width: '100%',
                    border: 'none',
                    background: 'transparent',
                    fontSize: '14px',
                    fontWeight: '800',
                    color: '#0F172A',
                    outline: 'none'
                  }}
                />
                <span style={{ fontWeight: '800', color: '#64748B' }}>%</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 2. Main Two-Column Layout */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: '430px 1fr',
        gap: '0',
        flex: 1,
        minHeight: 0,
        overflow: 'hidden'
      }}>
        {/* LEFT COLUMN: Controls & Sizing */}
        <div style={{
          backgroundColor: '#FFFFFF',
          borderRight: '1px solid #E2E8F0',
          padding: '20px 24px',
          overflowY: 'auto',
          display: 'flex',
          flexDirection: 'column',
          gap: '18px'
        }}>
          {/* Quick Rates Bar Toggle */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '11px', fontWeight: '800', color: '#0E7490', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              System Parameters
            </span>
            <button
              onClick={() => setShowRatesDrawer(!showRatesDrawer)}
              style={{
                background: showRatesDrawer ? '#ECFEFF' : '#F8FAFC',
                color: showRatesDrawer ? '#0E7490' : '#475569',
                border: '1px solid #CBD5E1',
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
              <Sliders size={12} />
              <span>NALCO Price (₹{nalcoPrice}/kg)</span>
            </button>
          </div>

          {/* Rail Selection */}
          <div>
            <label style={{ fontSize: '12px', fontWeight: '800', color: '#0F172A', marginBottom: '8px', display: 'block' }}>
              1. Select Rail Profile & Length
            </label>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {/* Standing Seam Category */}
              <div style={{ fontSize: '10.5px', fontWeight: '800', color: '#64748B', marginTop: '2px', textTransform: 'uppercase' }}>
                Standing Seam Clamps / Rails
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '6px' }}>
                {ALUMINIUM_CATALOG.filter(x => x.category === 'Standing Seam').map(r => {
                  const isSel = r.id === selectedRailId;
                  return (
                    <button
                      key={r.id}
                      onClick={() => handleRailChange(r.id)}
                      style={{
                        padding: '8px 6px',
                        backgroundColor: isSel ? '#ECFEFF' : '#F8FAFC',
                        border: isSel ? '2px solid #0E7490' : '1px solid #E2E8F0',
                        borderRadius: '8px',
                        cursor: 'pointer',
                        textAlign: 'center',
                        transition: 'all 0.15s ease'
                      }}
                    >
                      <div style={{ fontSize: '12px', fontWeight: '800', color: isSel ? '#0E7490' : '#0F172A' }}>
                        {r.length} mm
                      </div>
                      <div style={{ fontSize: '9.5px', color: '#64748B', marginTop: '2px' }}>
                        {r.weight}g
                      </div>
                    </button>
                  );
                })}
              </div>

              {/* Mini Rails Category */}
              <div style={{ fontSize: '10.5px', fontWeight: '800', color: '#64748B', marginTop: '8px', textTransform: 'uppercase' }}>
                Mini Rails (Sheet Rooftop)
              </div>
              <select
                value={selectedRailId}
                onChange={(e) => handleRailChange(e.target.value)}
                style={{
                  width: '100%',
                  padding: '9px 12px',
                  borderRadius: '8px',
                  border: '1px solid #CBD5E1',
                  backgroundColor: '#FFFFFF',
                  fontSize: '12.5px',
                  fontWeight: '700',
                  color: '#0F172A',
                  outline: 'none'
                }}
              >
                <optgroup label="125 mm Height Mini Rails">
                  {ALUMINIUM_CATALOG.filter(x => x.height === 125).map(r => (
                    <option key={r.id} value={r.id}>{r.name} ({r.weight}g)</option>
                  ))}
                </optgroup>
                <optgroup label="100 mm Height Mini Rails">
                  {ALUMINIUM_CATALOG.filter(x => x.height === 100).map(r => (
                    <option key={r.id} value={r.id}>{r.name} ({r.weight}g)</option>
                  ))}
                </optgroup>
                <optgroup label="75 mm Height Mini Rails">
                  {ALUMINIUM_CATALOG.filter(x => x.height === 75).map(r => (
                    <option key={r.id} value={r.id}>{r.name} ({r.weight}g)</option>
                  ))}
                </optgroup>
                <optgroup label="120 mm Height Mini Rails">
                  {ALUMINIUM_CATALOG.filter(x => x.height === 120).map(r => (
                    <option key={r.id} value={r.id}>{r.name} ({r.weight}g)</option>
                  ))}
                </optgroup>
              </select>
            </div>
          </div>

          {/* Fixing Model */}
          <div>
            <label style={{ fontSize: '12px', fontWeight: '800', color: '#0F172A', marginBottom: '8px', display: 'block' }}>
              2. Fixing & Fastening Model
            </label>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '6px' }}>
              {[
                { id: 'Standing Seam', label: 'Standing Seam', desc: 'Grub Screws' },
                { id: 'Riviting', label: 'Riveting', desc: 'Rivets + EPDM' },
                { id: 'Adhesive', label: 'Adhesive', desc: 'Non-Penetrative' }
              ].map(f => {
                const isSel = fixingModel === f.id;
                return (
                  <button
                    key={f.id}
                    onClick={() => setFixingModel(f.id)}
                    style={{
                      padding: '8px 6px',
                      backgroundColor: isSel ? '#EFF6FF' : '#F8FAFC',
                      border: isSel ? '2px solid #2563EB' : '1px solid #E2E8F0',
                      borderRadius: '8px',
                      cursor: 'pointer',
                      textAlign: 'center'
                    }}
                  >
                    <div style={{ fontSize: '11.5px', fontWeight: '800', color: isSel ? '#1D4ED8' : '#0F172A' }}>
                      {f.label}
                    </div>
                    <div style={{ fontSize: '9px', color: '#64748B', marginTop: '2px' }}>
                      {f.desc}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* System Layout Sizing */}
          <div>
            <label style={{ fontSize: '12px', fontWeight: '800', color: '#0F172A', marginBottom: '8px', display: 'block' }}>
              3. Solar Array Layout
            </label>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '10px' }}>
              <div style={{ backgroundColor: '#F8FAFC', border: '1px solid #CBD5E1', borderRadius: '8px', padding: '8px 12px' }}>
                <span style={{ fontSize: '10.5px', fontWeight: '700', color: '#64748B' }}>Panels per Row</span>
                <input
                  type="number"
                  min="1"
                  value={panels}
                  onChange={(e) => setPanels(Math.max(1, parseInt(e.target.value) || 1))}
                  style={{ width: '100%', border: 'none', background: 'transparent', fontSize: '15px', fontWeight: '800', color: '#0F172A', outline: 'none' }}
                />
              </div>

              <div style={{ backgroundColor: '#F8FAFC', border: '1px solid #CBD5E1', borderRadius: '8px', padding: '8px 12px' }}>
                <span style={{ fontSize: '10.5px', fontWeight: '700', color: '#64748B' }}>Number of Rows</span>
                <input
                  type="number"
                  min="1"
                  value={rows}
                  onChange={(e) => setRows(Math.max(1, parseInt(e.target.value) || 1))}
                  style={{ width: '100%', border: 'none', background: 'transparent', fontSize: '15px', fontWeight: '800', color: '#0F172A', outline: 'none' }}
                />
              </div>
            </div>
          </div>

          {/* Panel Wattage & Multipliers */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '10px' }}>
            <div style={{ backgroundColor: '#F8FAFC', border: '1px solid #CBD5E1', borderRadius: '8px', padding: '8px 12px' }}>
              <span style={{ fontSize: '10.5px', fontWeight: '700', color: '#64748B' }}>Panel Wattage (Wp)</span>
              <input
                type="number"
                step="5"
                value={panelWp}
                onChange={(e) => setPanelWp(parseFloat(e.target.value) || 0)}
                style={{ width: '100%', border: 'none', background: 'transparent', fontSize: '15px', fontWeight: '800', color: '#0F172A', outline: 'none' }}
              />
            </div>

            <div style={{ backgroundColor: '#F8FAFC', border: '1px solid #CBD5E1', borderRadius: '8px', padding: '8px 12px' }}>
              <span style={{ fontSize: '10.5px', fontWeight: '700', color: '#64748B' }}>Table / Set Multiplier</span>
              <input
                type="number"
                min="1"
                value={setCount}
                onChange={(e) => setSetCount(Math.max(1, parseInt(e.target.value) || 1))}
                style={{ width: '100%', border: 'none', background: 'transparent', fontSize: '15px', fontWeight: '800', color: '#0F172A', outline: 'none' }}
              />
            </div>
          </div>

          {/* Summary Mini Card */}
          <div style={{
            backgroundColor: '#F0F9FF',
            border: '1px solid #BAE6FD',
            borderRadius: '10px',
            padding: '12px 14px',
            display: 'flex',
            flexDirection: 'column',
            gap: '4px'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px' }}>
              <span style={{ color: '#0369A1', fontWeight: '700' }}>Total Capacity:</span>
              <strong style={{ color: '#0F172A' }}>{totalQuotedKw} kW ({totalQuotedPanels} Panels)</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px' }}>
              <span style={{ color: '#0369A1', fontWeight: '700' }}>Per kW Rate:</span>
              <strong style={{ color: '#0F172A' }}>₹ {calcResult.perKwRate.toLocaleString('en-IN')} / kW</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px' }}>
              <span style={{ color: '#0369A1', fontWeight: '700' }}>Per Set Cost:</span>
              <strong style={{ color: '#0F172A' }}>₹ {calcResult.perSetCost.toLocaleString('en-IN')}</strong>
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN: Interactive Tabs (Schematic / BOM) */}
        <div style={{
          backgroundColor: '#F8FAFC',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden'
        }}>
          {/* Tab Navigation Header */}
          <div style={{
            backgroundColor: '#FFFFFF',
            borderBottom: '1px solid #E2E8F0',
            padding: '0 20px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            height: '48px',
            flexShrink: 0
          }}>
            <div style={{ display: 'flex', gap: '8px' }}>
              {[
                { id: 'schematic', label: '2D Schematic & Elevation' },
                { id: 'bom', label: `Bill of Materials (${calcResult.items.length} Items)` }
              ].map(t => {
                const isActive = activeTab === t.id;
                return (
                  <button
                    key={t.id}
                    onClick={() => setActiveTab(t.id)}
                    style={{
                      height: '48px',
                      padding: '0 14px',
                      backgroundColor: 'transparent',
                      border: 'none',
                      borderBottom: isActive ? '3px solid #0E7490' : '3px solid transparent',
                      color: isActive ? '#0E7490' : '#64748B',
                      fontSize: '12.5px',
                      fontWeight: isActive ? '800' : '600',
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '6px'
                    }}
                  >
                    <span>{t.label}</span>
                  </button>
                );
              })}
            </div>

            {activeTab === 'bom' && (
              <input
                type="text"
                placeholder="Search BOM items..."
                value={bomSearch}
                onChange={(e) => setBomSearch(e.target.value)}
                style={{
                  padding: '5px 10px',
                  borderRadius: '6px',
                  border: '1px solid #CBD5E1',
                  fontSize: '11.5px',
                  width: '180px'
                }}
              />
            )}
          </div>

          {/* Tab Body */}
          <div style={{ padding: '20px', overflowY: 'auto', flex: 1 }}>
            {activeTab === 'schematic' ? (
              <AluminiumSchematicView
                selectedRailDef={selectedRailDef}
                fixingModel={fixingModel}
                totalPanels={calcResult.totalPanels}
                totalRows={calcResult.totalRows}
                panelWp={calcResult.panelWp}
                totalKw={calcResult.totalKw}
                railCountPerPanel={railCountPerPanel}
              />
            ) : (
              <div style={{
                backgroundColor: '#FFFFFF',
                borderRadius: '10px',
                border: '1px solid #E2E8F0',
                overflow: 'hidden'
              }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                  <thead>
                    <tr style={{ backgroundColor: '#F1F5F9', borderBottom: '1px solid #CBD5E1', color: '#475569', fontWeight: '800', textAlign: 'left' }}>
                      <th style={{ padding: '8px 12px' }}>Item Description</th>
                      <th style={{ padding: '8px 10px', textAlign: 'center' }}>Qty</th>
                      <th style={{ padding: '8px 10px', textAlign: 'right' }}>Piece Weight</th>
                      <th style={{ padding: '8px 10px', textAlign: 'right' }}>Unit Price (₹)</th>
                      <th style={{ padding: '8px 12px', textAlign: 'right' }}>Total (₹)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredBom.map((it, idx) => {
                      const multQty = it.qty * setCount;
                      const multAmount = parseFloat((it.amount * setCount).toFixed(2));
                      return (
                        <tr key={idx} style={{ borderBottom: '1px solid #F1F5F9' }}>
                          <td style={{ padding: '10px 12px', fontWeight: '700', color: '#0F172A' }}>
                            {it.name}
                            <span style={{ fontSize: '10px', color: '#64748B', display: 'block', fontWeight: '500' }}>
                              Category: {it.category}
                            </span>
                          </td>
                          <td style={{ padding: '10px 10px', textAlign: 'center', fontWeight: '800', color: '#0F172A' }}>
                            {multQty} {it.uom}
                          </td>
                          <td style={{ padding: '10px 10px', textAlign: 'right', color: '#64748B' }}>
                            {it.weightGrams ? `${it.weightGrams}g` : '—'}
                          </td>
                          <td style={{ padding: '10px 10px', textAlign: 'right', fontWeight: '700', color: '#0F172A' }}>
                            ₹{it.unitPrice.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                          </td>
                          <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: '800', color: '#0F172A' }}>
                            ₹{multAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 3. Footer Bar with Live Totals and Apply Button */}
      <div style={{
        backgroundColor: '#FFFFFF',
        borderTop: '1px solid #E2E8F0',
        padding: '14px 28px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexShrink: 0
      }}>
        {/* Left Stats */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '24px' }}>
          <div>
            <div style={{ fontSize: '10.5px', color: '#64748B', fontWeight: '700', textTransform: 'uppercase' }}>Total Capacity</div>
            <div style={{ fontSize: '15px', fontWeight: '900', color: '#0F172A' }}>{totalQuotedKw} kW</div>
          </div>
          <div>
            <div style={{ fontSize: '10.5px', color: '#64748B', fontWeight: '700', textTransform: 'uppercase' }}>Price per kW</div>
            <div style={{ fontSize: '15px', fontWeight: '900', color: '#0284C7' }}>₹{calcResult.perKwRate.toLocaleString('en-IN')}</div>
          </div>
          <div>
            <div style={{ fontSize: '10.5px', color: '#64748B', fontWeight: '700', textTransform: 'uppercase' }}>Total Quoted Price</div>
            <div style={{ fontSize: '18px', fontWeight: '900', color: '#059669' }}>
              ₹{totalQuotedAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
            </div>
          </div>
        </div>

        {/* Right Actions */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <button
            onClick={onClose}
            style={{
              padding: '10px 18px',
              backgroundColor: '#F1F5F9',
              border: 'none',
              borderRadius: '10px',
              fontSize: '13px',
              fontWeight: '700',
              color: '#475569',
              cursor: 'pointer'
            }}
          >
            Cancel
          </button>
          <button
            onClick={handleApply}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              padding: '10px 24px',
              background: 'linear-gradient(135deg, #059669 0%, #10B981 100%)',
              border: 'none',
              borderRadius: '10px',
              fontSize: '13.5px',
              fontWeight: '800',
              color: '#FFFFFF',
              cursor: 'pointer',
              boxShadow: '0 4px 12px rgba(16, 185, 129, 0.35)'
            }}
          >
            <Check size={16} />
            <span>Apply to Quotation ({setCount} Kit{setCount > 1 ? 's' : ''})</span>
          </button>
        </div>
      </div>
    </div>
  );
}
