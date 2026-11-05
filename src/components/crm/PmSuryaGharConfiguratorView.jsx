import React, { useState, useMemo } from 'react';
import {
  Sun,
  Zap,
  Sliders,
  Check,
  Search,
  Box,
  Layers,
  ShieldCheck,
  Truck,
  Activity,
  FileText,
  RotateCcw
} from 'lucide-react';
import {
  SURYA_PANEL_MASTER,
  SURYA_INVERTER_MASTER,
  SURYA_CABLE_MASTER,
  SURYA_STRUCTURE_MASTER,
  TRANSPORT_DISTANCE_SLABS,
  calculatePmSuryaGharKit,
  getAutoInverter
} from '../../utils/pmSuryaGharConfigurator';
import MasterStructureProfileDropdown from './MasterStructureProfileDropdown';

export default function PmSuryaGharConfiguratorView({
  initialData = {},
  masterStructureValue,
  onMasterStructureChange,
  onSwitchCategory,
  onApplyToQuote,
  onClose
}) {
  // 1. Primary Solar Sizing Inputs
  const [panelQtyInput, setPanelQtyInput] = useState(String(initialData.panelQty || 5));
  const [panelMake, setPanelMake] = useState(initialData.panelMake || 'Renew');
  const [panelWp, setPanelWp] = useState(Number(initialData.panelWp || 550));

  // 2. Inverter Inputs
  const [inverterMake, setInverterMake] = useState(initialData.inverterMake || 'Polycab');
  const [isAutoInverter, setIsAutoInverter] = useState(true);
  const [manualInverterKw, setManualInverterKw] = useState('');
  const [manualInverterPhase, setManualInverterPhase] = useState('');

  // 3. Mounting Structure Inputs
  const [structureType, setStructureType] = useState(initialData.structureType || 'Hat Type');
  const [structureHeight, setStructureHeight] = useState(initialData.structureHeight || '8.3 - 10 ft');

  // 4. Balance of System (BOS) Cable Inputs
  const [dcCableSelection, setDcCableSelection] = useState(initialData.dcCableSelection || 'Polycab DC 4SQMM');
  const [dcCableMetresInput, setDcCableMetresInput] = useState(String(initialData.dcCableMetres || 40));
  const [acCableSelection, setAcCableSelection] = useState(initialData.acCableSelection || 'Polycab AC 4SQMM');
  const [acCableMetresInput, setAcCableMetresInput] = useState(String(initialData.acCableMetres || 40));
  const [earthingCableSelection, setEarthingCableSelection] = useState(initialData.earthingCableSelection || 'Orbit Aluminium Earthing 16SQMM');
  const [earthingCableMetresInput, setEarthingCableMetresInput] = useState(String(initialData.earthingCableMetres || 100));

  // 5. Logistics & Commercial
  const [transportDistance, setTransportDistance] = useState(initialData.transportDistance || 'Less than 50 km');
  const [priceBasis, setPriceBasis] = useState(initialData.priceBasis || 'Selling Price'); // 'Selling Price' | 'Minimum Selling Price'
  const [setCountInput, setSetCountInput] = useState(String(initialData.setCount || 1));

  // 6. Tabs & Filters
  const [activeTab, setActiveTab] = useState('schematic'); // 'schematic' | 'bom'
  const [bomSearch, setBomSearch] = useState('');
  const [insertionMode, setInsertionMode] = useState('group'); // 'group' | 'itemized'

  // Input Validation
  const parsedPanelQty = parseInt(panelQtyInput, 10);
  const isPanelQtyValid = !isNaN(parsedPanelQty) && parsedPanelQty >= 1;

  const parsedSetCount = parseInt(setCountInput, 10);
  const isSetCountValid = !isNaN(parsedSetCount) && parsedSetCount >= 1;

  const isFormValid = isPanelQtyValid && isSetCountValid;

  const safePanelQty = isPanelQtyValid ? parsedPanelQty : 1;
  const safeSetCount = isSetCountValid ? parsedSetCount : 1;

  // Available Wp ratings for selected panel brand
  const availablePanelWps = useMemo(() => {
    const list = SURYA_PANEL_MASTER.filter(p => p.make.toLowerCase() === panelMake.toLowerCase());
    return [...new Set(list.map(p => p.wp))].sort((a, b) => a - b);
  }, [panelMake]);

  // Actual DC Capacity
  const actualDcKw = parseFloat(((safePanelQty * panelWp) / 1000).toFixed(2));

  // Auto-calculated optimal inverter
  const autoInverter = useMemo(() => {
    return getAutoInverter(actualDcKw, inverterMake);
  }, [actualDcKw, inverterMake]);

  const effectiveInverterKw = isAutoInverter ? autoInverter.kw : (parseFloat(manualInverterKw) || autoInverter.kw);
  const effectiveInverterPhase = isAutoInverter ? autoInverter.phase : (manualInverterPhase || autoInverter.phase);

  // Available inverters for brand
  const availableInverters = useMemo(() => {
    return SURYA_INVERTER_MASTER.filter(inv => inv.make.toLowerCase() === inverterMake.toLowerCase());
  }, [inverterMake]);

  // Main Live Calculation Result
  const calcResult = useMemo(() => {
    return calculatePmSuryaGharKit({
      panelQty: safePanelQty,
      panelMake,
      panelWp,
      inverterMake,
      inverterKw: effectiveInverterKw,
      inverterPhase: effectiveInverterPhase,
      structureType,
      structureHeight,
      dcCableSelection,
      dcCableMetres: parseFloat(dcCableMetresInput) || 40,
      acCableSelection,
      acCableMetres: parseFloat(acCableMetresInput) || 40,
      earthingCableSelection,
      earthingCableMetres: parseFloat(earthingCableMetresInput) || 100,
      transportDistance,
      priceBasis,
      setCount: safeSetCount
    });
  }, [
    safePanelQty,
    panelMake,
    panelWp,
    inverterMake,
    effectiveInverterKw,
    effectiveInverterPhase,
    structureType,
    structureHeight,
    dcCableSelection,
    dcCableMetresInput,
    acCableSelection,
    acCableMetresInput,
    earthingCableSelection,
    earthingCableMetresInput,
    transportDistance,
    priceBasis,
    safeSetCount
  ]);

  // Filtered BOM
  const filteredBom = useMemo(() => {
    if (!bomSearch.trim()) return calcResult.items;
    const q = bomSearch.toLowerCase().trim();
    return calcResult.items.filter(it =>
      it.name.toLowerCase().includes(q) ||
      it.spec.toLowerCase().includes(q) ||
      it.make.toLowerCase().includes(q) ||
      it.category.toLowerCase().includes(q)
    );
  }, [calcResult.items, bomSearch]);

  // Total Quoted Math
  const totalQuotedAmount = isFormValid ? calcResult.totalAmount : 0;
  const totalQuotedKw = isFormValid ? calcResult.totalKw : 0;

  // Apply to Quotation Handler
  const handleApply = () => {
    if (!isFormValid) {
      alert('Please enter a valid panel quantity and multiplier before proceeding.');
      return;
    }

    const mult = safeSetCount;
    const grpId = 'surya_kit_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6);
    const grpTitle = `PM Surya Ghar Solar BOS Kit (${calcResult.actualDcKw} kW — ${calcResult.panelQty} Panels)`;

    if (insertionMode === 'group') {
      const finalItems = calcResult.items.map(it => {
        const multQty = it.qty * mult;
        return {
          name: `${it.name} - ${it.spec}`,
          category: `PM Surya Ghar • ${it.category} (${it.make})`,
          specs: it.spec,
          qty: String(multQty),
          baseQty: it.qty,
          uom: it.uom,
          unit: it.unit,
          rate: '0',
          gstRate: it.gstRate || '18%',
          hsn: it.hsn || '85414011',
          presetName: grpTitle,
          presetGroupId: grpId,
          isPresetItem: true,
          specDetails: {
            make: it.make,
            spec: it.spec,
            unitRate: it.rate,
            category: it.category
          }
        };
      });

      onApplyToQuote?.({
        mode: 'group',
        groupId: grpId,
        groupTitle: grpTitle,
        kitPrice: String(calcResult.perKitAmount),
        setCount: mult,
        items: finalItems,
        result: {
          structureType: 'PM Surya Ghar Turnkey Solar BOS Kit',
          tableTitle: grpTitle,
          totalPanels: calcResult.panelQty * mult,
          totalKw: totalQuotedKw,
          quotedPrice: calcResult.perKitAmount,
          totalQuotedPrice: totalQuotedAmount
        }
      });
    } else {
      // Itemized Line Items
      const finalItems = calcResult.items.map(it => {
        const multQty = it.qty * mult;
        return {
          name: `${it.name} - ${it.spec}`,
          category: `PM Surya Ghar • ${it.category} (${it.make})`,
          specs: it.spec,
          qty: String(multQty),
          baseQty: it.qty,
          uom: it.uom,
          unit: it.unit,
          rate: String(it.rate),
          gstRate: it.gstRate || '18%',
          hsn: it.hsn || '85414011',
          isPresetItem: false,
          presetGroupId: null
        };
      });

      onApplyToQuote?.({
        mode: 'itemized',
        groupId: null,
        groupTitle: grpTitle,
        kitPrice: null,
        setCount: mult,
        items: finalItems,
        result: {
          structureType: 'PM Surya Ghar Turnkey Solar BOS Kit',
          tableTitle: grpTitle,
          totalPanels: calcResult.panelQty * mult,
          totalKw: totalQuotedKw,
          quotedPrice: calcResult.perKitAmount,
          totalQuotedPrice: totalQuotedAmount
        }
      });
    }

    onClose?.();
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
      {/* Configuration Header Sub-Bar */}
      <div style={{
        padding: '10px 24px',
        backgroundColor: '#FFFBEB',
        borderBottom: '1px solid #FDE68A',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '12px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <span style={{
            fontSize: '12px',
            fontWeight: '900',
            color: '#B45309',
            backgroundColor: '#FEF3C7',
            border: '1px solid #FCD34D',
            padding: '3px 10px',
            borderRadius: '8px',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px'
          }}>
            <span>☀️</span>
            <span>PM Surya Ghar: Muft Bijli Yojana</span>
          </span>
          <span style={{ fontSize: '12px', color: '#78350F', fontWeight: '600' }}>
            Turnkey Solar BOS Sizing Engine (Modules + Inverter + Structure + BOS Kit)
          </span>
        </div>

        {/* Pricing Tier Selector (Selling Price vs Minimum Selling Price) */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '11px', fontWeight: '800', color: '#64748B', textTransform: 'uppercase' }}>
            Pricing Tier:
          </span>
          <div style={{ display: 'inline-flex', backgroundColor: '#E2E8F0', padding: '2px', borderRadius: '8px' }}>
            <button
              type="button"
              onClick={() => setPriceBasis('Selling Price')}
              style={{
                padding: '4px 10px',
                borderRadius: '6px',
                border: 'none',
                backgroundColor: priceBasis === 'Selling Price' ? '#0E7490' : 'transparent',
                color: priceBasis === 'Selling Price' ? '#FFFFFF' : '#475569',
                fontSize: '11.5px',
                fontWeight: '800',
                cursor: 'pointer'
              }}
            >
              Selling Price
            </button>
            <button
              type="button"
              onClick={() => setPriceBasis('Minimum Selling Price')}
              style={{
                padding: '4px 10px',
                borderRadius: '6px',
                border: 'none',
                backgroundColor: priceBasis === 'Minimum Selling Price' ? '#B45309' : 'transparent',
                color: priceBasis === 'Minimum Selling Price' ? '#FFFFFF' : '#475569',
                fontSize: '11.5px',
                fontWeight: '800',
                cursor: 'pointer'
              }}
            >
              Min. Selling Price
            </button>
          </div>
        </div>
      </div>

      {/* Main Body: Left Config Sidebar + Right Preview Area */}
      <div style={{ display: 'flex', flex: 1, minHeight: 0, overflow: 'hidden' }}>
        {/* Left Interactive Config Form (Scrollable) */}
        <div style={{
          width: '380px',
          borderRight: '1px solid #E2E8F0',
          overflowY: 'auto',
          padding: '20px',
          display: 'flex',
          flexDirection: 'column',
          gap: '16px',
          backgroundColor: '#FFFFFF'
        }}>
          {/* Master Structure & Column Profile (Unified Master Dropdown) */}
          <MasterStructureProfileDropdown
            value={masterStructureValue || 'pm_surya_ghar'}
            onChange={onMasterStructureChange}
            activeBadge="Turnkey BOS Kit"
          />

          {/* Section 1: Solar Modules */}
          <div style={{ padding: '14px', borderRadius: '12px', border: '1px solid #E2E8F0', backgroundColor: '#FAFAFA' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
              <span style={{ fontSize: '11.5px', fontWeight: '800', color: '#0F172A', textTransform: 'uppercase', letterSpacing: '0.4px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Sun size={14} style={{ color: '#F59E0B' }} /> 1. Solar PV Modules
              </span>
              <span style={{ fontSize: '11px', fontWeight: '800', color: '#0E7490', backgroundColor: '#ECFEFF', padding: '2px 8px', borderRadius: '6px' }}>
                {actualDcKw} kW DC
              </span>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <div>
                <label style={{ fontSize: '11px', fontWeight: '700', color: '#475569', display: 'block', marginBottom: '4px' }}>
                  Panel Brand
                </label>
                <select
                  value={panelMake}
                  onChange={(e) => setPanelMake(e.target.value)}
                  style={{ width: '100%', padding: '7px 10px', borderRadius: '8px', border: '1px solid #CBD5E1', fontSize: '12.5px', fontWeight: '700', color: '#0F172A' }}
                >
                  <option value="Renew">Renew Solar (DCR)</option>
                  <option value="Waaree">Waaree Solar (DCR)</option>
                  <option value="Adani">Adani Solar (DCR)</option>
                  <option value="Vikram">Vikram Solar (DCR / Non-DCR)</option>
                </select>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                <div>
                  <label style={{ fontSize: '11px', fontWeight: '700', color: '#475569', display: 'block', marginBottom: '4px' }}>
                    Panel Wattage (Wp)
                  </label>
                  <select
                    value={panelWp}
                    onChange={(e) => setPanelWp(Number(e.target.value))}
                    style={{ width: '100%', padding: '7px 10px', borderRadius: '8px', border: '1px solid #CBD5E1', fontSize: '12.5px', fontWeight: '700', color: '#0F172A' }}
                  >
                    {availablePanelWps.map(wp => (
                      <option key={wp} value={wp}>{wp} Wp</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: '11px', fontWeight: '700', color: '#475569', display: 'block', marginBottom: '4px' }}>
                    Panel Qty <span style={{ color: '#EF4444' }}>*</span>
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="60"
                    value={panelQtyInput}
                    onChange={(e) => setPanelQtyInput(e.target.value)}
                    style={{ width: '100%', padding: '7px 10px', borderRadius: '8px', border: isPanelQtyValid ? '1px solid #CBD5E1' : '1.5px solid #EF4444', fontSize: '12.5px', fontWeight: '800', color: '#0F172A' }}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Section 2: On-Grid String Inverter */}
          <div style={{ padding: '14px', borderRadius: '12px', border: '1px solid #E2E8F0', backgroundColor: '#FAFAFA' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
              <span style={{ fontSize: '11.5px', fontWeight: '800', color: '#0F172A', textTransform: 'uppercase', letterSpacing: '0.4px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Zap size={14} style={{ color: '#0E7490' }} /> 2. Grid-Tied Inverter
              </span>
              <label style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '10.5px', fontWeight: '700', color: '#0E7490', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={isAutoInverter}
                  onChange={(e) => setIsAutoInverter(e.target.checked)}
                  style={{ accentColor: '#0E7490' }}
                />
                Auto-Sized
              </label>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <div>
                <label style={{ fontSize: '11px', fontWeight: '700', color: '#475569', display: 'block', marginBottom: '4px' }}>
                  Inverter Make
                </label>
                <select
                  value={inverterMake}
                  onChange={(e) => setInverterMake(e.target.value)}
                  style={{ width: '100%', padding: '7px 10px', borderRadius: '8px', border: '1px solid #CBD5E1', fontSize: '12.5px', fontWeight: '700', color: '#0F172A' }}
                >
                  <option value="Polycab">Polycab String Inverter</option>
                  <option value="Deye">Deye High-Efficiency Inverter</option>
                  <option value="Growatt">Growatt Smart Inverter</option>
                </select>
              </div>

              {!isAutoInverter ? (
                <div>
                  <label style={{ fontSize: '11px', fontWeight: '700', color: '#475569', display: 'block', marginBottom: '4px' }}>
                    Select Inverter Model
                  </label>
                  <select
                    value={`${effectiveInverterKw}|${effectiveInverterPhase}`}
                    onChange={(e) => {
                      const [kw, phase] = e.target.value.split('|');
                      setManualInverterKw(kw);
                      setManualInverterPhase(phase);
                    }}
                    style={{ width: '100%', padding: '7px 10px', borderRadius: '8px', border: '1px solid #CBD5E1', fontSize: '12px', fontWeight: '700', color: '#0F172A' }}
                  >
                    {availableInverters.map((inv, idx) => (
                      <option key={idx} value={`${inv.kw}|${inv.phase}`}>
                        {inv.kw} kW • {inv.phase} (₹{inv.sellingPrice.toLocaleString('en-IN')})
                      </option>
                    ))}
                  </select>
                </div>
              ) : (
                <div style={{ padding: '8px 10px', backgroundColor: '#ECFEFF', borderRadius: '8px', border: '1px solid #A5F3FC', fontSize: '11.5px', fontWeight: '700', color: '#0E7490' }}>
                  ⚡ Auto-Matched: <strong>{autoInverter.kw} kW {autoInverter.phase}</strong> ({autoInverter.make})
                </div>
              )}
            </div>
          </div>

          {/* Section 3: HDG Mounting Structure */}
          <div style={{ padding: '14px', borderRadius: '12px', border: '1px solid #E2E8F0', backgroundColor: '#FAFAFA' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
              <span style={{ fontSize: '11.5px', fontWeight: '800', color: '#0F172A', textTransform: 'uppercase', letterSpacing: '0.4px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Layers size={14} style={{ color: '#059669' }} /> 3. Mounting Structure
              </span>
              <span style={{ fontSize: '10.5px', fontWeight: '700', color: '#64748B' }}>
                {safePanelQty % 2 === 1 ? `Sized for ${safePanelQty + 1} Panels` : `${safePanelQty} Panels`}
              </span>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <div>
                <label style={{ fontSize: '11px', fontWeight: '700', color: '#475569', display: 'block', marginBottom: '4px' }}>
                  Purlin Section Type
                </label>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                  <button
                    type="button"
                    onClick={() => setStructureType('Hat Type')}
                    style={{
                      padding: '7px 10px',
                      borderRadius: '8px',
                      border: structureType === 'Hat Type' ? '2px solid #0E7490' : '1px solid #CBD5E1',
                      backgroundColor: structureType === 'Hat Type' ? '#ECFEFF' : '#FFFFFF',
                      color: structureType === 'Hat Type' ? '#0E7490' : '#475569',
                      fontSize: '12px',
                      fontWeight: '800',
                      cursor: 'pointer'
                    }}
                  >
                    Hat Purlin
                  </button>
                  <button
                    type="button"
                    onClick={() => setStructureType('C Type')}
                    style={{
                      padding: '7px 10px',
                      borderRadius: '8px',
                      border: structureType === 'C Type' ? '2px solid #0E7490' : '1px solid #CBD5E1',
                      backgroundColor: structureType === 'C Type' ? '#ECFEFF' : '#FFFFFF',
                      color: structureType === 'C Type' ? '#0E7490' : '#475569',
                      fontSize: '12px',
                      fontWeight: '800',
                      cursor: 'pointer'
                    }}
                  >
                    C-Section Purlin
                  </button>
                </div>
              </div>

              <div>
                <label style={{ fontSize: '11px', fontWeight: '700', color: '#475569', display: 'block', marginBottom: '4px' }}>
                  Clearance Height Range
                </label>
                <select
                  value={structureHeight}
                  onChange={(e) => setStructureHeight(e.target.value)}
                  style={{ width: '100%', padding: '7px 10px', borderRadius: '8px', border: '1px solid #CBD5E1', fontSize: '12.5px', fontWeight: '700', color: '#0F172A' }}
                >
                  <option value="3-5 ft">3 - 5 ft (Standard Rooftop Flush)</option>
                  <option value="4-6 ft">4 - 6 ft (Medium Clearance)</option>
                  <option value="6.5 - 8.3 ft">6.5 - 8.3 ft (Elevated Walk-Under)</option>
                  <option value="8.3 - 10 ft">8.3 - 10 ft (High Clearance Walk-Under)</option>
                </select>
              </div>
            </div>
          </div>

          {/* Section 4: Cables & Distances */}
          <div style={{ padding: '14px', borderRadius: '12px', border: '1px solid #E2E8F0', backgroundColor: '#FAFAFA' }}>
            <span style={{ fontSize: '11.5px', fontWeight: '800', color: '#0F172A', textTransform: 'uppercase', letterSpacing: '0.4px', display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '10px' }}>
              <Activity size={14} style={{ color: '#0284C7' }} /> 4. Solar BOS Cables
            </span>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '8px' }}>
                <div>
                  <label style={{ fontSize: '10px', fontWeight: '700', color: '#64748B' }}>DC Cable Type</label>
                  <select
                    value={dcCableSelection}
                    onChange={(e) => setDcCableSelection(e.target.value)}
                    style={{ width: '100%', padding: '5px 8px', borderRadius: '6px', border: '1px solid #CBD5E1', fontSize: '11.5px', fontWeight: '700' }}
                  >
                    <option value="Polycab DC 4SQMM">Polycab DC 4SQMM</option>
                    <option value="Polycab DC 6SQMM">Polycab DC 6SQMM</option>
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: '10px', fontWeight: '700', color: '#64748B' }}>Metres</label>
                  <input
                    type="number"
                    min="1"
                    value={dcCableMetresInput}
                    onChange={(e) => setDcCableMetresInput(e.target.value)}
                    style={{ width: '100%', padding: '5px 8px', borderRadius: '6px', border: '1px solid #CBD5E1', fontSize: '11.5px', fontWeight: '800' }}
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '8px' }}>
                <div>
                  <label style={{ fontSize: '10px', fontWeight: '700', color: '#64748B' }}>AC Cable Type</label>
                  <select
                    value={acCableSelection}
                    onChange={(e) => setAcCableSelection(e.target.value)}
                    style={{ width: '100%', padding: '5px 8px', borderRadius: '6px', border: '1px solid #CBD5E1', fontSize: '11.5px', fontWeight: '700' }}
                  >
                    <option value="Polycab AC 4SQMM">Polycab AC 4SQMM</option>
                    <option value="Polycab AC 6SQMM">Polycab AC 6SQMM</option>
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: '10px', fontWeight: '700', color: '#64748B' }}>Metres</label>
                  <input
                    type="number"
                    min="1"
                    value={acCableMetresInput}
                    onChange={(e) => setAcCableMetresInput(e.target.value)}
                    style={{ width: '100%', padding: '5px 8px', borderRadius: '6px', border: '1px solid #CBD5E1', fontSize: '11.5px', fontWeight: '800' }}
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '8px' }}>
                <div>
                  <label style={{ fontSize: '10px', fontWeight: '700', color: '#64748B' }}>Earthing Cable</label>
                  <select
                    value={earthingCableSelection}
                    onChange={(e) => setEarthingCableSelection(e.target.value)}
                    style={{ width: '100%', padding: '5px 8px', borderRadius: '6px', border: '1px solid #CBD5E1', fontSize: '11.5px', fontWeight: '700' }}
                  >
                    <option value="Orbit Aluminium Earthing 16SQMM">Orbit Al 16SQMM</option>
                    <option value="Polycab Earthing 4SQMM">Polycab Cu 4SQMM</option>
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: '10px', fontWeight: '700', color: '#64748B' }}>Metres</label>
                  <input
                    type="number"
                    min="1"
                    value={earthingCableMetresInput}
                    onChange={(e) => setEarthingCableMetresInput(e.target.value)}
                    style={{ width: '100%', padding: '5px 8px', borderRadius: '6px', border: '1px solid #CBD5E1', fontSize: '11.5px', fontWeight: '800' }}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Section 5: Logistics & Multiplier */}
          <div style={{ padding: '14px', borderRadius: '12px', border: '1px solid #E2E8F0', backgroundColor: '#FAFAFA' }}>
            <span style={{ fontSize: '11.5px', fontWeight: '800', color: '#0F172A', textTransform: 'uppercase', letterSpacing: '0.4px', display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '10px' }}>
              <Truck size={14} style={{ color: '#475569' }} /> 5. Logistics & Multiplier
            </span>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <div>
                <label style={{ fontSize: '10px', fontWeight: '700', color: '#64748B', display: 'block', marginBottom: '3px' }}>
                  Transportation Distance
                </label>
                <select
                  value={transportDistance}
                  onChange={(e) => setTransportDistance(e.target.value)}
                  style={{ width: '100%', padding: '6px 8px', borderRadius: '6px', border: '1px solid #CBD5E1', fontSize: '11.5px', fontWeight: '700' }}
                >
                  {TRANSPORT_DISTANCE_SLABS.map(t => (
                    <option key={t.label} value={t.label}>{t.label} (₹{t.cost})</option>
                  ))}
                </select>
              </div>

              <div>
                <label style={{ fontSize: '10px', fontWeight: '700', color: '#64748B', display: 'block', marginBottom: '3px' }}>
                  Number of Kits / Sets <span style={{ color: '#EF4444' }}>*</span>
                </label>
                <input
                  type="number"
                  min="1"
                  value={setCountInput}
                  onChange={(e) => setSetCountInput(e.target.value)}
                  style={{ width: '100%', padding: '6px 8px', borderRadius: '6px', border: isSetCountValid ? '1px solid #CBD5E1' : '1.5px solid #EF4444', fontSize: '12px', fontWeight: '800' }}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Right Area: Tabs for 2D Blueprint & Bill of Materials */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, backgroundColor: '#FFFFFF' }}>
          {/* Top Tabs */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            borderBottom: '1px solid #E2E8F0',
            padding: '0 24px',
            backgroundColor: '#FAFAFA'
          }}>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                type="button"
                onClick={() => setActiveTab('schematic')}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '12px 16px',
                  border: 'none',
                  borderBottom: activeTab === 'schematic' ? '2.5px solid #0E7490' : '2.5px solid transparent',
                  backgroundColor: 'transparent',
                  color: activeTab === 'schematic' ? '#0E7490' : '#64748B',
                  fontSize: '13px',
                  fontWeight: '800',
                  cursor: 'pointer'
                }}
              >
                <Sun size={15} /> 2D System Schematic & Layout
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('bom')}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '12px 16px',
                  border: 'none',
                  borderBottom: activeTab === 'bom' ? '2.5px solid #0E7490' : '2.5px solid transparent',
                  backgroundColor: 'transparent',
                  color: activeTab === 'bom' ? '#0E7490' : '#64748B',
                  fontSize: '13px',
                  fontWeight: '800',
                  cursor: 'pointer'
                }}
              >
                <FileText size={15} /> Turnkey Bill of Materials ({calcResult.items.length} Items)
              </button>
            </div>

            {activeTab === 'bom' && (
              <div style={{ position: 'relative', width: '220px' }}>
                <Search size={14} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: '#94A3B8' }} />
                <input
                  type="text"
                  placeholder="Search BOM items..."
                  value={bomSearch}
                  onChange={(e) => setBomSearch(e.target.value)}
                  style={{ width: '100%', padding: '6px 10px 6px 30px', borderRadius: '8px', border: '1px solid #CBD5E1', fontSize: '11.5px', outline: 'none' }}
                />
              </div>
            )}
          </div>

          {/* Tab Content View */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '20px' }}>
            {activeTab === 'schematic' ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                {/* Header Badge */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#F8FAFC', padding: '12px 18px', borderRadius: '12px', border: '1px solid #E2E8F0' }}>
                  <div>
                    <span style={{ fontSize: '11px', fontWeight: '800', color: '#0E7490', textTransform: 'uppercase', letterSpacing: '0.4px' }}>
                      PM Surya Ghar Rooftop Architecture
                    </span>
                    <h3 style={{ margin: '2px 0 0 0', fontSize: '15px', fontWeight: '900', color: '#0F172A' }}>
                      {calcResult.title}
                    </h3>
                  </div>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <div style={{ textAlign: 'center', padding: '4px 10px', backgroundColor: '#FFFFFF', borderRadius: '8px', border: '1px solid #E2E8F0' }}>
                      <div style={{ fontSize: '9px', fontWeight: '700', color: '#64748B' }}>PANELS</div>
                      <div style={{ fontSize: '12px', fontWeight: '800', color: '#0F172A' }}>{calcResult.panelQty} × {calcResult.panelWp}W</div>
                    </div>
                    <div style={{ textAlign: 'center', padding: '4px 10px', backgroundColor: '#FFFFFF', borderRadius: '8px', border: '1px solid #E2E8F0' }}>
                      <div style={{ fontSize: '9px', fontWeight: '700', color: '#64748B' }}>INVERTER</div>
                      <div style={{ fontSize: '12px', fontWeight: '800', color: '#0E7490' }}>{calcResult.inverterKw} kW ({calcResult.inverterPhase})</div>
                    </div>
                    <div style={{ textAlign: 'center', padding: '4px 10px', backgroundColor: '#FFFFFF', borderRadius: '8px', border: '1px solid #E2E8F0' }}>
                      <div style={{ fontSize: '9px', fontWeight: '700', color: '#64748B' }}>STRUCTURE</div>
                      <div style={{ fontSize: '12px', fontWeight: '800', color: '#059669' }}>{calcResult.structureType} ({calcResult.structureHeight})</div>
                    </div>
                  </div>
                </div>

                {/* SVG 2D Schematic Canvas */}
                <div style={{
                  width: '100%',
                  height: '380px',
                  backgroundColor: '#0F172A',
                  borderRadius: '16px',
                  border: '1px solid #334155',
                  position: 'relative',
                  overflow: 'hidden'
                }}>
                  <svg width="100%" height="100%" viewBox="0 0 800 360" preserveAspectRatio="xMidYMid meet">
                    {/* Grid Background */}
                    <defs>
                      <pattern id="suryaGrid" width="20" height="20" patternUnits="userSpaceOnUse">
                        <line x1="0" y1="0" x2="20" y2="0" stroke="rgba(255,255,255,0.04)" strokeWidth="1" />
                        <line x1="0" y1="0" x2="0" y2="20" stroke="rgba(255,255,255,0.04)" strokeWidth="1" />
                      </pattern>
                      <linearGradient id="panelGrad" x1="0" y1="0" x2="1" y2="0">
                        <stop offset="0%" stopColor="#1E3A8A" />
                        <stop offset="50%" stopColor="#2563EB" />
                        <stop offset="100%" stopColor="#1D4ED8" />
                      </linearGradient>
                      <linearGradient id="invGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#F8FAFC" />
                        <stop offset="100%" stopColor="#E2E8F0" />
                      </linearGradient>
                    </defs>
                    <rect width="100%" height="100%" fill="url(#suryaGrid)" />

                    {/* Roof Datum Line */}
                    <line x1="40" y1="290" x2="760" y2="290" stroke="#64748B" strokeWidth="2" strokeDasharray="4,4" />
                    <text x="50" y="306" fill="#94A3B8" fontSize="11" fontWeight="800">
                      ▲ ROOF TOP SLAB DATUM (CLEARANCE: {calcResult.structureHeight})
                    </text>

                    {/* HDG Columns / Legs */}
                    <line x1="120" y1="180" x2="120" y2="290" stroke="#94A3B8" strokeWidth="6" strokeLinecap="round" />
                    <line x1="280" y1="140" x2="280" y2="290" stroke="#94A3B8" strokeWidth="6" strokeLinecap="round" />
                    <line x1="440" y1="100" x2="440" y2="290" stroke="#94A3B8" strokeWidth="6" strokeLinecap="round" />

                    {/* Purlin / Rafter Slope */}
                    <line x1="90" y1="190" x2="470" y2="90" stroke="#0E7490" strokeWidth="8" strokeLinecap="round" />
                    <text x="240" y="80" fill="#38BDF8" fontSize="11" fontWeight="800">
                      HDG {calcResult.structureType.toUpperCase()} PURLIN
                    </text>

                    {/* Solar PV Modules tilted on structure */}
                    <g transform="translate(100, 140) rotate(-14)">
                      {/* Module 1 */}
                      <rect x="0" y="0" width="105" height="42" rx="4" fill="url(#panelGrad)" stroke="#60A5FA" strokeWidth="2" />
                      <line x1="26" y1="0" x2="26" y2="42" stroke="rgba(255,255,255,0.3)" />
                      <line x1="52" y1="0" x2="52" y2="42" stroke="rgba(255,255,255,0.3)" />
                      <line x1="78" y1="0" x2="78" y2="42" stroke="rgba(255,255,255,0.3)" />
                      <text x="52" y="24" fill="#FFFFFF" fontSize="9" fontWeight="900" textAnchor="middle">PV MOD 1</text>

                      {/* Module 2 */}
                      <rect x="115" y="0" width="105" height="42" rx="4" fill="url(#panelGrad)" stroke="#60A5FA" strokeWidth="2" />
                      <line x1="141" y1="0" x2="141" y2="42" stroke="rgba(255,255,255,0.3)" />
                      <line x1="167" y1="0" x2="167" y2="42" stroke="rgba(255,255,255,0.3)" />
                      <line x1="193" y1="0" x2="193" y2="42" stroke="rgba(255,255,255,0.3)" />
                      <text x="167" y="24" fill="#FFFFFF" fontSize="9" fontWeight="900" textAnchor="middle">PV MOD 2</text>

                      {/* Module 3 */}
                      <rect x="230" y="0" width="105" height="42" rx="4" fill="url(#panelGrad)" stroke="#60A5FA" strokeWidth="2" />
                      <line x1="256" y1="0" x2="256" y2="42" stroke="rgba(255,255,255,0.3)" />
                      <line x1="282" y1="0" x2="282" y2="42" stroke="rgba(255,255,255,0.3)" />
                      <line x1="308" y1="0" x2="308" y2="42" stroke="rgba(255,255,255,0.3)" />
                      <text x="282" y="24" fill="#FFFFFF" fontSize="9" fontWeight="900" textAnchor="middle">PV MOD 3</text>
                    </g>

                    {/* DC Solar Cable (Red line to Inverter) */}
                    <path d="M 430 110 Q 510 110 520 180" fill="none" stroke="#EF4444" strokeWidth="3" strokeDasharray="3,2" />
                    <text x="475" y="145" fill="#F87171" fontSize="10" fontWeight="700">DC 4SQMM</text>

                    {/* Inverter Box */}
                    <rect x="520" y="170" width="70" height="90" rx="8" fill="url(#invGrad)" stroke="#94A3B8" strokeWidth="2" />
                    <circle cx="555" cy="195" r="12" fill="#0284C7" />
                    <text x="555" y="199" fill="#FFFFFF" fontSize="9" fontWeight="900" textAnchor="middle">INV</text>
                    <text x="555" y="225" fill="#0F172A" fontSize="9" fontWeight="900" textAnchor="middle">{calcResult.inverterKw}kW</text>
                    <text x="555" y="240" fill="#475569" fontSize="8" fontWeight="700" textAnchor="middle">{calcResult.inverterMake}</text>

                    {/* ACDB Box */}
                    <rect x="610" y="185" width="45" height="60" rx="6" fill="#F1F5F9" stroke="#0E7490" strokeWidth="1.5" />
                    <text x="632" y="210" fill="#0E7490" fontSize="9" fontWeight="900" textAnchor="middle">ACDB</text>
                    <text x="632" y="226" fill="#64748B" fontSize="8" fontWeight="700" textAnchor="middle">SPD/MCB</text>

                    {/* AC Cable from Inverter to ACDB */}
                    <line x1="590" y1="210" x2="610" y2="210" stroke="#3B82F6" strokeWidth="2.5" />

                    {/* AC Cable from ACDB to Grid Output */}
                    <line x1="655" y1="210" x2="720" y2="210" stroke="#3B82F6" strokeWidth="2.5" />
                    <text x="685" y="200" fill="#60A5FA" fontSize="9" fontWeight="700">AC Out</text>

                    {/* Earthing Cable (Green Wire to Ground Pit) */}
                    <path d="M 555 260 L 555 310 L 680 310" fill="none" stroke="#10B981" strokeWidth="2.5" strokeDasharray="2,2" />
                    <rect x="680" y="295" width="30" height="30" rx="4" fill="#065F46" stroke="#34D399" strokeWidth="1.5" />
                    <text x="695" y="313" fill="#FFFFFF" fontSize="8" fontWeight="900" textAnchor="middle">PIT</text>
                    <text x="600" y="325" fill="#34D399" fontSize="9" fontWeight="700">Earth Rod + Compound</text>
                  </svg>
                </div>
              </div>
            ) : (
              /* BOM Table Tab */
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                  <thead>
                    <tr style={{ backgroundColor: '#F8FAFC', borderBottom: '2px solid #E2E8F0', color: '#475569' }}>
                      <th style={{ padding: '8px 10px', width: '35px', textAlign: 'center' }}>#</th>
                      <th style={{ padding: '8px 10px', textAlign: 'left' }}>Item Name</th>
                      <th style={{ padding: '8px 10px', textAlign: 'left' }}>Technical Specification</th>
                      <th style={{ padding: '8px 10px', textAlign: 'left' }}>Make</th>
                      <th style={{ padding: '8px 10px', textAlign: 'center' }}>Qty</th>
                      <th style={{ padding: '8px 10px', textAlign: 'center' }}>UOM</th>
                      <th style={{ padding: '8px 10px', textAlign: 'right' }}>Rate (₹)</th>
                      <th style={{ padding: '8px 10px', textAlign: 'right' }}>Total Amount (₹)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredBom.map((it, idx) => (
                      <tr key={idx} style={{ borderBottom: '1px solid #F1F5F9', backgroundColor: idx % 2 === 1 ? '#FAFBFC' : '#FFFFFF' }}>
                        <td style={{ padding: '8px 10px', textAlign: 'center', color: '#94A3B8', fontWeight: '700' }}>{it.slNo}</td>
                        <td style={{ padding: '8px 10px', fontWeight: '800', color: '#0F172A' }}>{it.name}</td>
                        <td style={{ padding: '8px 10px', color: '#475569' }}>{it.spec}</td>
                        <td style={{ padding: '8px 10px', fontWeight: '700', color: '#0E7490' }}>{it.make}</td>
                        <td style={{ padding: '8px 10px', textAlign: 'center', fontWeight: '800', color: '#2563EB' }}>{it.qty * safeSetCount}</td>
                        <td style={{ padding: '8px 10px', textAlign: 'center', color: '#64748B' }}>{it.uom}</td>
                        <td style={{ padding: '8px 10px', textAlign: 'right', color: '#334155' }}>
                          ₹{it.rate.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </td>
                        <td style={{ padding: '8px 10px', textAlign: 'right', fontWeight: '800', color: '#0F172A' }}>
                          ₹{(it.amount * safeSetCount).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Sticky Bottom Actions Bar */}
          <div style={{
            padding: '12px 28px',
            backgroundColor: '#FFFFFF',
            borderTop: '2px solid #E2E8F0',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '16px',
            boxShadow: '0 -4px 16px rgba(0,0,0,0.04)',
            position: 'sticky',
            bottom: 0,
            zIndex: 20
          }}>
            {/* Left Stats */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '18px', flexShrink: 0 }}>
              <div>
                <div style={{ fontSize: '10px', color: '#64748B', fontWeight: '700', textTransform: 'uppercase' }}>Total Capacity</div>
                <div style={{ fontSize: '14px', fontWeight: '900', color: '#0F172A' }}>{totalQuotedKw} kW DC</div>
              </div>
              <div>
                <div style={{ fontSize: '10px', color: '#64748B', fontWeight: '700', textTransform: 'uppercase' }}>Price per kW</div>
                <div style={{ fontSize: '14px', fontWeight: '900', color: '#0284C7' }}>₹{calcResult.perKwRate.toLocaleString('en-IN')}</div>
              </div>
              <div>
                <div style={{ fontSize: '10px', color: '#64748B', fontWeight: '700', textTransform: 'uppercase' }}>Total Quoted Price</div>
                <div style={{ fontSize: '17px', fontWeight: '900', color: '#059669' }}>
                  ₹{totalQuotedAmount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </div>
              </div>
            </div>

            {/* Center: Quotation Scope Radio Selector */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '14px',
              backgroundColor: '#F8FAFC',
              padding: '8px 16px',
              borderRadius: '10px',
              border: '1px solid #E2E8F0',
              whiteSpace: 'nowrap',
              flexShrink: 0
            }}>
              <span style={{ fontSize: '12px', fontWeight: '700', color: '#475569', whiteSpace: 'nowrap' }}>
                Quotation Scope:
              </span>
              <label style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                fontSize: '12px',
                fontWeight: '700',
                color: insertionMode === 'group' ? '#0E7490' : '#475569',
                cursor: 'pointer',
                whiteSpace: 'nowrap'
              }}>
                <input
                  type="radio"
                  name="surya_cfg_insertion_mode"
                  checked={insertionMode === 'group'}
                  onChange={() => setInsertionMode('group')}
                  style={{ accentColor: '#0E7490', cursor: 'pointer' }}
                />
                Preset Kit (₹{Math.round(calcResult.perKitAmount).toLocaleString('en-IN')}/Set)
              </label>
              <label style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                fontSize: '12px',
                fontWeight: '700',
                color: insertionMode === 'itemized' ? '#0E7490' : '#475569',
                cursor: 'pointer',
                whiteSpace: 'nowrap'
              }}>
                <input
                  type="radio"
                  name="surya_cfg_insertion_mode"
                  checked={insertionMode === 'itemized'}
                  onChange={() => setInsertionMode('itemized')}
                  style={{ accentColor: '#0E7490', cursor: 'pointer' }}
                />
                Itemized Line Items
              </label>
            </div>

            {/* Right Actions */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexShrink: 0 }}>
              <button
                type="button"
                onClick={onClose}
                style={{
                  padding: '10px 18px',
                  backgroundColor: '#F1F5F9',
                  border: '1px solid #CBD5E1',
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
                type="button"
                disabled={!isFormValid}
                onClick={handleApply}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '10px 22px',
                  background: isFormValid ? 'linear-gradient(135deg, #059669 0%, #10B981 100%)' : '#94A3B8',
                  border: 'none',
                  borderRadius: '10px',
                  fontSize: '13.5px',
                  fontWeight: '800',
                  color: '#FFFFFF',
                  cursor: isFormValid ? 'pointer' : 'not-allowed',
                  boxShadow: isFormValid ? '0 4px 12px rgba(16, 185, 129, 0.35)' : 'none',
                  opacity: isFormValid ? 1 : 0.75,
                  transition: 'all 0.15s ease'
                }}
              >
                <Check size={16} />
                <span>
                  {isFormValid
                    ? (insertionMode === 'group'
                        ? `Apply Turnkey Kit (${safeSetCount} Kit${safeSetCount > 1 ? 's' : ''})`
                        : `Apply Itemized Items (${calcResult.items.length * safeSetCount} Lines)`)
                    : 'Enter Valid Quantities'}
                </span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
