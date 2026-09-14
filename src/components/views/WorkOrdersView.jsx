import React, { useState, useEffect, useMemo, useRef } from "react";
import { Plus, Search, X, CheckCircle, Edit3, RotateCcw, Eye } from "lucide-react";
import { prodModuleEngine } from "../../utils/productionModuleEngine";
import { fetchCloudStore } from "../../utils/supabaseDataSync";
import { addLiveNotification } from "../Header";

export default function WorkOrdersView({
  userRole,
  setShowWorkOrderForm,
  prodSearchQueryText,
  setProdSearchQueryText,
  prodStatusFilterText,
  setProdStatusFilterText,
  showCustomAlert = (msg) => alert(msg)
}) {
  const [, setEngineTick] = useState(0);
  const [prodFilterStatusSelect, setProdFilterStatusSelect] = useState('All');
  const [selectedRows, setSelectedRows] = useState([]);
  const [selectedWoForStatusUpdate, setSelectedWoForStatusUpdate] = useState(null);
  const [selectedWoForAcceptanceModal, setSelectedWoForAcceptanceModal] = useState(null);
  const [updateStatusChoice, setUpdateStatusChoice] = useState('IN_PROGRESS');
  const [actualGoodOutputVal, setActualGoodOutputVal] = useState('');
  const [actualRejectedOutputVal, setActualRejectedOutputVal] = useState('0');
  const [operatorRemarksVal, setOperatorRemarksVal] = useState('');

  const isFloorEmployee = String(userRole || '').toLowerCase().includes('employee') || String(userRole || '').toLowerCase().includes('floor') || String(userRole || '').toLowerCase().includes('operator');
  const isExecutiveOrMD = userRole === 'CEO' || userRole === 'MD' || userRole === 'Managing Director';

  useEffect(() => {
    const applyWorkOrders = (workOrdersList) => {
      if (workOrdersList && Array.isArray(workOrdersList)) {
        // Filter out legacy VRM26 format work order entries (e.g., VRM26/07/061)
        const cleanWOs = workOrdersList.filter(sw => {
          const woId = sw.workOrderNo || sw.id || '';
          return !woId.startsWith('VRM26/07');
        });

        // Remove any existing legacy VRM26 work orders from prodModuleEngine
        prodModuleEngine.workOrders = prodModuleEngine.workOrders.filter(w => !String(w.id || '').startsWith('VRM26/07'));

        cleanWOs.reverse().forEach(sw => {
          const woId = sw.workOrderNo || sw.id;
          if (woId) {
            const existingIndex = prodModuleEngine.workOrders.findIndex(w => w.id === woId);
            const existingWO = existingIndex >= 0 ? prodModuleEngine.workOrders[existingIndex] : null;

            // Map server status string to internal state key
            let parsedStatus = sw.status;
            if (sw.status === 'In Progress' || sw.status === 'IN_PROGRESS') parsedStatus = 'IN_PROGRESS';
            else if (sw.status === 'Pending' || sw.status === 'PENDING_MATERIAL') parsedStatus = 'PENDING_MATERIAL';
            else if (sw.status === 'Completed' || sw.status === 'COMPLETED' || sw.status === 'COMPLETED_PENDING_VERIFICATION') parsedStatus = 'COMPLETED_PENDING_VERIFICATION';
            else if (String(sw.status || '').toUpperCase() === 'OVERDUE') parsedStatus = 'OVERDUE';

            const formattedWO = {
              id: woId,
              date: sw.targetDate || sw.date || new Date().toISOString().split('T')[0],
              productionHead: 'Senthil Kumar (Production Head)',
              finishedProductCode: sw.productName || sw.finishedProductCode || 'MR100',
              finishedProductName: sw.productName || sw.finishedProductName || 'Mini Rail 100 mm',
              targetQty: Number(sw.plannedQty || sw.targetQty) || 500,
              cutLengthMm: 300,
              productItems: sw.productItems || (existingWO ? existingWO.productItems : []),
              unit: 'Pieces',
              rawMaterialName: sw.rawMaterial || sw.rawMaterialName || 'Raw Aluminum Coil 1.5mm',
              priority: sw.priority || (existingWO ? existingWO.priority : 'Normal'),
              assignedEmployee: sw.assignedEmployee || (existingWO ? existingWO.assignedEmployee : 'Floor Team'),
              status: (existingWO && existingWO.status && existingWO.status !== 'PENDING_MATERIAL') ? existingWO.status : (parsedStatus || 'PENDING_MATERIAL')
            };

            if (existingIndex >= 0) {
              const [oldWO] = prodModuleEngine.workOrders.splice(existingIndex, 1);
              prodModuleEngine.workOrders.unshift({ ...oldWO, ...formattedWO });
            } else {
              prodModuleEngine.workOrders.unshift(formattedWO);
            }
          }
        });
        prodModuleEngine.saveToStorage();
        setEngineTick(t => t + 1);
      }
    };

    fetch('/api/workorders')
      .then(res => res.json())
      .then(data => {
        if (data && data.workOrders) {
          applyWorkOrders(data.workOrders);
        }
      })
      .catch(() => {
        fetchCloudStore('workorder_store', prodModuleEngine.getWorkOrders()).then(cloudWOs => {
          if (cloudWOs) applyWorkOrders(cloudWOs);
        });
      });

    const unsubscribe = prodModuleEngine.subscribe(() => {
      setEngineTick(t => t + 1);
    });
    return () => unsubscribe();
  }, []);

  // Helper to toggle single row selection
  const toggleSelectRow = (woId) => {
    setSelectedRows(prev =>
      prev.includes(woId) ? prev.filter(id => id !== woId) : [...prev, woId]
    );
  };

  // Helper to toggle select all visible rows
  const toggleSelectAll = (visibleWoIds) => {
    if (selectedRows.length === visibleWoIds.length && visibleWoIds.length > 0) {
      setSelectedRows([]);
    } else {
      setSelectedRows(visibleWoIds);
    }
  };

  const allWorkOrderRows = prodModuleEngine.getWorkOrders().map(wo => {
    let stBg = '#EFF6FF';
    let stFg = '#2563EB';
    let progress = 0;
    const statusStr = (wo.status || 'PLANNED').toUpperCase();

    let formattedStatus = (wo.status || 'PLANNED').split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ');
    if (statusStr === 'ACCEPTED') { formattedStatus = 'Accepted / Ready'; }
    else if (statusStr === 'COMPLETED_PENDING_VERIFICATION') { formattedStatus = 'Pending Verification'; }
    else if (statusStr === 'PENDING_MATERIAL') { formattedStatus = 'Pending Material'; }
    else if (statusStr === 'OVERDUE') { formattedStatus = 'Overdue'; }

    if (statusStr === 'OVERDUE') { stBg = '#FEE2E2'; stFg = '#DC2626'; progress = 50; }
    else if (statusStr === 'PENDING_MATERIAL') { stBg = '#FEF3C7'; stFg = '#D97706'; progress = 10; }
    else if (statusStr === 'MATERIAL_RESERVED') { stBg = '#E0F2FE'; stFg = '#0284C7'; progress = 25; }
    else if (statusStr === 'MATERIAL_ISSUED') { stBg = '#EDE9FE'; stFg = '#7C3AED'; progress = 35; }
    else if (statusStr === 'ACCEPTED') { stBg = '#E0E7FF'; stFg = '#4338CA'; progress = 45; }
    else if (statusStr === 'IN_PROGRESS' || statusStr === 'IN PROGRESS') { stBg = '#EFF6FF'; stFg = '#1D4ED8'; progress = 75; }
    else if (statusStr === 'COMPLETED_PENDING_VERIFICATION') { stBg = '#E0F2FE'; stFg = '#0369A1'; progress = 90; }
    else if (statusStr === 'APPROVED_CLOSED' || statusStr === 'COMPLETED' || statusStr === 'CLOSED') { stBg = '#DCFCE7'; stFg = '#15803D'; progress = 100; }

    let rawItems = wo.productItems;
    if (rawItems && !Array.isArray(rawItems) && typeof rawItems === 'object') {
      rawItems = [rawItems];
    }
    const itemsList = Array.isArray(rawItems) && rawItems.length > 0 ? rawItems : [];
    const calculatedTotalQty = itemsList.length > 0 
      ? itemsList.reduce((acc, it) => acc + (Number(it.targetQty) || 0), 0)
      : (Number(wo.targetQty) || 1);

    let displayProductName = wo.finishedProductName;
    if (!displayProductName) {
      if (itemsList.length > 1) {
        displayProductName = `Mini Rail (${itemsList.map(it => `${it.targetQty || 1}x ${it.cutLength || 300}mm`).join(' + ')})`;
      } else if (itemsList.length === 1 && itemsList[0].cutLength) {
        displayProductName = `Mini Rail ${itemsList[0].cutLength} mm Height`;
      } else {
        displayProductName = wo.cutLengthMm ? `Mini Rail (${wo.cutLengthMm} mm)` : 'Mini Rail Structure';
      }
    }

    return {
      rawWO: wo,
      woNo: wo.id,
      product: displayProductName,
      customer: wo.salesOrderNo ? `SO #${wo.salesOrderNo}` : 'Internal Stock',
      line: wo.productionLine || 'Line A',
      qty: `${calculatedTotalQty.toLocaleString()} Pcs`,
      plannedDate: (wo.createdAt || wo.date || '').split('T')[0] || new Date().toISOString().split('T')[0],
      dueDate: wo.dueDate || '2026-08-30',
      status: formattedStatus,
      statusBg: stBg,
      statusFg: stFg,
      priority: wo.priority || 'Normal',
      assignedTo: (() => {
        if (wo.assignedEmployee && wo.assignedEmployee !== 'Floor Team') return wo.assignedEmployee;
        if (wo.operatorName && wo.operatorName !== 'Floor Team') return wo.operatorName;
        if (Array.isArray(wo.processWorkPlan) && wo.processWorkPlan.length > 0) {
          const ops = wo.processWorkPlan.map(s => s.operator).filter(Boolean);
          if (ops.length > 0) return Array.from(new Set(ops)).join(', ');
        }
        try {
          const storedEmps = JSON.parse(localStorage.getItem('controlroom_employees_list') || '[]');
          if (Array.isArray(storedEmps) && storedEmps.length > 0) {
            return storedEmps[0].employee_name || storedEmps[0].name || 'Karthi';
          }
        } catch (e) {}
        return 'Karthi';
      })(),
      progress
    };
  });

  const filteredRows = allWorkOrderRows.filter(row => {
    const searchLower = (prodSearchQueryText || '').toLowerCase();
    const matchesSearch = !searchLower || row.woNo.toLowerCase().includes(searchLower) || row.product.toLowerCase().includes(searchLower) || row.customer.toLowerCase().includes(searchLower);
    const matchesStatusSelect = prodFilterStatusSelect === 'All' || row.status === prodFilterStatusSelect;
    const matchesTab = prodStatusFilterText === 'All' || 
      row.status.toLowerCase().includes(prodStatusFilterText.toLowerCase()) || 
      (prodStatusFilterText === 'Pending Material' && row.rawWO?.status === 'PENDING_MATERIAL') ||
      (prodStatusFilterText === 'In Progress' && (row.rawWO?.status === 'IN_PROGRESS' || row.rawWO?.status === 'ACCEPTED')) ||
      (prodStatusFilterText === 'Overdue' && (row.status === 'Overdue' || String(row.rawWO?.status || '').toUpperCase() === 'OVERDUE'));
    return matchesSearch && matchesStatusSelect && matchesTab;
  });

  const visibleWoIds = filteredRows.map(r => r.woNo);
  const isAllSelected = visibleWoIds.length > 0 && selectedRows.length === visibleWoIds.length;

  // Selected Work Order objects for floating bar actions
  const selectedWoObjects = prodModuleEngine.getWorkOrders().filter(w => selectedRows.includes(w.id));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', minWidth: 0, width: '100%', fontFamily: "'DM Sans', sans-serif" }}>

      {/* 1. TOP HEADER SECTION */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <h2 style={{ fontSize: '20px', fontWeight: 'bold', color: '#0F172A', margin: 0 }}>
            {isFloorEmployee ? 'My Production Floor Work Orders' : 'Work Orders Management'}
          </h2>
          <span style={{ fontSize: '13px', color: '#64748B', marginTop: '2px' }}>
            {isFloorEmployee
              ? 'Select a work order checkbox to open floating actions (Accept WO, Update Status).'
              : 'View and manage all work orders across the production floor.'}
          </span>
        </div>

        {!isFloorEmployee && !isExecutiveOrMD && (
          <button
            onClick={() => setShowWorkOrderForm(true)}
            style={{
              backgroundColor: '#0E7490',
              border: 'none',
              color: '#FFFFFF',
              height: '40px',
              padding: '0 6px 0 20px',
              borderRadius: '50px',
              fontSize: '13px',
              fontWeight: '700',
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              cursor: 'pointer',
              boxShadow: '0 4px 14px rgba(14, 116, 144, 0.35)',
              transition: 'all 0.2s ease',
              letterSpacing: '0.2px'
            }}
            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#085D75'}
            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#0E7490'}
          >
            <span>Create Work Order</span>
            <div style={{
              width: '28px',
              height: '28px',
              borderRadius: '50%',
              backgroundColor: '#FFFFFF',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#0E7490',
              boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
            }}>
              <Plus size={16} strokeWidth={2.5} />
            </div>
          </button>
        )}
      </div>

      {/* 2. SEARCH & FILTER CONTROLS CARD */}
      <div style={{
        backgroundColor: '#FFFFFF',
        borderRadius: '16px',
        border: '1px solid #E2E8F0',
        padding: '16px 20px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '16px',
        boxShadow: '0 1px 3px rgba(0,0,0,0.02)'
      }}>
        {/* Search bar */}
        <div style={{ position: 'relative', width: '340px' }}>
          <Search style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', width: '15px', height: '15px', color: '#94A3B8' }} />
          <input
            type="text"
            placeholder="Search Work Orders (WO No, Product, Customer)..."
            value={prodSearchQueryText}
            onChange={(e) => setProdSearchQueryText(e.target.value)}
            style={{
              width: '100%',
              height: '38px',
              paddingLeft: '36px',
              paddingRight: '12px',
              borderRadius: '8px',
              border: '1px solid #E2E8F0',
              fontSize: '13px',
              color: '#0F172A',
              backgroundColor: '#FFFFFF',
              outline: 'none'
            }}
          />
        </div>

        {/* Filter dropdowns */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <select
            value={prodFilterStatusSelect}
            onChange={(e) => setProdFilterStatusSelect(e.target.value)}
            style={{
              height: '38px',
              padding: '0 12px',
              borderRadius: '8px',
              border: '1px solid #E2E8F0',
              fontSize: '13px',
              color: '#475569',
              backgroundColor: '#FFFFFF',
              cursor: 'pointer',
              outline: 'none'
            }}
          >
            <option value="All">All Statuses</option>
            <option value="In Progress">On Process / In Progress</option>
            <option value="Completed">Completed</option>
            <option value="Pending">Pending Material</option>
            <option value="Planned">Planned</option>
          </select>

          <button
            onClick={() => {
              setProdSearchQueryText('');
              setProdFilterStatusSelect('All');
              setProdStatusFilterText('All');
            }}
            style={{
              width: '38px',
              height: '38px',
              borderRadius: '8px',
              border: '1px solid #E2E8F0',
              backgroundColor: '#FFFFFF',
              color: '#64748B',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer'
            }}
          >
            <RotateCcw style={{ width: '15px', height: '15px' }} />
          </button>
        </div>
      </div>

      {/* 3. TABS ROW */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', overflowX: 'auto', paddingBottom: '4px' }}>
        {['All Work Orders', 'Pending Material', 'Material Issued', 'In Progress', 'Pending Verification', 'Overdue', 'Completed'].map((tabLabel, idx) => (
          <button
            key={idx}
            onClick={() => setProdStatusFilterText(tabLabel === 'All Work Orders' ? 'All' : tabLabel)}
            style={{
              border: 'none',
              background: 'none',
              borderBottom: (prodStatusFilterText === tabLabel || (tabLabel === 'All Work Orders' && prodStatusFilterText === 'All')) ? '3px solid #2563eb' : '3px solid transparent',
              padding: '8px 12px',
              fontSize: '13.5px',
              fontWeight: '700',
              color: (prodStatusFilterText === tabLabel || (tabLabel === 'All Work Orders' && prodStatusFilterText === 'All')) ? '#2563eb' : '#64748b',
              cursor: 'pointer'
            }}
          >
            {tabLabel}
          </button>
        ))}
      </div>

      {/* 4. MAIN WORK ORDERS DATA TABLE */}
      <div className="section-card" style={{ padding: '0', backgroundColor: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: '12px', overflow: 'hidden', width: '100%', boxSizing: 'border-box' }}>
        <div style={{ overflowX: 'auto', width: '100%' }}>
          <table className="custom-table" style={{ width: '100%', minWidth: '1200px', borderCollapse: 'collapse', fontSize: '13px', textAlign: 'left' }}>
            <thead>
              <tr style={{ color: '#475569', borderBottom: '1px solid #E2E8F0', backgroundColor: '#F8FAFC', fontSize: '12px', fontWeight: 'bold', height: '48px' }}>
                <th style={{ width: '48px', minWidth: '48px', maxWidth: '48px', padding: '12px 0', textAlign: 'center', verticalAlign: 'middle', boxSizing: 'border-box' }}>
                  <input
                    type="checkbox"
                    checked={isAllSelected}
                    onChange={() => toggleSelectAll(visibleWoIds)}
                    style={{ accentColor: '#0E7490', cursor: 'pointer', verticalAlign: 'middle', margin: 0 }}
                  />
                </th>
                <th style={{ width: '150px', minWidth: '150px', padding: '12px 14px', boxSizing: 'border-box' }}>WO No.</th>
                <th style={{ minWidth: '220px', padding: '12px 14px', boxSizing: 'border-box' }}>Product</th>
                {!isFloorEmployee && <th style={{ width: '130px', minWidth: '130px', padding: '12px 14px', boxSizing: 'border-box' }}>WO Date</th>}
                {isFloorEmployee && <th style={{ minWidth: '180px', padding: '12px 14px', boxSizing: 'border-box' }}>Customer / Project</th>}
                <th style={{ width: '130px', minWidth: '130px', padding: '12px 14px', textAlign: 'right', boxSizing: 'border-box' }}>Qty (Planned)</th>
                <th style={{ width: '140px', minWidth: '140px', padding: '12px 14px', boxSizing: 'border-box' }}>{!isFloorEmployee ? 'Expected Start' : 'Planned Date'}</th>
                <th style={{ width: '150px', minWidth: '150px', padding: '12px 14px', boxSizing: 'border-box' }}>{!isFloorEmployee ? 'Expected Completion' : 'Due Date'}</th>
                <th style={{ width: '120px', minWidth: '120px', padding: '12px 14px', textAlign: 'center', boxSizing: 'border-box' }}>Priority</th>
                <th style={{ width: '130px', minWidth: '130px', padding: '12px 14px', textAlign: 'center', boxSizing: 'border-box' }}>Status</th>
              </tr>
            </thead>
            <tbody>
              {filteredRows.map((row, idx) => {
                const isSelected = selectedRows.includes(row.woNo);

                return (
                  <tr
                    key={idx}
                    style={{
                      borderBottom: '1px solid #F1F5F9',
                      backgroundColor: isSelected ? '#ECFEFF' : '#FFFFFF',
                      transition: 'background-color 0.15s ease'
                    }}
                  >
                    <td style={{
                      width: '48px',
                      minWidth: '48px',
                      padding: '12px 0',
                      textAlign: 'center',
                      verticalAlign: 'middle',
                      boxSizing: 'border-box',
                      borderLeft: isSelected ? '4px solid #0E7490' : '4px solid transparent'
                    }}>
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggleSelectRow(row.woNo)}
                        style={{ accentColor: '#0E7490', cursor: 'pointer', verticalAlign: 'middle', margin: 0 }}
                      />
                    </td>
                    <td
                      onClick={() => setSelectedWoForAcceptanceModal(row.rawWO || row)}
                      style={{ padding: '12px 14px', fontWeight: 'bold', color: '#0F172A', cursor: 'pointer', textDecoration: 'none' }}
                    >
                      {row.woNo}
                    </td>
                    <td style={{ padding: '12px 14px', fontWeight: 'bold', color: '#1E293B' }}>{row.product}</td>
                    {!isFloorEmployee && <td style={{ padding: '12px 14px', color: '#64748B' }}>{row.plannedDate}</td>}
                    {isFloorEmployee && <td style={{ padding: '12px 14px', color: '#475569' }}>{row.customer}</td>}
                    <td style={{ padding: '12px 14px', fontWeight: 'bold', color: '#0F172A' }}>{row.qty}</td>
                    <td style={{ padding: '12px 14px', color: '#64748B' }}>{row.plannedDate}</td>
                    <td style={{ padding: '12px 14px', color: '#64748B' }}>{row.dueDate}</td>

                    {/* Priority */}
                    <td style={{ padding: '12px 14px', fontWeight: 'bold', color: row.priority === 'High' ? '#DC2626' : (row.priority === 'Urgent' ? '#B91C1C' : '#0284C7'), fontSize: '12px' }}>
                      {row.priority === 'High' ? 'High' : row.priority}
                    </td>

                    {/* Status Badge with bullet dot */}
                    <td style={{ padding: '12px 14px' }}>
                      <span style={{ backgroundColor: row.statusBg, color: row.statusFg, padding: '4px 10px', borderRadius: '12px', fontSize: '11px', fontWeight: 'bold', display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
                        <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: row.statusFg }}></span>
                        {row.status}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* PAGINATION FOOTER ROW */}
        <div style={{ padding: '12px 20px', backgroundColor: '#ffffff', borderTop: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '13px', color: '#64748b' }}>
          <span>Showing 1 to {filteredRows.length} entries</span>
        </div>
      </div>

      {/* MODAL: FLOOR EMPLOYEE STATUS UPDATE */}
      {selectedWoForStatusUpdate && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(15,23,42,0.6)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 9999
        }}>
          <div style={{
            backgroundColor: '#FFFFFF',
            borderRadius: '16px',
            padding: '24px',
            width: '460px',
            boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)',
            display: 'flex',
            flexDirection: 'column',
            gap: '16px',
            fontFamily: "'DM Sans', sans-serif"
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #E2E8F0', paddingBottom: '12px' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '16px', fontWeight: '800', color: '#0F172A' }}>
                  Update Work Progress: {selectedWoForStatusUpdate.id}
                </h3>
                <span style={{ fontSize: '12px', color: '#64748B' }}>
                  Product: {selectedWoForStatusUpdate.finishedProductName} (Target: {selectedWoForStatusUpdate.targetQty} Pcs)
                </span>
              </div>
              <button onClick={() => setSelectedWoForStatusUpdate(null)} style={{ border: 'none', background: 'none', cursor: 'pointer', fontSize: '16px', color: '#64748B' }}>✕</button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '11px', fontWeight: '700', color: '#475569', marginBottom: '6px' }}>SELECT NEW WORK STATUS</label>
                <select
                  value={updateStatusChoice}
                  onChange={(e) => setUpdateStatusChoice(e.target.value)}
                  style={{ width: '100%', height: '40px', borderRadius: '8px', border: '1px solid #CBD5E1', padding: '0 12px', fontSize: '13px', fontWeight: '700', color: '#0F172A' }}
                >
                  <option value="IN_PROGRESS">On Process / Start Work</option>
                  <option value="PENDING_MATERIAL">Pending Material Request</option>
                  <option value="COMPLETED">Completed (Submit for Production Head Approval)</option>
                </select>
              </div>

              {updateStatusChoice === 'COMPLETED' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  <label style={{ display: 'block', fontSize: '11px', fontWeight: '700', color: '#475569', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                    ACTUAL OUTPUT QUANTITIES BY PRODUCT ITEM
                  </label>
                  {(() => {
                    let rawItems = selectedWoForStatusUpdate.productItems;
                    if (rawItems && !Array.isArray(rawItems) && typeof rawItems === 'object') {
                      rawItems = [rawItems];
                    }
                    const items = Array.isArray(rawItems) && rawItems.length > 0 ? rawItems : [];
                    if (items.length > 0) {
                      return items.map((it, i) => (
                        <div key={i} style={{ border: '1px solid #BAE6FD', borderRadius: '10px', padding: '10px 12px', backgroundColor: '#F0F9FF' }}>
                          <div style={{ fontSize: '12.5px', fontWeight: '800', color: '#0369A1', marginBottom: '6px' }}>
                            Item #{i + 1}: {it.productCode || selectedWoForStatusUpdate.finishedProductName || 'Finished Product'} ({it.cutLength || selectedWoForStatusUpdate.cutLengthMm || 350} mm Cut) — Target: {it.targetQty} Pcs
                          </div>
                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                            <div>
                              <label style={{ display: 'block', fontSize: '10px', fontWeight: '700', color: '#166534', marginBottom: '4px' }}>GOOD QTY (PCS)</label>
                              <input
                                type="number"
                                defaultValue={it.targetQty || 1}
                                id={`good_qty_item_${i}`}
                                style={{ width: '100%', height: '36px', borderRadius: '6px', border: '1px solid #CBD5E1', padding: '0 8px', fontSize: '13px', fontWeight: '800', color: '#166534', backgroundColor: '#FFFFFF' }}
                              />
                            </div>
                            <div>
                              <label style={{ display: 'block', fontSize: '10px', fontWeight: '700', color: '#DC2626', marginBottom: '4px' }}>REJECTED (PCS)</label>
                              <input
                                type="number"
                                defaultValue={0}
                                id={`rej_qty_item_${i}`}
                                style={{ width: '100%', height: '36px', borderRadius: '6px', border: '1px solid #CBD5E1', padding: '0 8px', fontSize: '13px', fontWeight: '800', color: '#DC2626', backgroundColor: '#FFFFFF' }}
                              />
                            </div>
                          </div>
                        </div>
                      ));
                    }

                    return (
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', backgroundColor: '#F8FAFC', padding: '12px', borderRadius: '10px', border: '1px solid #E2E8F0' }}>
                        <div>
                          <label style={{ display: 'block', fontSize: '11px', fontWeight: '700', color: '#166534', marginBottom: '4px' }}>ACTUAL GOOD QTY</label>
                          <input
                            type="number"
                            value={actualGoodOutputVal}
                            onChange={(e) => setActualGoodOutputVal(e.target.value)}
                            style={{ width: '100%', height: '38px', borderRadius: '6px', border: '1px solid #CBD5E1', padding: '0 10px', fontSize: '13px', fontWeight: '800', color: '#166534' }}
                          />
                        </div>
                        <div>
                          <label style={{ display: 'block', fontSize: '11px', fontWeight: '700', color: '#DC2626', marginBottom: '4px' }}>REJECTED QTY</label>
                          <input
                            type="number"
                            value={actualRejectedOutputVal}
                            onChange={(e) => setActualRejectedOutputVal(e.target.value)}
                            style={{ width: '100%', height: '38px', borderRadius: '6px', border: '1px solid #CBD5E1', padding: '0 10px', fontSize: '13px', fontWeight: '800', color: '#DC2626' }}
                          />
                        </div>
                      </div>
                    );
                  })()}
                </div>
              )}

              <div>
                <label style={{ display: 'block', fontSize: '11px', fontWeight: '700', color: '#475569', marginBottom: '6px' }}>OPERATOR REMARKS / NOTES</label>
                <textarea
                  rows="2"
                  value={operatorRemarksVal}
                  onChange={(e) => setOperatorRemarksVal(e.target.value)}
                  placeholder="Enter any production notes, machine status, or cutting remarks..."
                  style={{ width: '100%', borderRadius: '8px', border: '1px solid #CBD5E1', padding: '8px 12px', fontSize: '12.5px', resize: 'vertical' }}
                ></textarea>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', borderTop: '1px solid #E2E8F0', paddingTop: '14px' }}>
              <button
                onClick={() => setSelectedWoForStatusUpdate(null)}
                style={{ padding: '8px 16px', borderRadius: '8px', border: '1px solid #CBD5E1', backgroundColor: '#FFFFFF', color: '#475569', fontSize: '13px', fontWeight: '700', cursor: 'pointer' }}
              >
                Cancel
              </button>

              <button
                onClick={() => {
                  try {
                    if (updateStatusChoice === 'IN_PROGRESS') {
                      prodModuleEngine.startWork(selectedWoForStatusUpdate.id);
                      addLiveNotification({
                        id: `notif-start-${Date.now()}`,
                        role: 'Production Admin',
                        title: 'Work Progress Started',
                        message: `Work Order ${selectedWoForStatusUpdate.id} is now IN PROGRESS on floor line.`,
                        time: 'Just now',
                        targetTab: 'Work Orders',
                        badgeColor: '#1D4ED8'
                      });
                      showCustomAlert(`Work Order ${selectedWoForStatusUpdate.id} is now ON PROCESS / IN PROGRESS.`, 'Work Started', 'success');
                    } else if (updateStatusChoice === 'PENDING_MATERIAL') {
                      prodModuleEngine.updateWorkOrderStatus(selectedWoForStatusUpdate.id, 'PENDING_MATERIAL');
                      showCustomAlert(`Work Order ${selectedWoForStatusUpdate.id} marked as PENDING MATERIAL.`, 'Status Updated', 'warning');
                    } else if (updateStatusChoice === 'COMPLETED') {
                      const good = Number(actualGoodOutputVal || selectedWoForStatusUpdate.targetQty);
                      const rej = Number(actualRejectedOutputVal || 0);
                      prodModuleEngine.submitCompletion(selectedWoForStatusUpdate.id, { goodQty: good, rejectedQty: rej, operatorRemarks: operatorRemarksVal });
                      addLiveNotification({
                        id: `notif-comp-${Date.now()}`,
                        role: 'Production Admin',
                        title: 'Work Order Pending Verification',
                        message: `Floor Employee completed Work Order ${selectedWoForStatusUpdate.id} (${good} pcs). Verification & FG Stock Approval required by Production Head.`,
                        time: 'Just now',
                        targetTab: 'Work Orders',
                        badgeColor: '#0E7490'
                      });
                      showCustomAlert(`Work Order ${selectedWoForStatusUpdate.id} submitted for verification! Production Head has been notified to approve & credit FG stock.`, 'Submitted for Verification', 'success');
                    }
                    setSelectedWoForStatusUpdate(null);
                  } catch (err) {
                    showCustomAlert(`Error updating status: ${err.message}`, 'Status Update Error', 'error');
                  }
                }}
                style={{ padding: '8px 18px', borderRadius: '8px', border: 'none', backgroundColor: '#2563EB', color: '#FFFFFF', fontSize: '13px', fontWeight: '800', cursor: 'pointer', boxShadow: '0 2px 6px rgba(37,99,235,0.25)' }}
              >
                Save Work Status
              </button>
            </div>
          </div>
        </div>
      )}

      {/* SIDE DRAWER: WORK ORDER DETAILS REVIEW & ACCEPTANCE (MATCHING REFERENCE UI) */}
      {selectedWoForAcceptanceModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(15, 23, 42, 0.4)',
          backdropFilter: 'blur(3px)',
          display: 'flex',
          justifyContent: 'flex-end',
          zIndex: 9999
        }}
          onClick={(e) => {
            if (e.target === e.currentTarget) setSelectedWoForAcceptanceModal(null);
          }}>
          <div style={{
            backgroundColor: '#FFFFFF',
            width: '540px',
            maxWidth: '100vw',
            height: '100vh',
            overflowY: 'auto',
            boxShadow: '-10px 0 30px rgba(0, 0, 0, 0.12)',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            padding: '24px',
            boxSizing: 'border-box',
            fontFamily: "'Plus Jakarta Sans', 'DM Sans', -apple-system, BlinkMacSystemFont, sans-serif"
          }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>

              {/* 1. Header with Page Counter */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <h3 style={{ margin: 0, fontSize: '18px', fontWeight: '700', color: '#1E293B' }}>
                    {!isFloorEmployee ? 'Work Order Management & Audit' : 'Work Order Preview'}
                  </h3>
                  <div style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', background: '#F1F5F9', borderRadius: '20px', padding: '2px 8px' }}>
                    <span style={{ fontSize: '12px', fontWeight: '600', color: '#64748B' }}>1 of 1</span>
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  {isFloorEmployee && (
                    !(selectedWoForAcceptanceModal.status === 'ACCEPTED' || selectedWoForAcceptanceModal.status === 'IN_PROGRESS' || selectedWoForAcceptanceModal.status === 'COMPLETED_PENDING_VERIFICATION') ? (
                      <button
                        onClick={() => {
                          try {
                            prodModuleEngine.acceptWorkOrder(selectedWoForAcceptanceModal.id);
                            setEngineTick(t => t + 1);
                            alert(`✅ Work Order ${selectedWoForAcceptanceModal.id} has been ACCEPTED!`);
                            setSelectedWoForAcceptanceModal(null);
                            setSelectedRows([]);
                          } catch (err) {
                            alert(`❌ Error accepting Work Order: ${err.message}`);
                          }
                        }}
                        style={{
                          padding: '6px 14px',
                          borderRadius: '8px',
                          border: '1px solid #E2E8F0',
                          backgroundColor: '#FFFFFF',
                          color: '#1E293B',
                          fontSize: '13px',
                          fontWeight: '600',
                          cursor: 'pointer',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '6px',
                          boxShadow: '0 1px 2px rgba(0,0,0,0.05)'
                        }}
                      >
                        <CheckCircle size={14} style={{ color: '#10B981' }} /> Accept WO
                      </button>
                    ) : (
                      <span style={{
                        padding: '5px 12px',
                        borderRadius: '20px',
                        backgroundColor: '#ECFDF5',
                        color: '#047857',
                        border: '1px solid #A7F3D0',
                        fontSize: '12px',
                        fontWeight: '700',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '6px',
                        cursor: 'default',
                        userSelect: 'none'
                      }}>
                        <CheckCircle size={14} style={{ color: '#047857' }} /> Accepted the WO
                      </span>
                    )
                  )}
                </div>
              </div>

              {/* 2. Main Title Profile Block */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '14px', paddingTop: '4px' }}>
                <div style={{
                  width: '52px',
                  height: '52px',
                  borderRadius: '50%',
                  backgroundColor: '#EEF2FF',
                  color: '#4F46E5',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '20px',
                  fontWeight: '800'
                }}>
                  {(selectedWoForAcceptanceModal.finishedProductName || 'WO').substring(0, 2).toUpperCase()}
                </div>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <h2 style={{ margin: 0, fontSize: '20px', fontWeight: '700', color: '#0F172A' }}>
                      {(() => {
                        let rawItems = selectedWoForAcceptanceModal.productItems;
                        if (rawItems && !Array.isArray(rawItems) && typeof rawItems === 'object') {
                          rawItems = [rawItems];
                        }
                        const itemsList = Array.isArray(rawItems) && rawItems.length > 0 ? rawItems : [];
                        if (itemsList.length > 1) {
                          return `Mini Rail (${itemsList.map(it => `${it.targetQty || 1}x ${it.cutLength || 300}mm`).join(' + ')})`;
                        } else if (itemsList.length === 1 && itemsList[0].cutLength) {
                          return `Mini Rail ${itemsList[0].cutLength} mm Height`;
                        }
                        return selectedWoForAcceptanceModal.finishedProductName || 'Mini Rail Structure';
                      })()}
                    </h2>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', backgroundColor: '#ECFDF5', color: '#059669', fontSize: '11px', fontWeight: '700', padding: '2px 8px', borderRadius: '12px' }}>
                      • {selectedWoForAcceptanceModal.status || 'ISSUED'}
                    </span>
                  </div>
                  <div style={{ fontSize: '13px', color: '#64748B', marginTop: '2px' }}>
                    WO ID: <strong>{selectedWoForAcceptanceModal.id}</strong>
                  </div>
                </div>
              </div>

              {/* 3. Top Metrics Metric Grid (Reference Style Bar) */}
              {(() => {
                let rawItems = selectedWoForAcceptanceModal.productItems;
                if (rawItems && !Array.isArray(rawItems) && typeof rawItems === 'object') {
                  rawItems = [rawItems];
                }
                const parsedItems = Array.isArray(rawItems) && rawItems.length > 0 ? rawItems : [];
                const primaryCut = parsedItems[0]?.cutLength || selectedWoForAcceptanceModal.cutLengthMm || selectedWoForAcceptanceModal.cutLength || 350;
                const cutSpecsStr = parsedItems.length > 1
                  ? parsedItems.map(it => `${it.cutLength || 300}mm`).join(' + ')
                  : `${primaryCut} mm`;

                const totalQtyVal = parsedItems.length > 0
                  ? parsedItems.reduce((sum, it) => sum + (Number(it.targetQty) || 0), 0)
                  : (selectedWoForAcceptanceModal.targetQty || 1);

                const rawLengths = selectedWoForAcceptanceModal.rawMaterialPhysicalToIssue || ((selectedWoForAcceptanceModal.materialRequirement?.items || [])[0]?.rawLengthsRequired) || 1;
                const totalMeters = Number((rawLengths * 2.414).toFixed(2));

                // Resolve real employee name for display
                const stepOperators = Array.isArray(selectedWoForAcceptanceModal.processWorkPlan)
                  ? selectedWoForAcceptanceModal.processWorkPlan.map(s => s.operator).filter(Boolean)
                  : [];
                const distinctStepOps = Array.from(new Set(stepOperators));
                const assignedEmployeeName = selectedWoForAcceptanceModal.assignedEmployee && selectedWoForAcceptanceModal.assignedEmployee !== 'Floor Team'
                  ? selectedWoForAcceptanceModal.assignedEmployee
                  : selectedWoForAcceptanceModal.operatorName && selectedWoForAcceptanceModal.operatorName !== 'Floor Team'
                  ? selectedWoForAcceptanceModal.operatorName
                  : distinctStepOps.length > 0
                  ? distinctStepOps.join(', ')
                  : (() => {
                      try {
                        const storedEmps = JSON.parse(localStorage.getItem('controlroom_employees_list') || '[]');
                        if (Array.isArray(storedEmps) && storedEmps.length > 0) {
                          return storedEmps[0].employee_name || storedEmps[0].name || 'Karthi';
                        }
                      } catch (e) {}
                      return 'Karthi';
                    })();

                return (
                  <>
                    <div style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(4, 1fr)',
                      border: '1px solid #E2E8F0',
                      borderRadius: '12px',
                      padding: '12px 8px',
                      backgroundColor: '#FFFFFF',
                      textAlign: 'center'
                    }}>
                      <div style={{ borderRight: '1px solid #F1F5F9', padding: '0 8px' }}>
                        <span style={{ fontSize: '10px', fontWeight: '700', color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.5px' }}>TARGET QTY</span>
                        <div style={{ fontSize: '18px', fontWeight: '700', color: '#0F172A', marginTop: '4px' }}>
                          {totalQtyVal} <span style={{ fontSize: '11px', color: '#64748B', fontWeight: '400' }}>Pcs</span>
                        </div>
                      </div>
                      <div style={{ borderRight: '1px solid #F1F5F9', padding: '0 8px' }}>
                        <span style={{ fontSize: '10px', fontWeight: '700', color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.5px' }}>CUT LENGTH</span>
                        <div style={{ fontSize: parsedItems.length > 1 ? '14px' : '18px', fontWeight: '700', color: '#0284C7', marginTop: '4px' }}>
                          {cutSpecsStr}
                        </div>
                      </div>
                      <div style={{ borderRight: '1px solid #F1F5F9', padding: '0 8px' }}>
                        <span style={{ fontSize: '10px', fontWeight: '700', color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.5px' }}>TOTAL RAW M</span>
                        <div style={{ fontSize: '18px', fontWeight: '700', color: '#059669', marginTop: '4px' }}>
                          {totalMeters} <span style={{ fontSize: '11px', color: '#059669', fontWeight: '600' }}>m</span>
                        </div>
                      </div>
                      <div style={{ padding: '0 8px' }}>
                        <span style={{ fontSize: '10px', fontWeight: '700', color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.5px' }}>LENGTHS</span>
                        <div style={{ fontSize: '18px', fontWeight: '700', color: '#D97706', marginTop: '4px' }}>
                          {rawLengths}
                        </div>
                      </div>
                    </div>

                    {/* 4. Details List (Clean 2-column key-value grid) */}
                    <div>
                      <h4 style={{ margin: '14px 0 12px 0', fontSize: '14px', fontWeight: '700', color: '#334155' }}>
                        Work Order Details
                      </h4>
                      <div style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(2, 1fr)',
                        gap: '14px 20px',
                        padding: '16px',
                        border: '1px solid #E2E8F0',
                        borderRadius: '12px',
                        backgroundColor: '#FFFFFF',
                        fontSize: '13px'
                      }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                          <span style={{ color: '#64748B', fontSize: '11px', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.3px' }}>WO Number</span>
                          <strong style={{ color: '#0F172A', fontWeight: '700' }}>{selectedWoForAcceptanceModal.id}</strong>
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                          <span style={{ color: '#64748B', fontSize: '11px', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.3px' }}>Status</span>
                          <div>
                            <span style={{ backgroundColor: '#F3E8FF', color: '#7C3AED', padding: '3px 10px', borderRadius: '12px', fontSize: '11px', fontWeight: '700', display: 'inline-block' }}>
                              {(selectedWoForAcceptanceModal.status || 'ISSUED').replace(/_/g, ' ')}
                            </span>
                          </div>
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                          <span style={{ color: '#64748B', fontSize: '11px', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.3px' }}>Assigned Employee</span>
                          <strong style={{ color: '#2563EB', fontWeight: '700' }}>{assignedEmployeeName}</strong>
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                          <span style={{ color: '#64748B', fontSize: '11px', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.3px' }}>Production Line</span>
                          <strong style={{ color: '#0F172A', fontWeight: '700' }}>{selectedWoForAcceptanceModal.productionLine || 'Line A'}</strong>
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                          <span style={{ color: '#64748B', fontSize: '11px', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.3px' }}>Stock Length</span>
                          <strong style={{ color: '#0284C7', fontWeight: '700' }}>2414 mm</strong>
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                          <span style={{ color: '#64748B', fontSize: '11px', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.3px' }}>Cut Spec</span>
                          <strong style={{ color: '#0E7490', fontWeight: '700' }}>{cutSpecsStr}</strong>
                        </div>
                      </div>
                    </div>

                    {/* 5. Product & Target Output Specifications List */}
                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', margin: '14px 0 12px 0' }}>
                        <h4 style={{ margin: 0, fontSize: '14px', fontWeight: '700', color: '#334155' }}>
                          Product & Target Output Specifications ({ parsedItems.length > 0 ? parsedItems.length : 1 } Items)
                        </h4>
                      </div>

                      {parsedItems.length > 0 ? (
                        parsedItems.map((item, idx) => (
                          <div key={idx} style={{ border: '1px solid #BAE6FD', borderRadius: '12px', padding: '14px 16px', backgroundColor: '#F0F9FF', marginBottom: '10px' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                              <span style={{ fontSize: '14px', fontWeight: '800', color: '#0369A1' }}>
                                Item #{idx + 1}: {item.productCode || selectedWoForAcceptanceModal.finishedProductName || 'Finished Product'}
                              </span>
                              <span style={{ backgroundColor: '#E0F2FE', color: '#0369A1', fontSize: '11px', fontWeight: '700', padding: '2px 8px', borderRadius: '10px' }}>
                                {item.cutLength || primaryCut} mm Cut
                              </span>
                            </div>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', borderTop: '1px solid #BAE6FD', paddingTop: '8px', fontSize: '12.5px' }}>
                              <div>
                                <span style={{ color: '#64748B', display: 'block', fontSize: '11px', fontWeight: '600' }}>Cut Length</span>
                                <strong style={{ color: '#0E7490', fontWeight: '700' }}>{item.cutLength || primaryCut} mm</strong>
                              </div>
                              <div>
                                <span style={{ color: '#64748B', display: 'block', fontSize: '11px', fontWeight: '600' }}>Target Output Qty</span>
                                <strong style={{ color: '#0F172A', fontWeight: '700' }}>{item.targetQty || totalQtyVal} Pcs</strong>
                              </div>
                            </div>
                          </div>
                        ))
                      ) : (
                        <div style={{ border: '1px solid #E2E8F0', borderRadius: '12px', padding: '14px 16px', backgroundColor: '#FFFFFF', marginBottom: '10px' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                            <span style={{ fontSize: '14px', fontWeight: '700', color: '#0F172A' }}>
                              {selectedWoForAcceptanceModal.finishedProductName || 'Aluminium Profile'}
                            </span>
                            <span style={{ backgroundColor: '#E0F2FE', color: '#0369A1', fontSize: '11px', fontWeight: '700', padding: '2px 8px', borderRadius: '10px' }}>
                              {primaryCut} mm Cut
                            </span>
                          </div>
                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px', borderTop: '1px solid #F1F5F9', paddingTop: '8px', fontSize: '12px' }}>
                            <div>
                              <span style={{ color: '#64748B', display: 'block', fontSize: '11px' }}>Cut Spec</span>
                              <strong style={{ color: '#0E7490', fontWeight: '700' }}>{primaryCut} mm</strong>
                            </div>
                            <div>
                              <span style={{ color: '#64748B', display: 'block', fontSize: '11px' }}>Target Qty</span>
                              <strong style={{ color: '#0F172A', fontWeight: '700' }}>{selectedWoForAcceptanceModal.targetQty} Pcs</strong>
                            </div>
                            <div>
                              <span style={{ color: '#64748B', display: 'block', fontSize: '11px' }}>Raw Lengths</span>
                              <strong style={{ color: '#D97706', fontWeight: '700' }}>{rawLengths} Bar</strong>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  </>
                );
              })()}

            </div>

            {/* 6. Side Drawer Footer Action Buttons */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', borderTop: '1px solid #E2E8F0', paddingTop: '16px', marginTop: '16px' }}>
              <button
                onClick={() => setSelectedWoForAcceptanceModal(null)}
                style={{ padding: '9px 18px', borderRadius: '8px', border: '1px solid #CBD5E1', backgroundColor: '#FFFFFF', color: '#475569', fontSize: '13px', fontWeight: '600', cursor: 'pointer' }}
              >
                Close Details
              </button>

              {isFloorEmployee && !(selectedWoForAcceptanceModal.status === 'ACCEPTED' || selectedWoForAcceptanceModal.status === 'IN_PROGRESS' || selectedWoForAcceptanceModal.status === 'COMPLETED_PENDING_VERIFICATION') && (
                <button
                  onClick={() => {
                    try {
                      prodModuleEngine.acceptWorkOrder(selectedWoForAcceptanceModal.id);
                      setEngineTick(t => t + 1);
                      alert(`✅ Work Order ${selectedWoForAcceptanceModal.id} has been ACCEPTED by Floor Employee! Status is now ACCEPTED.`);
                      setSelectedWoForAcceptanceModal(null);
                      setSelectedRows([]);
                    } catch (err) {
                      alert(`❌ Error accepting Work Order: ${err.message}`);
                    }
                  }}
                  style={{ padding: '9px 22px', borderRadius: '8px', border: 'none', backgroundColor: '#7C3AED', color: '#FFFFFF', fontSize: '13px', fontWeight: '700', cursor: 'pointer', boxShadow: '0 2px 6px rgba(124,58,237,0.25)', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                >
                  <CheckCircle size={14} /> Accept & Start Assignment
                </button>
              )}

              {/* PRODUCTION HEAD VERIFY & APPROVE ACTION */}
              {!isFloorEmployee && (
                selectedWoForAcceptanceModal.status === 'COMPLETED_PENDING_VERIFICATION' ? (
                  <button
                    onClick={() => {
                      try {
                        prodModuleEngine.approveProduction(selectedWoForAcceptanceModal.id);
                        addLiveNotification({
                          id: `notif-appr-${Date.now()}`,
                          role: 'Production Admin',
                          title: 'Production Verified & Approved',
                          message: `Work Order ${selectedWoForAcceptanceModal.id} approved by Production Head. ${selectedWoForAcceptanceModal.actualGoodOutput || selectedWoForAcceptanceModal.targetQty} ${selectedWoForAcceptanceModal.unit || 'pcs'} of ${selectedWoForAcceptanceModal.finishedProductName} added to FG Inventory.`,
                          time: 'Just now',
                          targetTab: 'Work Orders',
                          badgeColor: '#16A34A'
                        });
                        showCustomAlert(`✅ Work Order ${selectedWoForAcceptanceModal.id} Verified & Approved! Finished Goods stock (+${selectedWoForAcceptanceModal.actualGoodOutput || selectedWoForAcceptanceModal.targetQty} ${selectedWoForAcceptanceModal.unit || 'pcs'}) has been added to FG Inventory Store.`, 'Production Approved', 'success');
                        setSelectedWoForAcceptanceModal(null);
                        setSelectedRows([]);
                      } catch (err) {
                        showCustomAlert(`❌ Error approving production: ${err.message}`, 'Approval Error', 'error');
                      }
                    }}
                    style={{
                      padding: '9px 18px',
                      borderRadius: '8px',
                      border: 'none',
                      backgroundColor: '#16A34A',
                      color: '#FFFFFF',
                      fontSize: '13px',
                      fontWeight: '800',
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '6px',
                      boxShadow: '0 2px 8px rgba(22, 163, 74, 0.35)'
                    }}
                  >
                    <CheckCircle size={15} style={{ color: '#FFFFFF' }} /> Verify & Approve Production (Add FG Stock)
                  </button>
                ) : selectedWoForAcceptanceModal.status === 'APPROVED_CLOSED' ? (
                  <span style={{
                    padding: '6px 14px',
                    borderRadius: '20px',
                    backgroundColor: '#DCFCE7',
                    color: '#15803D',
                    border: '1px solid #86EFAC',
                    fontSize: '12px',
                    fontWeight: '800',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px'
                  }}>
                    <CheckCircle size={14} style={{ color: '#15803D' }} /> Approved & Closed (FG Stock Added)
                  </span>
                ) : null
              )}
            </div>
          </div>
        </div>
      )}

      {/* FLOATING BOTTOM ACTION BAR (MATCHES EXACT CONTROL ROOM FLOATING TOOLBAR DESIGN) */}
      {selectedRows.length > 0 && !selectedWoForStatusUpdate && !selectedWoForAcceptanceModal && (
        <div style={{
          position: 'fixed',
          bottom: '24px',
          left: '50%',
          transform: 'translateX(-50%)',
          backgroundColor: '#FFFFFF',
          border: '1px solid #E2E8F0',
          borderRadius: '16px',
          boxShadow: '0 10px 30px -5px rgba(0, 0, 0, 0.12), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
          padding: '8px 16px',
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          zIndex: 10000,
          fontFamily: "'Plus Jakarta Sans', 'DM Sans', sans-serif"
        }}>
          <span style={{ fontSize: '13px', fontWeight: '700', color: '#64748B', display: 'inline-flex', alignItems: 'center', gap: '4px', paddingRight: '6px' }}>
            <strong style={{ color: '#0F172A', fontSize: '14px' }}>{selectedRows.length}</strong> Selected
          </span>

          {/* ROLE SEPARATED FLOATING ACTIONS */}
          {isFloorEmployee ? (
            <>
              {/* VIEW WORK ORDER DETAILS (FLOOR EMPLOYEE) */}
              <button
                onClick={() => {
                  const targetId = selectedRows[0];
                  const targetRow = allWorkOrderRows.find(w => w.woNo === targetId) || allWorkOrderRows[0];
                  if (targetRow) {
                    setSelectedWoForAcceptanceModal(targetRow.rawWO || targetRow);
                  }
                }}
                style={{
                  backgroundColor: '#FFFFFF',
                  border: '1px solid #E2E8F0',
                  color: '#0F172A',
                  borderRadius: '10px',
                  padding: '6px 14px',
                  fontSize: '12px',
                  fontWeight: '700',
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  boxShadow: '0 1px 2px rgba(0,0,0,0.05)'
                }}
              >
                <Eye size={14} style={{ color: '#0F172A' }} /> View Details
              </button>

              {/* ACCEPT WORK ORDER ACTION (SHOWN WHENEVER ORDER IS NOT YET ACCEPTED/IN_PROGRESS) */}
              {(() => {
                const targetWO = selectedWoObjects[0] || prodModuleEngine.getWorkOrderById(selectedRows[0]);
                const woSt = String(targetWO?.status || '').toUpperCase();
                const canAcceptOrder = !(woSt === 'ACCEPTED' || woSt === 'IN_PROGRESS' || woSt === 'COMPLETED_PENDING_VERIFICATION' || woSt === 'APPROVED_CLOSED');

                return canAcceptOrder ? (
                  <button
                    onClick={() => {
                      const targetId = selectedRows[0];
                      try {
                        prodModuleEngine.acceptWorkOrder(targetId);
                        setEngineTick(t => t + 1);
                        showCustomAlert(`✅ Work Order ${targetId} has been ACCEPTED!`, 'Work Order Accepted', 'success');
                        setSelectedRows([]);
                      } catch (err) {
                        showCustomAlert(`❌ Error accepting Work Order: ${err.message}`, 'Acceptance Error', 'error');
                      }
                    }}
                    style={{
                      backgroundColor: '#7C3AED',
                      border: 'none',
                      color: '#FFFFFF',
                      borderRadius: '10px',
                      padding: '6px 14px',
                      fontSize: '12px',
                      fontWeight: '700',
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '6px',
                      boxShadow: '0 2px 6px rgba(124, 58, 237, 0.3)',
                      transition: 'all 0.15s ease'
                    }}
                  >
                    <CheckCircle size={14} style={{ color: '#FFFFFF' }} /> Accept WO
                  </button>
                ) : null;
              })()}

              {/* UPDATE STATUS ACTION */}
              <button
                onClick={() => {
                  const targetWO = selectedWoObjects[0] || prodModuleEngine.getWorkOrderById(selectedRows[0]) || prodModuleEngine.getWorkOrders()[0];
                  if (targetWO) {
                    setSelectedWoForStatusUpdate(targetWO);
                    setActualGoodOutputVal(String(targetWO.targetQty || ''));
                    setActualRejectedOutputVal('0');
                    setOperatorRemarksVal('');
                    setUpdateStatusChoice(targetWO.status === 'ACCEPTED' ? 'IN_PROGRESS' : 'IN_PROGRESS');
                  }
                }}
                style={{
                  backgroundColor: '#FFFFFF',
                  border: '1px solid #E2E8F0',
                  color: '#0284C7',
                  borderRadius: '10px',
                  padding: '6px 14px',
                  fontSize: '12px',
                  fontWeight: '700',
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
                  transition: 'all 0.15s ease'
                }}
                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#F0F9FF'}
                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#FFFFFF'}
              >
                <Edit3 size={14} style={{ color: '#0284C7' }} /> Update Status
              </button>
            </>
          ) : (
            <>
              {/* VIEW WORK ORDER DETAILS (PRODUCTION HEAD) */}
              <button
                onClick={() => {
                  const targetId = selectedRows[0];
                  const targetRow = allWorkOrderRows.find(w => w.woNo === targetId) || allWorkOrderRows[0];
                  if (targetRow) {
                    setSelectedWoForAcceptanceModal(targetRow.rawWO || targetRow);
                  }
                }}
                style={{
                  backgroundColor: '#FFFFFF',
                  border: '1px solid #E2E8F0',
                  color: '#0F172A',
                  borderRadius: '10px',
                  padding: '6px 14px',
                  fontSize: '12px',
                  fontWeight: '700',
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  boxShadow: '0 1px 2px rgba(0,0,0,0.05)'
                }}
              >
                <Eye size={14} style={{ color: '#0F172A' }} /> View Details
              </button>
              {(!isFloorEmployee && selectedWoObjects.some(w => w.status === 'COMPLETED_PENDING_VERIFICATION')) && (
                <button
                  onClick={() => {
                    let countApproved = 0;
                    selectedWoObjects.forEach(w => {
                      if (w.status === 'COMPLETED_PENDING_VERIFICATION') {
                        try {
                          prodModuleEngine.approveProduction(w.id);
                          countApproved++;
                        } catch (e) { }
                      }
                    });
                    if (countApproved > 0) {
                      addLiveNotification({
                        id: `notif-appr-${Date.now()}`,
                        role: 'Production Admin',
                        title: 'Production Verified & Approved',
                        message: `${countApproved} Work Orders verified & approved by Production Head. Finished Goods stock added to FG Store.`,
                        time: 'Just now',
                        targetTab: 'Work Orders',
                        badgeColor: '#16A34A'
                      });
                      showCustomAlert(`✅ ${countApproved} Work Orders Verified & Approved! Finished Goods stock has been added to FG Inventory Store.`, 'Production Approved', 'success');
                      setSelectedRows([]);
                    }
                  }}
                  style={{
                    backgroundColor: '#16A34A',
                    border: 'none',
                    color: '#FFFFFF',
                    borderRadius: '10px',
                    padding: '6px 14px',
                    fontSize: '12px',
                    fontWeight: '800',
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    boxShadow: '0 2px 6px rgba(22, 163, 74, 0.3)'
                  }}
                >
                  <CheckCircle size={14} style={{ color: '#FFFFFF' }} /> Approve Production & Add FG Stock
                </button>
              )}
            </>
          )}

          {/* CLEAR SELECTION BUTTON */}
          <button
            onClick={() => setSelectedRows([])}
            title="Clear selection"
            style={{
              backgroundColor: '#FFFFFF',
              border: '1px solid #E2E8F0',
              color: '#64748B',
              borderRadius: '10px',
              padding: '6px 10px',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
              transition: 'all 0.15s ease'
            }}
            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#F8FAFC'}
            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#FFFFFF'}
          >
            <X size={14} />
          </button>
        </div>
      )}

    </div>
  );
}
