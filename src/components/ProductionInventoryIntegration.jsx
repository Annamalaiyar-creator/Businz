import React, { useState } from 'react';
import { 
  Package, Layers, Cpu, CheckCircle2, AlertTriangle, ArrowRight,
  Scale, Plus, Truck, History, ChevronRight, Box, Activity,
  BarChart3, Warehouse, CircleDot
} from 'lucide-react';
import { prodInventoryStore, BOM_REGISTRY } from '../utils/productionInventoryStore';
import StatusBadge from './StatusBadge';

/* ─── Shared Style Constants ─── */
const CARD = {
  background: '#fff', borderRadius: '12px', border: '1px solid #e2e8f0',
  boxSizing: 'border-box', width: '100%', maxWidth: '100%', minWidth: 0,
};
const INPUT_STYLE = {
  height: '36px', border: '1px solid #cbd5e1', borderRadius: '6px',
  padding: '0 8px', fontSize: '13px', outline: 'none',
  transition: 'border-color 0.15s', boxSizing: 'border-box',
};

const STEPS = [
  { id: 'WORK_ORDERS', num: '1', label: 'Production Orders', sub: 'Plan & Requirements', icon: Layers, color: '#6366F1' },
  { id: 'MATERIAL_ISSUE', num: '2', label: 'Material Issue', sub: 'Stock Deduction', icon: Truck, color: '#2563EB' },
  { id: 'ACTUAL_CONSUMPTION', num: '3', label: 'Consumption', sub: 'Planned vs Actual', icon: Scale, color: '#D97706' },
  { id: 'OUTPUT_POSTING', num: '4', label: 'Output Posting', sub: 'FG, Scrap & Returns', icon: CheckCircle2, color: '#16A34A' },
  { id: 'ITEM_MASTER', num: '', label: 'Item Master', sub: 'Stock Balances', icon: Package, color: '#64748B' },
  { id: 'AUDIT_LEDGER', num: '', label: 'Audit Ledger', sub: 'Stock Movements', icon: History, color: '#64748B' },
];

export default function ProductionInventoryIntegration({ onNavigateToCalcEngine }) {
  const [activeTab, setActiveTab] = useState('WORK_ORDERS');
  const [refreshKey, setRefreshKey] = useState(0);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedBomCode, setSelectedBomCode] = useState('BOM-TRIANGLE-001');
  const [orderQty, setOrderQty] = useState(100);
  const [selectedWoId, setSelectedWoId] = useState('VRM-WO-2026-01');
  const [actualListState, setActualListState] = useState([]);
  const [outputAcceptedQty, setOutputAcceptedQty] = useState(98);
  const [outputRejectedQty, setOutputRejectedQty] = useState(2);
  const [outputScrapKg, setOutputScrapKg] = useState(8.5);
  const [outputReusableQty, setOutputReusableQty] = useState(1);

  const forceRefresh = () => setRefreshKey(prev => prev + 1);
  const itemMaster = prodInventoryStore.getItemMaster();
  const workOrders = prodInventoryStore.getWorkOrders();
  const ledger = prodInventoryStore.getLedger();
  const activeWo = workOrders.find(w => w.id === selectedWoId) || workOrders[0];
  const liveReq = prodInventoryStore.calculateRequirement(selectedBomCode, orderQty);

  const switchTab = (tabId) => {
    setActiveTab(tabId);
    if (tabId === 'ACTUAL_CONSUMPTION' && activeWo) {
      setActualListState(activeWo.plannedMaterials.map(m => ({
        itemCode: m.itemCode, itemName: m.itemName,
        plannedQty: m.plannedQty, actualQty: m.issuedQty || m.plannedQty,
        reason: 'Normal shift consumption', uom: m.uom
      })));
    }
  };

  /* ─── Standard Status Badge Renderer ─── */
  const renderStatusBadge = (status) => {
    const cleanStatus = status ? status.replace(/^[✓⚠️]\s*/, '') : '';
    return <StatusBadge status={cleanStatus} size="sm" />;
  };

  /* ─── KPI Summary Cards ─── */
  const totalRawStock = itemMaster.filter(i => i.category === 'Raw Material' || i.category === 'Component').reduce((s, i) => s + i.stock, 0);
  const totalFGStock = itemMaster.filter(i => i.category === 'Finished Goods').reduce((s, i) => s + i.stock, 0);
  const totalScrap = itemMaster.filter(i => i.category === 'Scrap').reduce((s, i) => s + i.stock, 0);
  const activeOrders = workOrders.filter(w => !w.status.includes('Closed')).length;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', width: '100%', maxWidth: '100%', minWidth: 0, boxSizing: 'border-box', fontFamily: "'DM Sans', sans-serif" }}>

      {/* VISUAL WORKFLOW PIPELINE + ACTION BUTTONS */}
      <div style={{ ...CARD, padding: '16px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flexWrap: 'wrap' }}>
          {STEPS.map((step, idx) => {
            const SIcon = step.icon;
            const isActive = activeTab === step.id;
            const isWorkflowStep = !!step.num;
            return (
              <React.Fragment key={step.id}>
                {idx > 0 && idx <= 3 && <ChevronRight style={{ width: '16px', height: '16px', color: '#CBD5E1', flexShrink: 0 }} />}
                {idx === 4 && <div style={{ width: '1px', height: '32px', backgroundColor: '#E2E8F0', margin: '0 8px', flexShrink: 0 }} />}
                <button
                  onClick={() => switchTab(step.id)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '8px',
                    padding: '8px 14px', borderRadius: '10px', border: 'none', cursor: 'pointer',
                    background: isActive ? (isWorkflowStep ? step.color : '#F1F5F9') : 'transparent',
                    transition: 'all 0.2s ease',
                  }}
                >
                  {isWorkflowStep && (
                    <div style={{
                      width: '22px', height: '22px', borderRadius: '50%', fontSize: '11px', fontWeight: 800,
                      display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                      backgroundColor: isActive ? 'rgba(255,255,255,0.25)' : '#F1F5F9',
                      color: isActive ? '#fff' : '#64748B',
                    }}>
                      {step.num}
                    </div>
                  )}
                  {!isWorkflowStep && <SIcon style={{ width: '14px', height: '14px', color: isActive ? '#0F172A' : '#94A3B8', flexShrink: 0 }} />}
                  <div style={{ textAlign: 'left' }}>
                    <div style={{ fontSize: '12px', fontWeight: 700, color: isActive ? (isWorkflowStep ? '#fff' : '#0F172A') : '#475569', whiteSpace: 'nowrap' }}>{step.label}</div>
                    <div style={{ fontSize: '10px', fontWeight: 500, color: isActive ? (isWorkflowStep ? 'rgba(255,255,255,0.75)' : '#94A3B8') : '#94A3B8', whiteSpace: 'nowrap' }}>{step.sub}</div>
                  </div>
                </button>
              </React.Fragment>
            );
          })}
        </div>

        <div style={{ display: 'flex', gap: '8px', flexShrink: 0 }}>
          {onNavigateToCalcEngine && (
            <button onClick={onNavigateToCalcEngine} style={{ border: '1px solid #E2E8F0', background: '#fff', color: '#475569', padding: '8px 14px', borderRadius: '10px', fontSize: '12px', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', transition: 'all 0.15s' }}>
              <Cpu style={{ width: '14px', height: '14px', color: '#6366F1' }} />
              Calc Engine
            </button>
          )}
          <button onClick={() => setShowCreateModal(true)} style={{ background: '#6366F1', color: '#fff', border: 'none', padding: '8px 16px', borderRadius: '10px', fontSize: '12px', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', boxShadow: '0 1px 3px rgba(99,102,241,0.3)', transition: 'all 0.15s' }}>
            <Plus style={{ width: '14px', height: '14px' }} />
            New Order
          </button>
        </div>
      </div>


      {/* STEP 1 — PRODUCTION ORDERS & REQUIREMENTS */}
      {activeTab === 'WORK_ORDERS' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>

          {/* Orders Table Card */}
          <div className="section-card" style={{ padding: 0, overflowX: 'auto', width: '100%', boxSizing: 'border-box' }}>
            <div style={{ padding: '16px 20px', borderBottom: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <h3 style={{ fontSize: '14px', fontWeight: 'bold', color: '#1e293b', margin: 0 }}>Active Production Orders</h3>
              <span style={{ fontSize: '12px', fontWeight: '600', backgroundColor: '#f1f5f9', color: '#475569', padding: '2px 8px', borderRadius: '10px' }}>
                {workOrders.length} Orders
              </span>
            </div>

            <table className="custom-table" style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
              <thead>
                <tr style={{ backgroundColor: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                  <th style={{ padding: '12px 16px', textAlign: 'left', color: '#475569', fontWeight: '600', whiteSpace: 'nowrap' }}>Order ID</th>
                  <th style={{ padding: '12px 16px', textAlign: 'left', color: '#475569', fontWeight: '600', whiteSpace: 'nowrap' }}>Target Product</th>
                  <th style={{ padding: '12px 16px', textAlign: 'left', color: '#475569', fontWeight: '600', whiteSpace: 'nowrap' }}>Planned Qty</th>
                  <th style={{ padding: '12px 16px', textAlign: 'left', color: '#475569', fontWeight: '600', whiteSpace: 'nowrap' }}>BOM Code</th>
                  <th style={{ padding: '12px 16px', textAlign: 'left', color: '#475569', fontWeight: '600', whiteSpace: 'nowrap' }}>Status</th>
                  <th style={{ padding: '12px 16px', textAlign: 'center', color: '#475569', fontWeight: '600', width: '120px', whiteSpace: 'nowrap' }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {workOrders.map((wo, idx) => {
                  const isSel = selectedWoId === wo.id;
                  return (
                    <tr 
                      key={wo.id} 
                      onClick={() => setSelectedWoId(wo.id)} 
                      style={{ 
                        borderBottom: idx === workOrders.length - 1 ? 'none' : '1px solid #f1f5f9', 
                        backgroundColor: isSel ? '#f8fafc' : 'transparent',
                        cursor: 'pointer' 
                      }}
                    >
                      <td style={{ padding: '14px 16px', fontWeight: 'bold', color: '#2563eb', whiteSpace: 'nowrap' }}>{wo.id}</td>
                      <td style={{ padding: '14px 16px', fontWeight: '500', color: '#1e293b', whiteSpace: 'nowrap' }}>{wo.productName}</td>
                      <td style={{ padding: '14px 16px', color: '#334155', fontWeight: 'bold', whiteSpace: 'nowrap' }}>{wo.plannedQty} Nos</td>
                      <td style={{ padding: '14px 16px', color: '#64748b', whiteSpace: 'nowrap' }}>{wo.bomCode}</td>
                      <td style={{ padding: '14px 16px', whiteSpace: 'nowrap' }}>
                        {renderStatusBadge(wo.status)}
                      </td>
                      <td style={{ padding: '14px 16px', textAlign: 'center', whiteSpace: 'nowrap' }}>
                        <button 
                          onClick={(e) => { e.stopPropagation(); setSelectedWoId(wo.id); switchTab('MATERIAL_ISSUE'); }} 
                          style={{ border: '1px solid #cbd5e1', background: 'white', padding: '5px 12px', borderRadius: '6px', fontSize: '12px', fontWeight: 'bold', color: '#2563eb', cursor: 'pointer' }}
                        >
                          Process Order ➔
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Material Requirements Table Card */}
          {activeWo && (
            <div className="section-card" style={{ padding: 0, overflowX: 'auto', width: '100%', boxSizing: 'border-box' }}>
              <div style={{ padding: '16px 20px', borderBottom: '1px solid #e2e8f0' }}>
                <h3 style={{ fontSize: '14px', fontWeight: 'bold', color: '#1e293b', margin: 0 }}>
                  Material Requirements Breakdown — {activeWo.id}
                </h3>
                <p style={{ fontSize: '12px', color: '#64748b', margin: '4px 0 0 0' }}>
                  {activeWo.productName} × {activeWo.plannedQty} Nos (BOM: {activeWo.bomCode})
                </p>
              </div>

              <table className="custom-table" style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                <thead>
                  <tr style={{ backgroundColor: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                    <th style={{ padding: '12px 16px', textAlign: 'left', color: '#475569', fontWeight: '600', whiteSpace: 'nowrap' }}>Item Code</th>
                    <th style={{ padding: '12px 16px', textAlign: 'left', color: '#475569', fontWeight: '600', whiteSpace: 'nowrap' }}>Component Name</th>
                    <th style={{ padding: '12px 16px', textAlign: 'left', color: '#475569', fontWeight: '600', whiteSpace: 'nowrap' }}>Required Qty</th>
                    <th style={{ padding: '12px 16px', textAlign: 'left', color: '#475569', fontWeight: '600', whiteSpace: 'nowrap' }}>Available Stock</th>
                    <th style={{ padding: '12px 16px', textAlign: 'left', color: '#475569', fontWeight: '600', whiteSpace: 'nowrap' }}>Shortage</th>
                    <th style={{ padding: '12px 16px', textAlign: 'left', color: '#475569', fontWeight: '600', whiteSpace: 'nowrap' }}>Stock After Issue</th>
                    <th style={{ padding: '12px 16px', textAlign: 'center', color: '#475569', fontWeight: '600', whiteSpace: 'nowrap' }}>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {activeWo.plannedMaterials.map((m, idx) => {
                    const item = itemMaster.find(i => i.code === m.itemCode);
                    const avail = item ? item.stock : 0;
                    const shortage = Math.max(0, m.plannedQty - avail);
                    const remaining = avail - m.plannedQty;
                    return (
                      <tr key={idx} style={{ borderBottom: idx === activeWo.plannedMaterials.length - 1 ? 'none' : '1px solid #f1f5f9' }}>
                        <td style={{ padding: '14px 16px', fontWeight: 'bold', color: '#2563eb', whiteSpace: 'nowrap' }}>{m.itemCode}</td>
                        <td style={{ padding: '14px 16px', fontWeight: '500', color: '#1e293b', whiteSpace: 'nowrap' }}>{m.itemName}</td>
                        <td style={{ padding: '14px 16px', fontWeight: 'bold', color: '#1e293b', whiteSpace: 'nowrap' }}>{m.plannedQty} {m.uom}</td>
                        <td style={{ padding: '14px 16px', fontWeight: 'bold', color: '#16a34a', whiteSpace: 'nowrap' }}>{avail} {m.uom}</td>
                        <td style={{ padding: '14px 16px', fontWeight: 'bold', color: shortage > 0 ? '#dc2626' : '#64748b', whiteSpace: 'nowrap' }}>
                          {shortage > 0 ? `${shortage} ${m.uom}` : '0'}
                        </td>
                        <td style={{ padding: '14px 16px', color: '#475569', whiteSpace: 'nowrap' }}>{remaining} {m.uom}</td>
                        <td style={{ padding: '14px 16px', textAlign: 'center', whiteSpace: 'nowrap' }}>
                          {renderStatusBadge(shortage > 0 ? 'SHORTAGE' : 'SUFFICIENT')}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}


      {/* STEP 2 — MATERIAL ISSUE */}
      {activeTab === 'MATERIAL_ISSUE' && activeWo && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={{ ...CARD, padding: '16px 20px', background: 'linear-gradient(135deg, #EFF6FF 0%, #F8FAFC 100%)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '28px', flexWrap: 'wrap' }}>
                <div>
                  <div style={{ fontSize: '10px', fontWeight: 700, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.06em' }}>ORDER</div>
                  <div style={{ fontSize: '14px', fontWeight: 700, color: '#6366F1', marginTop: '2px' }}>{activeWo.id}</div>
                </div>
                <div>
                  <div style={{ fontSize: '10px', fontWeight: 700, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.06em' }}>PRODUCT</div>
                  <div style={{ fontSize: '14px', fontWeight: 700, color: '#0F172A', marginTop: '2px' }}>{activeWo.productName}</div>
                </div>
                <div>
                  <div style={{ fontSize: '10px', fontWeight: 700, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.06em' }}>QUANTITY</div>
                  <div style={{ fontSize: '14px', fontWeight: 700, color: '#2563EB', marginTop: '2px' }}>{activeWo.plannedQty} Nos</div>
                </div>
                <div>
                  <div style={{ fontSize: '10px', fontWeight: 700, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '4px' }}>STATUS</div>
                  <StatusBadge status={activeWo.status} size="sm" />
                </div>
              </div>
              {activeWo.status !== 'Material Issued' && !activeWo.status.includes('Closed') && (
                <button onClick={() => { const r = prodInventoryStore.issueMaterial(activeWo.id); if (r.success) { alert(`Material issued for ${activeWo.id}! Stock deducted.`); forceRefresh(); } else { alert(r.message); } }}
                  style={{ background: '#2563EB', color: '#fff', border: 'none', padding: '10px 20px', borderRadius: '10px', fontSize: '13px', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', boxShadow: '0 2px 6px rgba(37,99,235,0.25)' }}>
                  <Truck style={{ width: '16px', height: '16px' }} />
                  Execute Material Issue
                </button>
              )}
            </div>
          </div>

          <div className="section-card" style={{ padding: 0, overflowX: 'auto', width: '100%', boxSizing: 'border-box' }}>
            <div style={{ padding: '16px 20px', borderBottom: '1px solid #e2e8f0' }}>
              <h3 style={{ fontSize: '14px', fontWeight: 'bold', color: '#1e293b', margin: 0 }}>Material Issue Lines</h3>
            </div>
            <table className="custom-table" style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
              <thead>
                <tr style={{ backgroundColor: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                  <th style={{ padding: '12px 16px', textAlign: 'left', color: '#475569', fontWeight: '600', whiteSpace: 'nowrap' }}>Item Code</th>
                  <th style={{ padding: '12px 16px', textAlign: 'left', color: '#475569', fontWeight: '600', whiteSpace: 'nowrap' }}>Component Description</th>
                  <th style={{ padding: '12px 16px', textAlign: 'left', color: '#475569', fontWeight: '600', whiteSpace: 'nowrap' }}>Planned Qty</th>
                  <th style={{ padding: '12px 16px', textAlign: 'left', color: '#475569', fontWeight: '600', whiteSpace: 'nowrap' }}>Issued Qty</th>
                  <th style={{ padding: '12px 16px', textAlign: 'center', color: '#475569', fontWeight: '600', whiteSpace: 'nowrap' }}>Issue Status</th>
                </tr>
              </thead>
              <tbody>
                {activeWo.plannedMaterials.map((m, idx) => (
                  <tr key={idx} style={{ borderBottom: idx === activeWo.plannedMaterials.length - 1 ? 'none' : '1px solid #f1f5f9' }}>
                    <td style={{ padding: '14px 16px', fontWeight: 'bold', color: '#2563eb', whiteSpace: 'nowrap' }}>{m.itemCode}</td>
                    <td style={{ padding: '14px 16px', fontWeight: '500', color: '#1e293b', whiteSpace: 'nowrap' }}>{m.itemName}</td>
                    <td style={{ padding: '14px 16px', fontWeight: 'bold', whiteSpace: 'nowrap' }}>{m.plannedQty} {m.uom}</td>
                    <td style={{ padding: '14px 16px', fontWeight: 'bold', color: m.issuedQty ? '#166534' : '#64748b', whiteSpace: 'nowrap' }}>{m.issuedQty || 0} {m.uom}</td>
                    <td style={{ padding: '14px 16px', textAlign: 'center', whiteSpace: 'nowrap' }}>
                      {renderStatusBadge(m.issuedQty ? '✓ Stock Issued' : 'Pending Issue')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}


      {/* STEP 3 — ACTUAL CONSUMPTION & VARIANCE */}
      {activeTab === 'ACTUAL_CONSUMPTION' && activeWo && (
        <div className="section-card" style={{ padding: 0, overflowX: 'auto', width: '100%', boxSizing: 'border-box' }}>
          <div style={{ padding: '16px 20px', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <h3 style={{ fontSize: '14px', fontWeight: 'bold', color: '#1e293b', margin: 0 }}>Actual Consumption — {activeWo.id}</h3>
              <p style={{ fontSize: '12px', color: '#64748b', margin: '2px 0 0 0' }}>Enter actual shop floor quantities to compute variance against BOM.</p>
            </div>
            <button onClick={() => { prodInventoryStore.recordActualConsumption(activeWo.id, actualListState); alert(`Consumption recorded for ${activeWo.id}!`); forceRefresh(); }}
              style={{ background: '#2563eb', color: '#fff', border: 'none', padding: '8px 16px', borderRadius: '6px', fontSize: '12px', fontWeight: 'bold', cursor: 'pointer' }}>
              Save Consumption
            </button>
          </div>

          <table className="custom-table" style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
            <thead>
              <tr style={{ backgroundColor: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                <th style={{ padding: '12px 16px', textAlign: 'left', color: '#475569', fontWeight: '600', whiteSpace: 'nowrap' }}>Component Item</th>
                <th style={{ padding: '12px 16px', textAlign: 'left', color: '#475569', fontWeight: '600', whiteSpace: 'nowrap' }}>Planned BOM Qty</th>
                <th style={{ padding: '12px 16px', textAlign: 'left', color: '#475569', fontWeight: '600', whiteSpace: 'nowrap' }}>Actual Consumed Qty</th>
                <th style={{ padding: '12px 16px', textAlign: 'left', color: '#475569', fontWeight: '600', whiteSpace: 'nowrap' }}>Variance (Δ)</th>
                <th style={{ padding: '12px 16px', textAlign: 'left', color: '#475569', fontWeight: '600', whiteSpace: 'nowrap' }}>Variance %</th>
                <th style={{ padding: '12px 16px', textAlign: 'left', color: '#475569', fontWeight: '600', whiteSpace: 'nowrap' }}>Reason for Variance</th>
              </tr>
            </thead>
            <tbody>
              {actualListState.map((a, idx) => {
                const diff = a.actualQty - a.plannedQty;
                const pct = a.plannedQty > 0 ? (diff / a.plannedQty) * 100 : 0;
                return (
                  <tr key={idx} style={{ borderBottom: idx === actualListState.length - 1 ? 'none' : '1px solid #f1f5f9' }}>
                    <td style={{ padding: '14px 16px', fontWeight: '500', color: '#1e293b', whiteSpace: 'nowrap' }}>{a.itemName} ({a.itemCode})</td>
                    <td style={{ padding: '14px 16px', fontWeight: 'bold', whiteSpace: 'nowrap' }}>{a.plannedQty} {a.uom}</td>
                    <td style={{ padding: '8px 12px' }}>
                      <input id="production-inventory-integration-actual-qty" name={`actualQty_${typeof i !== 'undefined' ? i : (typeof idx !== 'undefined' ? idx : 0)}`} aria-label="ActualQty" type="number" value={a.actualQty} onChange={(e) => setActualListState(prev => prev.map((x, i) => i === idx ? { ...x, actualQty: Number(e.target.value) } : x))}
                        style={INPUT_STYLE}  />
                    </td>
                    <td style={{ padding: '14px 16px', fontWeight: 'bold', color: diff > 0 ? '#dc2626' : '#16a34a', whiteSpace: 'nowrap' }}>
                      {diff > 0 ? `+${diff}` : diff} {a.uom}
                    </td>
                    <td style={{ padding: '14px 16px', fontWeight: 'bold', color: diff > 0 ? '#dc2626' : '#16a34a', whiteSpace: 'nowrap' }}>
                      {pct.toFixed(1)}%
                    </td>
                    <td style={{ padding: '8px 12px' }}>
                      <input id="production-inventory-integration-reason" name={`reason_${typeof i !== 'undefined' ? i : (typeof idx !== 'undefined' ? idx : 0)}`} aria-label="Reason" type="text" value={a.reason} onChange={(e) => setActualListState(prev => prev.map((x, i) => i === idx ? { ...x, reason: e.target.value } : x))}
                        style={{ ...INPUT_STYLE, width: '100%' }}  />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}


      {/* STEP 4 — OUTPUT, SCRAP & REUSABLE RETURNS */}
      {activeTab === 'OUTPUT_POSTING' && activeWo && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={{ ...CARD, padding: '16px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
            <div>
              <h3 style={{ fontSize: '15px', fontWeight: 700, color: '#0F172A', margin: 0 }}>Production Output — {activeWo.id}</h3>
              <p style={{ fontSize: '12px', color: '#94A3B8', margin: '2px 0 0 0' }}>Record finished goods, rejected items, scrap weight, and reusable remnants.</p>
            </div>
            <button onClick={() => { prodInventoryStore.postProductionOutput(activeWo.id, { acceptedQty: outputAcceptedQty, rejectedQty: outputRejectedQty, scrapWeightKg: outputScrapKg, reusableMaterialQty: outputReusableQty }); alert(`Output posted for ${activeWo.id}!`); forceRefresh(); }}
              style={{ background: '#16A34A', color: '#fff', border: 'none', padding: '10px 20px', borderRadius: '10px', fontSize: '13px', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', boxShadow: '0 2px 6px rgba(22,163,74,0.25)' }}>
              <CheckCircle2 style={{ width: '16px', height: '16px' }} />
              Post to Inventory
            </button>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '14px' }}>
            {[
              { label: 'Accepted Qty', sub: 'Finished Goods', val: outputAcceptedQty, set: setOutputAcceptedQty, color: '#16A34A', bg: '#F0FDF4', icon: CheckCircle2 },
              { label: 'Rejected Qty', sub: 'Quality Fail', val: outputRejectedQty, set: setOutputRejectedQty, color: '#DC2626', bg: '#FEF2F2', icon: AlertTriangle },
              { label: 'Scrap Weight', sub: 'Kg Generated', val: outputScrapKg, set: setOutputScrapKg, color: '#D97706', bg: '#FFFBEB', icon: BarChart3, step: '0.5' },
              { label: 'Reusable Qty', sub: 'Remnant Stock', val: outputReusableQty, set: setOutputReusableQty, color: '#6366F1', bg: '#EEF2FF', icon: Package },
            ].map((c, i) => {
              const CIcon = c.icon;
              return (
                <div key={i} style={{ ...CARD, padding: '20px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div style={{ width: '36px', height: '36px', borderRadius: '10px', backgroundColor: c.bg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <CIcon style={{ width: '18px', height: '18px', color: c.color }} />
                    </div>
                    <div>
                      <div style={{ fontSize: '12px', fontWeight: 700, color: '#0F172A' }}>{c.label}</div>
                      <div style={{ fontSize: '10px', color: '#94A3B8', fontWeight: 500 }}>{c.sub}</div>
                    </div>
                  </div>
                  <input id="production-inventory-integration-val" name="val" aria-label="Val" type="number" step={c.step || '1'} value={c.val} onChange={(e) => c.set(e.target.value)}
                    style={{ ...INPUT_STYLE, width: '100%', fontSize: '20px', fontWeight: 800, color: c.color, textAlign: 'center', height: '48px', borderRadius: '10px' }}  />
                </div>
              );
            })}
          </div>
        </div>
      )}


      {/* ITEM MASTER */}
      {activeTab === 'ITEM_MASTER' && (
        <div className="section-card" style={{ padding: 0, overflowX: 'auto', width: '100%', boxSizing: 'border-box' }}>
          <div style={{ padding: '16px 20px', borderBottom: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <h3 style={{ fontSize: '14px', fontWeight: 'bold', color: '#1e293b', margin: 0 }}>Central Shared Item Master & Stock Balances</h3>
            <span style={{ fontSize: '12px', fontWeight: '600', backgroundColor: '#f1f5f9', color: '#475569', padding: '2px 8px', borderRadius: '10px' }}>
              {itemMaster.length} Items
            </span>
          </div>

          <table className="custom-table" style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
            <thead>
              <tr style={{ backgroundColor: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                <th style={{ padding: '12px 16px', textAlign: 'left', color: '#475569', fontWeight: '600', whiteSpace: 'nowrap' }}>Item Code</th>
                <th style={{ padding: '12px 16px', textAlign: 'left', color: '#475569', fontWeight: '600', whiteSpace: 'nowrap' }}>Item Name</th>
                <th style={{ padding: '12px 16px', textAlign: 'left', color: '#475569', fontWeight: '600', whiteSpace: 'nowrap' }}>Category</th>
                <th style={{ padding: '12px 16px', textAlign: 'left', color: '#475569', fontWeight: '600', whiteSpace: 'nowrap' }}>Available Stock</th>
                <th style={{ padding: '12px 16px', textAlign: 'left', color: '#475569', fontWeight: '600', whiteSpace: 'nowrap' }}>Unit Rate</th>
                <th style={{ padding: '12px 16px', textAlign: 'left', color: '#475569', fontWeight: '600', whiteSpace: 'nowrap' }}>Store Location</th>
                <th style={{ padding: '12px 16px', textAlign: 'left', color: '#475569', fontWeight: '600', whiteSpace: 'nowrap' }}>Technical Specs</th>
              </tr>
            </thead>
            <tbody>
              {itemMaster.map((item, idx) => (
                <tr key={item.code} style={{ borderBottom: idx === itemMaster.length - 1 ? 'none' : '1px solid #f1f5f9' }}>
                  <td style={{ padding: '14px 16px', fontWeight: 'bold', color: '#2563eb', whiteSpace: 'nowrap' }}>{item.code}</td>
                  <td style={{ padding: '14px 16px', fontWeight: '500', color: '#1e293b', whiteSpace: 'nowrap' }}>{item.name}</td>
                  <td style={{ padding: '14px 16px', whiteSpace: 'nowrap' }}>
                    {renderStatusBadge(item.category)}
                  </td>
                  <td style={{ padding: '14px 16px', fontWeight: 'bold', color: item.stock <= item.safetyStock ? '#dc2626' : '#1e293b', whiteSpace: 'nowrap' }}>
                    {item.stock} {item.uom}
                  </td>
                  <td style={{ padding: '14px 16px', color: '#334155', whiteSpace: 'nowrap' }}>₹ {item.unitRate}</td>
                  <td style={{ padding: '14px 16px', color: '#64748b', whiteSpace: 'nowrap' }}>{item.location}</td>
                  <td style={{ padding: '14px 16px', color: '#64748b', fontSize: '12px', whiteSpace: 'nowrap' }}>{item.specs}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}


      {/* AUDIT LEDGER */}
      {activeTab === 'AUDIT_LEDGER' && (
        <div className="section-card" style={{ padding: 0, overflowX: 'auto', width: '100%', boxSizing: 'border-box' }}>
          <div style={{ padding: '16px 20px', borderBottom: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <h3 style={{ fontSize: '14px', fontWeight: 'bold', color: '#1e293b', margin: 0 }}>Stock Movement Audit Ledger</h3>
            <span style={{ fontSize: '12px', fontWeight: '600', backgroundColor: '#f1f5f9', color: '#475569', padding: '2px 8px', borderRadius: '10px' }}>
              {ledger.length} Entries
            </span>
          </div>

          <table className="custom-table" style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
            <thead>
              <tr style={{ backgroundColor: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                <th style={{ padding: '12px 16px', textAlign: 'left', color: '#475569', fontWeight: '600', whiteSpace: 'nowrap' }}>Txn ID</th>
                <th style={{ padding: '12px 16px', textAlign: 'left', color: '#475569', fontWeight: '600', whiteSpace: 'nowrap' }}>Timestamp</th>
                <th style={{ padding: '12px 16px', textAlign: 'left', color: '#475569', fontWeight: '600', whiteSpace: 'nowrap' }}>WO Ref</th>
                <th style={{ padding: '12px 16px', textAlign: 'left', color: '#475569', fontWeight: '600', whiteSpace: 'nowrap' }}>Item Description</th>
                <th style={{ padding: '12px 16px', textAlign: 'left', color: '#475569', fontWeight: '600', whiteSpace: 'nowrap' }}>Action Type</th>
                <th style={{ padding: '12px 16px', textAlign: 'left', color: '#475569', fontWeight: '600', whiteSpace: 'nowrap' }}>Quantity</th>
                <th style={{ padding: '12px 16px', textAlign: 'left', color: '#475569', fontWeight: '600', whiteSpace: 'nowrap' }}>Stock Change</th>
                <th style={{ padding: '12px 16px', textAlign: 'left', color: '#475569', fontWeight: '600', whiteSpace: 'nowrap' }}>User & Dept</th>
              </tr>
            </thead>
            <tbody>
              {ledger.map((txn, idx) => (
                <tr key={txn.id} style={{ borderBottom: idx === ledger.length - 1 ? 'none' : '1px solid #f1f5f9' }}>
                  <td style={{ padding: '14px 16px', fontWeight: 'bold', color: '#64748b', whiteSpace: 'nowrap' }}>{txn.id}</td>
                  <td style={{ padding: '14px 16px', color: '#475569', whiteSpace: 'nowrap' }}>{txn.timestamp}</td>
                  <td style={{ padding: '14px 16px', fontWeight: 'bold', color: '#2563eb', whiteSpace: 'nowrap' }}>{txn.woRef}</td>
                  <td style={{ padding: '14px 16px', fontWeight: '500', color: '#1e293b', whiteSpace: 'nowrap' }}>{txn.itemName} ({txn.itemCode})</td>
                  <td style={{ padding: '14px 16px', whiteSpace: 'nowrap' }}>
                    {renderStatusBadge(txn.actionType)}
                  </td>
                  <td style={{ padding: '14px 16px', fontWeight: 'bold', color: txn.qty > 0 ? '#16a34a' : '#dc2626', whiteSpace: 'nowrap' }}>
                    {txn.qty > 0 ? `+${txn.qty}` : txn.qty} {txn.uom}
                  </td>
                  <td style={{ padding: '14px 16px', color: '#64748b', whiteSpace: 'nowrap' }}>{txn.stockBefore} ➔ <strong>{txn.stockAfter}</strong></td>
                  <td style={{ padding: '14px 16px', color: '#475569', whiteSpace: 'nowrap' }}>{txn.user} ({txn.dept})</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}


      {/* CREATE ORDER MODAL */}
      {showCreateModal && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(15,23,42,0.5)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }} onClick={() => setShowCreateModal(false)}>
          <div onClick={(e) => e.stopPropagation()} style={{ backgroundColor: '#fff', padding: '28px', borderRadius: '18px', width: '520px', maxWidth: '92vw', display: 'flex', flexDirection: 'column', gap: '20px', boxShadow: '0 25px 50px rgba(0,0,0,0.15)' }}>
            <div>
              <h3 style={{ fontSize: '17px', fontWeight: 800, color: '#0F172A', margin: 0 }}>New Production Order</h3>
              <p style={{ fontSize: '12px', color: '#94A3B8', margin: '4px 0 0 0' }}>Select a product BOM and enter the target quantity.</p>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <label htmlFor="production-inventory-integration-product-bom" style={{ fontSize: '11px', fontWeight: 700, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Product & BOM</label>
              <select id="production-inventory-integration-product-bom" name="productBOM" aria-label="Product & BOM" value={selectedBomCode} onChange={(e) => setSelectedBomCode(e.target.value)}
                style={{ ...INPUT_STYLE, height: '40px', backgroundColor: '#F8FAFC', fontWeight: 600 }}>
                {Object.values(BOM_REGISTRY).map(b => (<option key={b.bomCode} value={b.bomCode}>{b.productName} ({b.bomCode})</option>))}
              </select>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <label htmlFor="production-inventory-integration-order-quantity" style={{ fontSize: '11px', fontWeight: 700, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Order Quantity</label>
              <input id="production-inventory-integration-order-quantity" name="orderQuantity" aria-label="Order Quantity" type="number" value={orderQty} onChange={(e) => setOrderQty(Number(e.target.value))}
                style={{ ...INPUT_STYLE, height: '40px' }}  />
            </div>

            {liveReq && (
              <div style={{ backgroundColor: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: '10px', padding: '14px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <div style={{ fontSize: '11px', fontWeight: 700, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '4px' }}>Material Preview</div>
                {liveReq.requirements.map((r, idx) => (
                  <div key={idx} style={{ fontSize: '12px', display: 'flex', justifyContent: 'space-between', padding: '4px 0', borderBottom: idx < liveReq.requirements.length - 1 ? '1px solid #F1F5F9' : 'none' }}>
                    <span style={{ fontWeight: 600, color: '#1E293B' }}>{r.itemName}</span>
                    <span style={{ fontWeight: 700, color: r.shortageQty > 0 ? '#DC2626' : '#16A34A' }}>
                      {r.plannedQty} {r.uom} {r.shortageQty > 0 ? `(−${r.shortageQty})` : '✓'}
                    </span>
                  </div>
                ))}
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '4px' }}>
              <button onClick={() => setShowCreateModal(false)} style={{ border: '1px solid #E2E8F0', background: '#fff', padding: '10px 20px', borderRadius: '10px', fontSize: '13px', fontWeight: 600, color: '#64748B', cursor: 'pointer' }}>
                Cancel
              </button>
              <button onClick={() => {
                const bom = BOM_REGISTRY[selectedBomCode];
                prodInventoryStore.createWorkOrder({ productName: bom.productName, productCode: bom.productCode, plannedQty: orderQty, bomCode: selectedBomCode });
                alert(`Order created: ${orderQty} × ${bom.productName}`);
                setShowCreateModal(false); forceRefresh();
              }} style={{ border: 'none', background: '#6366F1', color: '#fff', padding: '10px 24px', borderRadius: '10px', fontSize: '13px', fontWeight: 700, cursor: 'pointer', boxShadow: '0 2px 6px rgba(99,102,241,0.3)' }}>
                Create Order
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
