import React, { useState, useMemo } from 'react';
import { 
  Boxes, 
  Layers, 
  Factory, 
  Wrench, 
  Download, 
  Search, 
  Filter, 
  Calendar, 
  CheckCircle2, 
  ChevronRight,
  TrendingUp,
  Package,
  Activity,
  FileSpreadsheet
} from 'lucide-react';
import { classifyKitComponent } from '../../utils/kitClassification';

export default function HrKitAnalyticsDashboard({ 
  allBomList = [], 
  selectedPeriod = 'MTD', 
  onPeriodChange, 
  matchesSelectedPeriod 
}) {
  const [activeCategoryTab, setActiveCategoryTab] = useState('ALL');
  const [selectedKitFilter, setSelectedKitFilter] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  // 1. Filter BOMs based on status (Exclude Drafts & Cancelled) and Period
  const activeBoms = useMemo(() => {
    return (allBomList || []).filter(b => {
      if (!b || b.cancelled) return false;
      const st = String(b.status || '').toLowerCase();
      if (st === 'draft' || st === 'cancelled') return false;
      if (typeof matchesSelectedPeriod === 'function' && selectedPeriod !== 'All Time') {
        return matchesSelectedPeriod(b, selectedPeriod);
      }
      return true;
    });
  }, [allBomList, selectedPeriod, matchesSelectedPeriod]);

  // 2. Aggregate Kits Sold & Itemized Component Materials
  const { kitsList, componentsList, totalKitsSold, totalKitRevenue, categoryTotals } = useMemo(() => {
    const kitMap = {};
    const compMap = {};

    activeBoms.forEach(b => {
      const bCode = b.bomCode || b.code || b.id || 'BOM';
      const cust = b.customerName || b.client || b.customer || 'Customer';

      // Aggregate Kits Sold
      let hasGroup = false;
      if (b.presetGroups && typeof b.presetGroups === 'object') {
        const grps = Array.isArray(b.presetGroups) ? b.presetGroups : Object.values(b.presetGroups);
        grps.forEach(g => {
          if (!g) return;
          hasGroup = true;
          const pName = String(g.presetName || g.name || 'Solar MMS Kit').trim();
          const sCount = parseFloat(g.setCount || g.quantity || 1) || 1;
          const kPrice = parseFloat(g.kitPrice || g.price || 0) || 0;
          const totalVal = parseFloat(g.groupTotal || g.groupSubtotal || (kPrice * sCount)) || (kPrice * sCount);

          if (!kitMap[pName]) {
            kitMap[pName] = {
              presetName: pName,
              totalSetsSold: 0,
              totalRevenue: 0,
              bomsCount: 0,
              bomCodes: new Set(),
              customers: new Set()
            };
          }
          kitMap[pName].totalSetsSold += sCount;
          kitMap[pName].totalRevenue += totalVal;
          kitMap[pName].bomsCount += 1;
          kitMap[pName].bomCodes.add(bCode);
          kitMap[pName].customers.add(cust);
        });
      }

      if (!hasGroup && (b.presetName || b.selectedPreset)) {
        const pName = String(b.presetName || b.selectedPreset || 'Solar MMS Kit').trim();
        const sCount = parseFloat(b.setCount || b.quantity || 1) || 1;
        const totalVal = parseFloat(b.grandTotal || b.presetKitPrice || b.amount || 0) || 0;

        if (!kitMap[pName]) {
          kitMap[pName] = {
            presetName: pName,
            totalSetsSold: 0,
            totalRevenue: 0,
            bomsCount: 0,
            bomCodes: new Set(),
            customers: new Set()
          };
        }
        kitMap[pName].totalSetsSold += sCount;
        kitMap[pName].totalRevenue += totalVal;
        kitMap[pName].bomsCount += 1;
        kitMap[pName].bomCodes.add(bCode);
        kitMap[pName].customers.add(cust);
      }

      // Aggregate Components
      const mats = Array.isArray(b.materials) ? b.materials : (Array.isArray(b.items) ? b.items : []);
      mats.forEach(m => {
        if (!m) return;
        const mName = String(m.name || m.productName || m.item || '').trim();
        if (!mName) return;
        const q = parseFloat(m.qty || m.quantity || 0) || 0;
        const rawUom = String(m.uom || m.unit || 'NOS').trim().toUpperCase();
        const category = classifyKitComponent(mName);
        const pName = String(m.presetName || b.presetName || 'MMS Kit').trim();

        if (!compMap[mName]) {
          compMap[mName] = {
            name: mName,
            category,
            totalQty: 0,
            uom: rawUom,
            bomsCount: 0,
            kitPresets: new Set(),
            bomCodes: new Set()
          };
        }
        compMap[mName].totalQty += q;
        compMap[mName].bomsCount += 1;
        compMap[mName].kitPresets.add(pName);
        compMap[mName].bomCodes.add(bCode);
      });
    });

    const kits = Object.values(kitMap).map(k => ({
      ...k,
      bomCodes: Array.from(k.bomCodes),
      customers: Array.from(k.customers)
    })).sort((a, b) => b.totalSetsSold - a.totalSetsSold);

    const components = Object.values(compMap).map(c => ({
      ...c,
      kitPresets: Array.from(c.kitPresets),
      bomCodes: Array.from(c.bomCodes)
    })).sort((a, b) => b.totalQty - a.totalQty);

    const totalKits = kits.reduce((acc, k) => acc + k.totalSetsSold, 0);
    const totalRev = kits.reduce((acc, k) => acc + k.totalRevenue, 0);

    const catTotals = {
      Structures: components.filter(c => c.category === 'Structures').reduce((acc, c) => acc + c.totalQty, 0),
      Aluminum: components.filter(c => c.category === 'Aluminum').reduce((acc, c) => acc + c.totalQty, 0),
      Fasteners: components.filter(c => c.category === 'Fasteners & Hardware').reduce((acc, c) => acc + c.totalQty, 0),
      Accessories: components.filter(c => c.category === 'Accessories & Others').reduce((acc, c) => acc + c.totalQty, 0)
    };

    return {
      kitsList: kits,
      componentsList: components,
      totalKitsSold: totalKits,
      totalKitRevenue: totalRev,
      categoryTotals: catTotals
    };
  }, [activeBoms]);

  // 3. Filter Components by Category, Kit Preset & Search Query
  const filteredComponents = useMemo(() => {
    return componentsList.filter(c => {
      // Category filter
      if (activeCategoryTab === 'STRUCTURES' && c.category !== 'Structures') return false;
      if (activeCategoryTab === 'ALUMINUM' && c.category !== 'Aluminum') return false;
      if (activeCategoryTab === 'FASTENERS' && c.category !== 'Fasteners & Hardware') return false;
      if (activeCategoryTab === 'ACCESSORIES' && c.category !== 'Accessories & Others') return false;

      // Kit Preset filter
      if (selectedKitFilter !== 'ALL' && !c.kitPresets.includes(selectedKitFilter)) return false;

      // Search Query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesName = c.name.toLowerCase().includes(q);
        const matchesCat = c.category.toLowerCase().includes(q);
        const matchesKits = c.kitPresets.some(k => k.toLowerCase().includes(q));
        if (!matchesName && !matchesCat && !matchesKits) return false;
      }

      return true;
    });
  }, [componentsList, activeCategoryTab, selectedKitFilter, searchQuery]);

  // CSV Exporter for HR reporting
  const handleExportCsv = () => {
    const rows = [
      ['Component Name', 'Category', 'Total Qty Sold', 'UOM', 'Kits Used In', 'BOM Orders Count']
    ];

    filteredComponents.forEach(c => {
      rows.push([
        `"${c.name.replace(/"/g, '""')}"`,
        `"${c.category}"`,
        c.totalQty,
        `"${c.uom}"`,
        `"${c.kitPresets.join('; ').replace(/"/g, '""')}"`,
        c.bomsCount
      ]);
    });

    const csvContent = 'data:text/csv;charset=utf-8,' + rows.map(e => e.join(',')).join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `HR_MMS_Kit_Component_Breakdown_${selectedPeriod}_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '18px', width: '100%', boxSizing: 'border-box' }}>
      
      {/* ─── HEADER BAR WITH PERIOD SELECTOR ─── */}
      <div style={{
        backgroundColor: '#FFFFFF',
        borderRadius: '16px',
        padding: '18px 22px',
        border: '1px solid #E2E8F0',
        boxShadow: '0 2px 8px rgba(0,0,0,0.03)',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: '14px'
      }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div style={{
              width: '36px', height: '36px', borderRadius: '10px',
              backgroundColor: '#ECFEFF', color: '#0E7490',
              display: 'flex', alignItems: 'center', justifyContent: 'center'
            }}>
              <Boxes size={20} />
            </div>
            <div>
              <h2 style={{ fontSize: '18px', fontWeight: '800', color: '#0F172A', margin: 0 }}>
                MMS Kit Sales & Component Breakdown
              </h2>
              <p style={{ fontSize: '12px', color: '#64748B', margin: '2px 0 0 0' }}>
                Itemized analysis of Solar MMS Kits sold, separating <strong>Structures</strong>, <strong>Aluminum</strong>, and <strong>Fasteners</strong>.
              </p>
            </div>
          </div>
        </div>

        {/* Global Controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
          {/* Period selector */}
          {onPeriodChange && (
            <div style={{
              display: 'flex',
              backgroundColor: '#F1F5F9',
              padding: '3px',
              borderRadius: '10px',
              border: '1px solid #E2E8F0',
              gap: '2px'
            }}>
              {['Today', 'This Week', 'MTD', 'Q2 FY27', 'YTD', 'All Time'].map((period) => (
                <button
                  key={period}
                  onClick={() => onPeriodChange(period)}
                  style={{
                    border: 'none',
                    backgroundColor: selectedPeriod === period ? '#0E7490' : 'transparent',
                    color: selectedPeriod === period ? '#FFFFFF' : '#475569',
                    padding: '5px 10px',
                    borderRadius: '7px',
                    fontSize: '11px',
                    fontWeight: selectedPeriod === period ? '800' : '600',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease'
                  }}
                >
                  {period}
                </button>
              ))}
            </div>
          )}

          {/* Export CSV button */}
          <button
            onClick={handleExportCsv}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '7px 14px',
              backgroundColor: '#0E7490',
              color: '#FFFFFF',
              border: 'none',
              borderRadius: '8px',
              fontSize: '12px',
              fontWeight: '700',
              cursor: 'pointer',
              boxShadow: '0 2px 6px rgba(14, 116, 144, 0.25)'
            }}
          >
            <Download size={14} />
            <span>Export CSV</span>
          </button>
        </div>
      </div>

      {/* ─── 4 CORE KPI METRIC CARDS ─── */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
        gap: '14px'
      }}>
        {/* CARD 1: KITS SOLD */}
        <div style={{
          backgroundColor: '#FFFFFF',
          borderRadius: '14px',
          padding: '16px 18px',
          border: '1px solid #E2E8F0',
          boxShadow: '0 1px 4px rgba(0,0,0,0.02)',
          display: 'flex',
          flexDirection: 'column',
          gap: '8px'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '11px', fontWeight: '800', color: '#64748B', letterSpacing: '0.4px', textTransform: 'uppercase' }}>
              TOTAL MMS KITS SOLD
            </span>
            <div style={{ width: '32px', height: '32px', borderRadius: '8px', backgroundColor: '#ECFEFF', color: '#0E7490', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Package size={17} />
            </div>
          </div>
          <div style={{ fontSize: '24px', fontWeight: '800', color: '#0F172A' }}>
            {totalKitsSold.toLocaleString()} <span style={{ fontSize: '14px', fontWeight: '600', color: '#64748B' }}>Sets</span>
          </div>
          <div style={{ fontSize: '11.5px', color: '#0E7490', fontWeight: '700' }}>
            Across {kitsList.length} Unique Kit Presets ({activeBoms.length} Orders)
          </div>
        </div>

        {/* CARD 2: STRUCTURES */}
        <div style={{
          backgroundColor: '#FFFFFF',
          borderRadius: '14px',
          padding: '16px 18px',
          border: '1px solid #E2E8F0',
          boxShadow: '0 1px 4px rgba(0,0,0,0.02)',
          display: 'flex',
          flexDirection: 'column',
          gap: '8px'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '11px', fontWeight: '800', color: '#64748B', letterSpacing: '0.4px', textTransform: 'uppercase' }}>
              🏗️ STRUCTURES (LEGS / RAFTERS / PURLINS)
            </span>
            <div style={{ width: '32px', height: '32px', borderRadius: '8px', backgroundColor: '#EFF6FF', color: '#2563EB', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Layers size={17} />
            </div>
          </div>
          <div style={{ fontSize: '24px', fontWeight: '800', color: '#0F172A' }}>
            {categoryTotals.Structures.toLocaleString()} <span style={{ fontSize: '14px', fontWeight: '600', color: '#64748B' }}>Components</span>
          </div>
          <div style={{ fontSize: '11.5px', color: '#2563EB', fontWeight: '700' }}>
            Columns, Legs, Rafters, Hat Purlins & Base Plates
          </div>
        </div>

        {/* CARD 3: ALUMINUM */}
        <div style={{
          backgroundColor: '#FFFFFF',
          borderRadius: '14px',
          padding: '16px 18px',
          border: '1px solid #E2E8F0',
          boxShadow: '0 1px 4px rgba(0,0,0,0.02)',
          display: 'flex',
          flexDirection: 'column',
          gap: '8px'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '11px', fontWeight: '800', color: '#64748B', letterSpacing: '0.4px', textTransform: 'uppercase' }}>
              ⚙️ ALUMINUM (MID / END CLAMPS / RAILS)
            </span>
            <div style={{ width: '32px', height: '32px', borderRadius: '8px', backgroundColor: '#ECFDF5', color: '#059669', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Factory size={17} />
            </div>
          </div>
          <div style={{ fontSize: '24px', fontWeight: '800', color: '#0F172A' }}>
            {categoryTotals.Aluminum.toLocaleString()} <span style={{ fontSize: '14px', fontWeight: '600', color: '#64748B' }}>Components</span>
          </div>
          <div style={{ fontSize: '11.5px', color: '#059669', fontWeight: '700' }}>
            Universal Mid Clamps, End Clamps & Aluminum Rails
          </div>
        </div>

        {/* CARD 4: FASTENERS & HARDWARE */}
        <div style={{
          backgroundColor: '#FFFFFF',
          borderRadius: '14px',
          padding: '16px 18px',
          border: '1px solid #E2E8F0',
          boxShadow: '0 1px 4px rgba(0,0,0,0.02)',
          display: 'flex',
          flexDirection: 'column',
          gap: '8px'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '11px', fontWeight: '800', color: '#64748B', letterSpacing: '0.4px', textTransform: 'uppercase' }}>
              🔩 FASTENERS (SS304 / GI BOLTS / NUTS)
            </span>
            <div style={{ width: '32px', height: '32px', borderRadius: '8px', backgroundColor: '#FAF5FF', color: '#9333EA', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Wrench size={17} />
            </div>
          </div>
          <div style={{ fontSize: '24px', fontWeight: '800', color: '#0F172A' }}>
            {categoryTotals.Fasteners.toLocaleString()} <span style={{ fontSize: '14px', fontWeight: '600', color: '#64748B' }}>Fasteners</span>
          </div>
          <div style={{ fontSize: '11.5px', color: '#9333EA', fontWeight: '700' }}>
            SS304 Allen & Hex Bolts, GI Anchors, T-Nuts & Washers
          </div>
        </div>
      </div>

      {/* ─── KIT PRESETS SALES BREAKDOWN TABLE ─── */}
      <div style={{
        backgroundColor: '#FFFFFF',
        borderRadius: '16px',
        padding: '20px',
        border: '1px solid #E2E8F0',
        boxShadow: '0 2px 8px rgba(0,0,0,0.03)'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px', flexWrap: 'wrap', gap: '10px' }}>
          <div>
            <h3 style={{ fontSize: '15px', fontWeight: '800', color: '#0F172A', margin: 0 }}>
              Kits Sold Summary by Preset Model
            </h3>
            <p style={{ fontSize: '12px', color: '#64748B', margin: '2px 0 0 0' }}>
              Select any kit preset to instantly view and isolate its component breakdown below.
            </p>
          </div>
          {selectedKitFilter !== 'ALL' && (
            <button
              onClick={() => setSelectedKitFilter('ALL')}
              style={{
                fontSize: '11px', fontWeight: '700', color: '#0E7490',
                backgroundColor: '#ECFEFF', border: '1px solid #BAE6FD',
                padding: '4px 10px', borderRadius: '6px', cursor: 'pointer'
              }}
            >
              Clear Filter (Showing All Kits)
            </button>
          )}
        </div>

        {kitsList.length === 0 ? (
          <div style={{ padding: '36px 20px', textAlign: 'center', color: '#94A3B8' }}>
            <Package size={36} style={{ margin: '0 auto 10px auto', opacity: 0.5 }} />
            <div style={{ fontWeight: '700', fontSize: '14px' }}>No Kit Orders Found in {selectedPeriod}</div>
            <div style={{ fontSize: '12px', marginTop: '4px' }}>Try switching the date period to "All Time" to view historical records.</div>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
              <thead>
                <tr style={{ backgroundColor: '#F8FAFC', borderBottom: '1px solid #E2E8F0', color: '#475569', fontWeight: '700', fontSize: '11px', textTransform: 'uppercase' }}>
                  <th style={{ padding: '10px 14px', textAlign: 'left' }}>KIT MODEL / PRESET NAME</th>
                  <th style={{ padding: '10px 14px', textAlign: 'center' }}>TOTAL SETS SOLD</th>
                  <th style={{ padding: '10px 14px', textAlign: 'right' }}>REVENUE GENERATED</th>
                  <th style={{ padding: '10px 14px', textAlign: 'center' }}>BOM ORDERS</th>
                  <th style={{ padding: '10px 14px', textAlign: 'center' }}>ACTION</th>
                </tr>
              </thead>
              <tbody>
                {kitsList.map((k, idx) => {
                  const isSelected = selectedKitFilter === k.presetName;
                  return (
                    <tr 
                      key={idx} 
                      style={{ 
                        borderBottom: '1px solid #F1F5F9',
                        backgroundColor: isSelected ? '#ECFEFF' : (idx % 2 === 0 ? '#FFFFFF' : '#FBFCFD'),
                        borderLeft: isSelected ? '4px solid #0E7490' : 'none',
                        transition: 'background-color 0.15s ease'
                      }}
                    >
                      <td style={{ padding: '11px 14px', fontWeight: '700', color: isSelected ? '#0E7490' : '#0F172A' }}>
                        {k.presetName}
                      </td>
                      <td style={{ padding: '11px 14px', textAlign: 'center' }}>
                        <span style={{
                          backgroundColor: '#EFF6FF', color: '#1D4ED8',
                          padding: '3px 10px', borderRadius: '12px',
                          fontWeight: '800', fontSize: '12px'
                        }}>
                          {k.totalSetsSold} Sets
                        </span>
                      </td>
                      <td style={{ padding: '11px 14px', textAlign: 'right', fontWeight: '700', color: '#0F172A' }}>
                        ₹{k.totalRevenue.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>
                      <td style={{ padding: '11px 14px', textAlign: 'center', color: '#64748B' }}>
                        {k.bomsCount} Orders
                      </td>
                      <td style={{ padding: '11px 14px', textAlign: 'center' }}>
                        <button
                          onClick={() => setSelectedKitFilter(isSelected ? 'ALL' : k.presetName)}
                          style={{
                            padding: '4px 10px',
                            borderRadius: '6px',
                            fontSize: '11px',
                            fontWeight: '700',
                            border: isSelected ? '1px solid #0E7490' : '1px solid #CBD5E1',
                            backgroundColor: isSelected ? '#0E7490' : '#FFFFFF',
                            color: isSelected ? '#FFFFFF' : '#0E7490',
                            cursor: 'pointer',
                            transition: 'all 0.15s ease'
                          }}
                        >
                          {isSelected ? 'Viewing Components ✓' : 'Inspect Components ›'}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ─── COMPONENT MATERIALS SEPARATION SECTION ─── */}
      <div style={{
        backgroundColor: '#FFFFFF',
        borderRadius: '16px',
        padding: '20px',
        border: '1px solid #E2E8F0',
        boxShadow: '0 2px 8px rgba(0,0,0,0.03)'
      }}>
        {/* Title + Filter Tabs + Search */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', marginBottom: '16px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
            <div>
              <h3 style={{ fontSize: '15px', fontWeight: '800', color: '#0F172A', margin: 0 }}>
                Inside the Kit: Itemized Component Separation
              </h3>
              <p style={{ fontSize: '12px', color: '#64748B', margin: '2px 0 0 0' }}>
                {selectedKitFilter === 'ALL' 
                  ? 'Showing materials across all kits sold in the selected period.' 
                  : `Filtered strictly for kit: "${selectedKitFilter}".`}
              </p>
            </div>

            {/* Live Search */}
            <div style={{ position: 'relative', width: '260px' }}>
              <Search size={15} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: '#94A3B8' }} />
              <input
                type="text"
                placeholder="Search component name..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{
                  width: '100%',
                  height: '34px',
                  paddingLeft: '32px',
                  paddingRight: '12px',
                  borderRadius: '8px',
                  border: '1px solid #CBD5E1',
                  fontSize: '12px',
                  outline: 'none',
                  boxSizing: 'border-box'
                }}
              />
            </div>
          </div>

          {/* Category Tabs */}
          <div style={{
            display: 'flex',
            borderBottom: '2px solid #F1F5F9',
            gap: '8px',
            overflowX: 'auto',
            paddingBottom: '2px'
          }}>
            {[
              { id: 'ALL', label: 'All Components', count: componentsList.length },
              { id: 'STRUCTURES', label: '🏗️ Structures', count: componentsList.filter(c => c.category === 'Structures').length },
              { id: 'ALUMINUM', label: '⚙️ Aluminum', count: componentsList.filter(c => c.category === 'Aluminum').length },
              { id: 'FASTENERS', label: '🔩 Fasteners & Hardware', count: componentsList.filter(c => c.category === 'Fasteners & Hardware').length },
              { id: 'ACCESSORIES', label: '📦 Accessories', count: componentsList.filter(c => c.category === 'Accessories & Others').length }
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveCategoryTab(tab.id)}
                style={{
                  border: 'none',
                  backgroundColor: 'transparent',
                  padding: '8px 14px',
                  fontSize: '12px',
                  fontWeight: activeCategoryTab === tab.id ? '800' : '600',
                  color: activeCategoryTab === tab.id ? '#0E7490' : '#64748B',
                  borderBottom: activeCategoryTab === tab.id ? '3px solid #0E7490' : '3px solid transparent',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  whiteSpace: 'nowrap'
                }}
              >
                <span>{tab.label}</span>
                <span style={{
                  fontSize: '10px',
                  backgroundColor: activeCategoryTab === tab.id ? '#ECFEFF' : '#F1F5F9',
                  color: activeCategoryTab === tab.id ? '#0E7490' : '#64748B',
                  padding: '1px 6px',
                  borderRadius: '10px',
                  fontWeight: '700'
                }}>
                  {tab.count}
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* Components Table */}
        {filteredComponents.length === 0 ? (
          <div style={{ padding: '36px 20px', textAlign: 'center', color: '#94A3B8' }}>
            <Package size={36} style={{ margin: '0 auto 10px auto', opacity: 0.5 }} />
            <div style={{ fontWeight: '700', fontSize: '14px' }}>No Components Match the Filter</div>
            <div style={{ fontSize: '12px', marginTop: '4px' }}>Try switching category tabs or clearing your search.</div>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
              <thead>
                <tr style={{ backgroundColor: '#F8FAFC', borderBottom: '1px solid #E2E8F0', color: '#475569', fontWeight: '700', fontSize: '11px', textTransform: 'uppercase' }}>
                  <th style={{ padding: '10px 14px', textAlign: 'left' }}>COMPONENT DESCRIPTION</th>
                  <th style={{ padding: '10px 14px', textAlign: 'left' }}>MATERIAL CATEGORY</th>
                  <th style={{ padding: '10px 14px', textAlign: 'center' }}>TOTAL QUANTITY</th>
                  <th style={{ padding: '10px 14px', textAlign: 'center' }}>UOM</th>
                  <th style={{ padding: '10px 14px', textAlign: 'left' }}>USED IN KIT PRESETS</th>
                  <th style={{ padding: '10px 14px', textAlign: 'center' }}>ORDERS COUNT</th>
                </tr>
              </thead>
              <tbody>
                {filteredComponents.map((c, idx) => {
                  let badgeBg = '#F1F5F9';
                  let badgeColor = '#475569';
                  if (c.category === 'Structures') {
                    badgeBg = '#EFF6FF';
                    badgeColor = '#1D4ED8';
                  } else if (c.category === 'Aluminum') {
                    badgeBg = '#ECFDF5';
                    badgeColor = '#047857';
                  } else if (c.category === 'Fasteners & Hardware') {
                    badgeBg = '#FAF5FF';
                    badgeColor = '#7E22CE';
                  }

                  return (
                    <tr 
                      key={idx} 
                      style={{ 
                        borderBottom: '1px solid #F1F5F9',
                        backgroundColor: idx % 2 === 0 ? '#FFFFFF' : '#FBFCFD'
                      }}
                    >
                      <td style={{ padding: '10px 14px', fontWeight: '700', color: '#0F172A' }}>
                        {c.name}
                      </td>
                      <td style={{ padding: '10px 14px' }}>
                        <span style={{
                          backgroundColor: badgeBg,
                          color: badgeColor,
                          padding: '2px 8px',
                          borderRadius: '6px',
                          fontSize: '10.5px',
                          fontWeight: '800'
                        }}>
                          {c.category}
                        </span>
                      </td>
                      <td style={{ padding: '10px 14px', textAlign: 'center', fontWeight: '800', color: '#0F172A', fontSize: '13px' }}>
                        {c.totalQty.toLocaleString()}
                      </td>
                      <td style={{ padding: '10px 14px', textAlign: 'center', fontWeight: '600', color: '#64748B' }}>
                        {c.uom || 'NOS'}
                      </td>
                      <td style={{ padding: '10px 14px', color: '#475569', fontSize: '11px', maxWidth: '300px' }}>
                        {c.kitPresets.slice(0, 3).join(', ')}
                        {c.kitPresets.length > 3 ? ` +${c.kitPresets.length - 3} more` : ''}
                      </td>
                      <td style={{ padding: '10px 14px', textAlign: 'center', color: '#64748B', fontWeight: '600' }}>
                        {c.bomsCount} Orders
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
  );
}
