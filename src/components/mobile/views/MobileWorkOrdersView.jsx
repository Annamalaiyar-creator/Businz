import React, { useState, useEffect, useMemo } from 'react';
import { ClipboardList, Search, CheckCircle, Clock, ChevronRight, X, User, Play, AlertCircle } from 'lucide-react';
import { prodModuleEngine } from '../../../utils/productionModuleEngine';

export default function MobileWorkOrdersView({ userRole, onNavigate }) {
  const [workOrders, setWorkOrders] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('All'); // 'All' | 'In Progress' | 'Completed'
  const [activeWO, setActiveWO] = useState(null);

  const loadWorkOrders = () => {
    fetch('/api/workorders')
      .then(res => res.json())
      .then(data => {
        if (data && Array.isArray(data.workOrders)) {
          setWorkOrders(data.workOrders);
        }
      })
      .catch(() => {
        setWorkOrders(prodModuleEngine.getWorkOrders() || []);
      });
  };

  useEffect(() => {
    loadWorkOrders();
    window.addEventListener('controlroom_workorder_updated', loadWorkOrders);
    window.addEventListener('controlroom_storage_update', loadWorkOrders);
    return () => {
      window.removeEventListener('controlroom_workorder_updated', loadWorkOrders);
      window.removeEventListener('controlroom_storage_update', loadWorkOrders);
    };
  }, []);

  const filteredWOs = useMemo(() => {
    return (workOrders || []).filter(wo => {
      const status = String(wo.status || 'In Progress').toLowerCase();
      if (selectedStatus === 'Completed' && !status.includes('completed')) return false;
      if (selectedStatus === 'In Progress' && status.includes('completed')) return false;

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const idMatch = String(wo.id || wo.woId || '').toLowerCase().includes(q);
        const prodMatch = String(wo.product || wo.productName || '').toLowerCase().includes(q);
        const bomMatch = String(wo.bomCode || '').toLowerCase().includes(q);
        if (!idMatch && !prodMatch && !bomMatch) return false;
      }
      return true;
    });
  }, [workOrders, selectedStatus, searchQuery]);

  // Stage advancement handler
  const handleAdvanceStage = async (wo) => {
    const stages = ['Raw Material Prep', 'Extrusion / Cutting', 'Fabrication & Punching', 'Quality Inspection', 'Completed & Ready'];
    const currentStage = wo.currentStage || wo.stage || stages[0];
    const currentIndex = stages.indexOf(currentStage);
    const nextStage = currentIndex < stages.length - 1 ? stages[currentIndex + 1] : stages[stages.length - 1];
    const newStatus = nextStage === stages[stages.length - 1] ? 'Completed' : 'In Progress';

    const updated = {
      ...wo,
      currentStage: nextStage,
      stage: nextStage,
      status: newStatus,
      lastUpdated: new Date().toISOString()
    };

    try {
      await fetch('/api/workorders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ workOrder: updated })
      });
    } catch (_) {}

    loadWorkOrders();
    setActiveWO(null);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', paddingBottom: '90px', fontFamily: "'Plus Jakarta Sans', -apple-system, sans-serif" }}>
      {/* 1. Header Banner */}
      <div style={{ backgroundColor: '#7C3AED', color: '#FFFFFF', padding: '16px', borderRadius: '14px', boxShadow: '0 4px 12px rgba(124, 58, 237, 0.15)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.5px', color: '#DDD6FE', fontWeight: '700' }}>Factory Floor</div>
            <h2 style={{ fontSize: '18px', fontWeight: '800', margin: '2px 0 0 0' }}>Production Work Orders</h2>
          </div>
          <div style={{ backgroundColor: 'rgba(255, 255, 255, 0.15)', padding: '6px 12px', borderRadius: '20px', fontSize: '12px', fontWeight: '800' }}>
            {filteredWOs.length} WOs
          </div>
        </div>

        {/* Filter Pills */}
        <div style={{ display: 'flex', gap: '8px', marginTop: '12px' }}>
          {['All', 'In Progress', 'Completed'].map(st => (
            <button
              key={st}
              onClick={() => setSelectedStatus(st)}
              style={{
                border: 'none',
                backgroundColor: selectedStatus === st ? '#FFFFFF' : 'rgba(255, 255, 255, 0.15)',
                color: selectedStatus === st ? '#7C3AED' : '#FFFFFF',
                borderRadius: '8px',
                padding: '6px 14px',
                fontSize: '12px',
                fontWeight: '700',
                cursor: 'pointer'
              }}
            >
              {st}
            </button>
          ))}
        </div>
      </div>

      {/* 2. Search */}
      <div style={{ position: 'relative' }}>
        <input
          type="text"
          placeholder="Search Work Order ID, Product..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          style={{ width: '100%', height: '44px', borderRadius: '12px', border: '1px solid #E2E8F0', padding: '0 40px 0 38px', fontSize: '14px', backgroundColor: '#FFFFFF', outline: 'none', boxSizing: 'border-box' }}
        />
        <Search size={16} style={{ position: 'absolute', left: '12px', top: '14px', color: '#94A3B8' }} />
        {searchQuery && (
          <X size={16} onClick={() => setSearchQuery('')} style={{ position: 'absolute', right: '12px', top: '14px', color: '#94A3B8', cursor: 'pointer' }} />
        )}
      </div>

      {/* 3. Work Order Feed */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        {filteredWOs.length === 0 ? (
          <div style={{ padding: '32px 16px', textAlign: 'center', backgroundColor: '#FFFFFF', borderRadius: '14px', border: '1px solid #E2E8F0', color: '#64748B' }}>
            <ClipboardList size={32} style={{ color: '#CBD5E1', margin: '0 auto 8px auto' }} />
            <div style={{ fontSize: '14px', fontWeight: '700', color: '#0F172A' }}>No Work Orders found</div>
          </div>
        ) : (
          filteredWOs.map((wo, idx) => {
            const id = wo.id || wo.woId || `WO-${idx + 1}`;
            const isCompleted = String(wo.status || '').toLowerCase().includes('completed');
            const stage = wo.currentStage || wo.stage || 'In Progress';

            return (
              <div
                key={id}
                onClick={() => setActiveWO(wo)}
                style={{
                  backgroundColor: '#FFFFFF',
                  borderRadius: '12px',
                  border: '1px solid #E2E8F0',
                  padding: '14px',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  boxShadow: '0 1px 3px rgba(0, 0, 0, 0.02)',
                  cursor: 'pointer'
                }}
              >
                <div style={{ minWidth: 0, flex: 1, paddingRight: '10px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                    <span style={{ fontSize: '13px', fontWeight: '800', color: '#7C3AED', backgroundColor: '#F5F3FF', padding: '2px 8px', borderRadius: '6px' }}>
                      {id}
                    </span>
                    <span style={{ fontSize: '11px', color: '#64748B' }}>
                      {wo.bomCode || 'BOM Order'}
                    </span>
                  </div>
                  <div style={{ fontSize: '14px', fontWeight: '700', color: '#0F172A', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {wo.product || wo.productName || 'Solar Mounting Frame'}
                  </div>
                  <div style={{ fontSize: '11.5px', color: '#64748B', marginTop: '2px' }}>
                    Stage: <strong style={{ color: '#7C3AED' }}>{stage}</strong> • Qty: <strong>{wo.targetQty || wo.quantity || 100} Nos</strong>
                  </div>
                </div>

                <div style={{ textAlign: 'right', flexShrink: 0 }}>
                  <span style={{
                    backgroundColor: isCompleted ? '#F0FDF4' : '#F5F3FF',
                    color: isCompleted ? '#166534' : '#6D28D9',
                    border: `1px solid ${isCompleted ? '#DCFCE7' : '#DDD6FE'}`,
                    padding: '3px 8px',
                    borderRadius: '10px',
                    fontSize: '11px',
                    fontWeight: '800'
                  }}>
                    {wo.status || 'Active'}
                  </span>
                  <div style={{ marginTop: '6px', color: '#94A3B8' }}>
                    <ChevronRight size={16} />
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* 4. Bottom Sheet Details & Stage Advancement */}
      {activeWO && (
        <div
          onClick={() => setActiveWO(null)}
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(15, 23, 42, 0.6)',
            backdropFilter: 'blur(2px)',
            zIndex: 10000,
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'flex-end'
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              backgroundColor: '#FFFFFF',
              borderTopLeftRadius: '20px',
              borderTopRightRadius: '20px',
              padding: '20px',
              maxHeight: '80vh',
              overflowY: 'auto',
              display: 'flex',
              flexDirection: 'column',
              gap: '16px'
            }}
          >
            <div style={{ width: '40px', height: '4px', backgroundColor: '#CBD5E1', borderRadius: '2px', margin: '0 auto 8px auto' }} />

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <span style={{ fontSize: '12px', fontWeight: '800', color: '#7C3AED', backgroundColor: '#F5F3FF', padding: '3px 8px', borderRadius: '6px' }}>
                  {activeWO.id || activeWO.woId}
                </span>
                <h3 style={{ fontSize: '16px', fontWeight: '800', color: '#0F172A', margin: '6px 0 2px 0' }}>
                  {activeWO.product || activeWO.productName || 'Solar Mounting Frame'}
                </h3>
                <div style={{ fontSize: '12px', color: '#64748B' }}>
                  Target: <strong>{activeWO.targetQty || activeWO.quantity || 100} Nos</strong>
                </div>
              </div>
              <button
                onClick={() => setActiveWO(null)}
                style={{ border: 'none', background: '#F1F5F9', borderRadius: '50%', width: '32px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#64748B' }}
              >
                <X size={16} />
              </button>
            </div>

            {/* Current Stage Card */}
            <div style={{ backgroundColor: '#F8FAFC', padding: '14px', borderRadius: '12px', border: '1px solid #E2E8F0' }}>
              <div style={{ fontSize: '11px', color: '#64748B', fontWeight: '600' }}>Current Factory Floor Stage</div>
              <div style={{ fontSize: '16px', fontWeight: '800', color: '#7C3AED', marginTop: '2px' }}>
                {activeWO.currentStage || activeWO.stage || 'In Production'}
              </div>
              <div style={{ fontSize: '11.5px', color: '#64748B', marginTop: '4px' }}>
                Assigned: <strong>{activeWO.assignedSupervisor || 'Floor Supervisor & Dispatch Head'}</strong>
              </div>
            </div>

            {/* Progress Actions */}
            <button
              onClick={() => handleAdvanceStage(activeWO)}
              style={{
                backgroundColor: '#7C3AED',
                color: '#FFFFFF',
                border: 'none',
                height: '44px',
                borderRadius: '10px',
                fontSize: '14px',
                fontWeight: '700',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px'
              }}
            >
              <CheckCircle size={16} /> Progress to Next Stage
            </button>

            <button
              onClick={() => setActiveWO(null)}
              style={{
                backgroundColor: '#F1F5F9',
                color: '#475569',
                border: 'none',
                height: '44px',
                borderRadius: '10px',
                fontSize: '14px',
                fontWeight: '700',
                cursor: 'pointer'
              }}
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
