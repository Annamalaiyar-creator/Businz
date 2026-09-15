import React, { useState, useEffect } from 'react';
import { Layers, GitBranch, ClipboardList, ShoppingCart, MessageSquare, AlertCircle, ArrowUpRight, TrendingUp } from 'lucide-react';

export default function MobileDashboardView({ userRole, onNavigateTab }) {
  const [metrics, setMetrics] = useState({
    totalBoms: 0,
    lowStock: 0,
    activeWOs: 0,
    pendingPOs: 0
  });

  const userName = localStorage.getItem('controlroom_logged_user_name') || userRole || 'User';

  const loadDashboardData = () => {
    try {
      // 1. Stock
      const stockStr = localStorage.getItem('controlroom_raw_materials_store');
      let low = 0;
      if (stockStr) {
        const mats = JSON.parse(stockStr);
        if (Array.isArray(mats)) {
          low = mats.filter(m => m.status === 'Low Stock' || m.status === 'Out of Stock').length;
        }
      }

      // 2. BOMs
      const bomStr = localStorage.getItem('controlroom_bom_store');
      let boms = 0;
      if (bomStr) {
        const b = JSON.parse(bomStr);
        if (Array.isArray(b)) boms = b.length;
      }

      // 3. WOs
      fetch('/api/workorders')
        .then(r => r.json())
        .then(d => {
          if (d?.workOrders) {
            const act = d.workOrders.filter(w => w.status !== 'Completed').length;
            setMetrics(prev => ({ ...prev, activeWOs: act }));
          }
        })
        .catch(() => {});

      // 4. POs
      fetch('/api/zoho/purchaseorders')
        .then(r => r.json())
        .then(d => {
          if (d?.purchaseorders) {
            const pend = d.purchaseorders.filter(p => (p.status || '').toLowerCase().includes('open') || (p.status || '').toLowerCase().includes('draft')).length;
            setMetrics(prev => ({ ...prev, pendingPOs: pend }));
          }
        })
        .catch(() => {});

      setMetrics(prev => ({ ...prev, totalBoms: boms, lowStock: low }));
    } catch (_) {}
  };

  useEffect(() => {
    loadDashboardData();
    window.addEventListener('controlroom_raw_materials_update', loadDashboardData);
    window.addEventListener('controlroom_bom_updated', loadDashboardData);
    window.addEventListener('controlroom_workorder_updated', loadDashboardData);
    window.addEventListener('controlroom_po_updated', loadDashboardData);
    window.addEventListener('controlroom_storage_update', loadDashboardData);
    return () => {
      window.removeEventListener('controlroom_raw_materials_update', loadDashboardData);
      window.removeEventListener('controlroom_bom_updated', loadDashboardData);
      window.removeEventListener('controlroom_workorder_updated', loadDashboardData);
      window.removeEventListener('controlroom_po_updated', loadDashboardData);
      window.removeEventListener('controlroom_storage_update', loadDashboardData);
    };
  }, []);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', paddingBottom: '90px', fontFamily: "'Plus Jakarta Sans', -apple-system, sans-serif" }}>
      {/* 1. Welcome Card */}
      <div style={{
        backgroundColor: '#0F172A',
        color: '#FFFFFF',
        borderRadius: '16px',
        padding: '18px',
        boxShadow: '0 4px 20px rgba(15, 23, 42, 0.15)',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center'
      }}>
        <div>
          <div style={{ fontSize: '11px', color: '#38BDF8', fontWeight: '800', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            Control Room Mobile
          </div>
          <h2 style={{ fontSize: '18px', fontWeight: '800', margin: '4px 0 2px 0' }}>
            {userName}
          </h2>
          <div style={{ fontSize: '12px', color: '#94A3B8' }}>
            Active Role: <strong style={{ color: '#F1F5F9' }}>{userRole}</strong>
          </div>
        </div>
        <div style={{ width: '42px', height: '42px', borderRadius: '50%', backgroundColor: '#1E293B', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid #334155' }}>
          <TrendingUp size={20} color="#38BDF8" />
        </div>
      </div>

      {/* 2. Key Metrics Grid (2x2) */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '12px' }}>
        {/* Metric 1: BOM Orders */}
        <div
          onClick={() => onNavigateTab('BOM')}
          style={{
            backgroundColor: '#FFFFFF',
            borderRadius: '14px',
            border: '1px solid #E2E8F0',
            padding: '14px',
            boxShadow: '0 1px 3px rgba(0,0,0,0.02)',
            cursor: 'pointer'
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ width: '32px', height: '32px', borderRadius: '8px', backgroundColor: '#EFF6FF', color: '#2563EB', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <GitBranch size={16} />
            </div>
            <span style={{ fontSize: '10.5px', color: '#2563EB', fontWeight: '800' }}>Active</span>
          </div>
          <div style={{ fontSize: '20px', fontWeight: '800', color: '#0F172A', marginTop: '10px' }}>
            {metrics.totalBoms}
          </div>
          <div style={{ fontSize: '11.5px', color: '#64748B', fontWeight: '600', marginTop: '2px' }}>
            BOM Orders
          </div>
        </div>

        {/* Metric 2: Stock Attention */}
        <div
          onClick={() => onNavigateTab('Stock')}
          style={{
            backgroundColor: '#FFFFFF',
            borderRadius: '14px',
            border: '1px solid #E2E8F0',
            padding: '14px',
            boxShadow: '0 1px 3px rgba(0,0,0,0.02)',
            cursor: 'pointer'
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ width: '32px', height: '32px', borderRadius: '8px', backgroundColor: '#FEF2F2', color: '#DC2626', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <AlertCircle size={16} />
            </div>
            <span style={{ fontSize: '10.5px', color: '#DC2626', fontWeight: '800' }}>Alerts</span>
          </div>
          <div style={{ fontSize: '20px', fontWeight: '800', color: '#0F172A', marginTop: '10px' }}>
            {metrics.lowStock}
          </div>
          <div style={{ fontSize: '11.5px', color: '#64748B', fontWeight: '600', marginTop: '2px' }}>
            Low Stock Items
          </div>
        </div>

        {/* Metric 3: Work Orders */}
        <div
          onClick={() => onNavigateTab('WorkOrders')}
          style={{
            backgroundColor: '#FFFFFF',
            borderRadius: '14px',
            border: '1px solid #E2E8F0',
            padding: '14px',
            boxShadow: '0 1px 3px rgba(0,0,0,0.02)',
            cursor: 'pointer'
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ width: '32px', height: '32px', borderRadius: '8px', backgroundColor: '#F5F3FF', color: '#7C3AED', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <ClipboardList size={16} />
            </div>
            <span style={{ fontSize: '10.5px', color: '#7C3AED', fontWeight: '800' }}>Floor</span>
          </div>
          <div style={{ fontSize: '20px', fontWeight: '800', color: '#0F172A', marginTop: '10px' }}>
            {metrics.activeWOs}
          </div>
          <div style={{ fontSize: '11.5px', color: '#64748B', fontWeight: '600', marginTop: '2px' }}>
            Live Work Orders
          </div>
        </div>

        {/* Metric 4: Purchase Orders */}
        <div
          onClick={() => onNavigateTab('PurchaseOrders')}
          style={{
            backgroundColor: '#FFFFFF',
            borderRadius: '14px',
            border: '1px solid #E2E8F0',
            padding: '14px',
            boxShadow: '0 1px 3px rgba(0,0,0,0.02)',
            cursor: 'pointer'
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ width: '32px', height: '32px', borderRadius: '8px', backgroundColor: '#ECFDF5', color: '#059669', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <ShoppingCart size={16} />
            </div>
            <span style={{ fontSize: '10.5px', color: '#059669', fontWeight: '800' }}>Orders</span>
          </div>
          <div style={{ fontSize: '20px', fontWeight: '800', color: '#0F172A', marginTop: '10px' }}>
            {metrics.pendingPOs}
          </div>
          <div style={{ fontSize: '11.5px', color: '#64748B', fontWeight: '600', marginTop: '2px' }}>
            Purchase Orders
          </div>
        </div>
      </div>

      {/* 3. Quick Actions */}
      <div>
        <div style={{ fontSize: '13px', fontWeight: '800', color: '#0F172A', marginBottom: '8px' }}>
          Quick Shortcuts
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <div
            onClick={() => onNavigateTab('Stock')}
            style={{
              backgroundColor: '#FFFFFF',
              borderRadius: '12px',
              border: '1px solid #E2E8F0',
              padding: '12px 14px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              cursor: 'pointer'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div style={{ width: '32px', height: '32px', borderRadius: '8px', backgroundColor: '#ECFEFF', color: '#0E7490', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Layers size={16} />
              </div>
              <div>
                <div style={{ fontSize: '13.5px', fontWeight: '700', color: '#0F172A' }}>Check Stock & Stores</div>
                <div style={{ fontSize: '11px', color: '#64748B' }}>View aluminum profiles & finished goods</div>
              </div>
            </div>
            <ArrowUpRight size={16} color="#94A3B8" />
          </div>

          <div
            onClick={() => onNavigateTab('WhatsApp')}
            style={{
              backgroundColor: '#FFFFFF',
              borderRadius: '12px',
              border: '1px solid #E2E8F0',
              padding: '12px 14px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              cursor: 'pointer'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div style={{ width: '32px', height: '32px', borderRadius: '8px', backgroundColor: '#DCFCE7', color: '#16A34A', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <MessageSquare size={16} />
              </div>
              <div>
                <div style={{ fontSize: '13.5px', fontWeight: '700', color: '#0F172A' }}>WhatsApp CRM Inbox</div>
                <div style={{ fontSize: '11px', color: '#64748B' }}>Chat with customers in real-time</div>
              </div>
            </div>
            <ArrowUpRight size={16} color="#94A3B8" />
          </div>
        </div>
      </div>
    </div>
  );
}
