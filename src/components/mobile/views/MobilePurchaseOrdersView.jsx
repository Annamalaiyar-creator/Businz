import React, { useState, useEffect, useMemo } from 'react';
import { ShoppingCart, Search, CheckCircle, ChevronRight, X, User, DollarSign } from 'lucide-react';

export default function MobilePurchaseOrdersView({ userRole, onNavigate }) {
  const [poList, setPoList] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('All');
  const [activePO, setActivePO] = useState(null);

  const isCeo = userRole === 'CEO' || userRole === 'MD' || userRole === 'Managing Director';

  const loadPOs = () => {
    fetch('/api/zoho/purchaseorders')
      .then(res => res.json())
      .then(data => {
        if (data && Array.isArray(data.purchaseorders)) {
          setPoList(data.purchaseorders);
        }
      })
      .catch(() => {});
  };

  useEffect(() => {
    loadPOs();
    window.addEventListener('controlroom_po_updated', loadPOs);
    window.addEventListener('controlroom_storage_update', loadPOs);
    return () => {
      window.removeEventListener('controlroom_po_updated', loadPOs);
      window.removeEventListener('controlroom_storage_update', loadPOs);
    };
  }, []);

  const filteredPOs = useMemo(() => {
    return (poList || []).filter(po => {
      const status = String(po.status || 'open').toLowerCase();
      if (selectedStatus === 'Approved' && (!status.includes('approved') && !status.includes('issued') && !status.includes('proceed'))) return false;
      if (selectedStatus === 'Pending' && (status.includes('approved') || status.includes('closed') || status.includes('billed'))) return false;

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const noMatch = String(po.purchaseorder_number || po.poNo || '').toLowerCase().includes(q);
        const vMatch = String(po.vendor_name || po.vendor || '').toLowerCase().includes(q);
        if (!noMatch && !vMatch) return false;
      }
      return true;
    });
  }, [poList, selectedStatus, searchQuery]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', paddingBottom: '90px', fontFamily: "'Plus Jakarta Sans', -apple-system, sans-serif" }}>
      {/* 1. Top Header */}
      <div style={{ backgroundColor: '#059669', color: '#FFFFFF', padding: '16px', borderRadius: '14px', boxShadow: '0 4px 12px rgba(5, 150, 105, 0.15)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.5px', color: '#A7F3D0', fontWeight: '700' }}>Procurement & Accounts</div>
            <h2 style={{ fontSize: '18px', fontWeight: '800', margin: '2px 0 0 0' }}>Purchase Orders</h2>
          </div>
          <div style={{ backgroundColor: 'rgba(255, 255, 255, 0.15)', padding: '6px 12px', borderRadius: '20px', fontSize: '12px', fontWeight: '800' }}>
            {filteredPOs.length} POs
          </div>
        </div>

        {/* Filter Pills */}
        <div style={{ display: 'flex', gap: '8px', marginTop: '12px' }}>
          {['All', 'Approved', 'Pending'].map(st => (
            <button
              key={st}
              onClick={() => setSelectedStatus(st)}
              style={{
                border: 'none',
                backgroundColor: selectedStatus === st ? '#FFFFFF' : 'rgba(255, 255, 255, 0.15)',
                color: selectedStatus === st ? '#059669' : '#FFFFFF',
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
          placeholder="Search PO Number, Vendor Name..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          style={{ width: '100%', height: '44px', borderRadius: '12px', border: '1px solid #E2E8F0', padding: '0 40px 0 38px', fontSize: '14px', backgroundColor: '#FFFFFF', outline: 'none', boxSizing: 'border-box' }}
        />
        <Search size={16} style={{ position: 'absolute', left: '12px', top: '14px', color: '#94A3B8' }} />
        {searchQuery && (
          <X size={16} onClick={() => setSearchQuery('')} style={{ position: 'absolute', right: '12px', top: '14px', color: '#94A3B8', cursor: 'pointer' }} />
        )}
      </div>

      {/* 3. PO Cards Feed */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        {filteredPOs.length === 0 ? (
          <div style={{ padding: '32px 16px', textAlign: 'center', backgroundColor: '#FFFFFF', borderRadius: '14px', border: '1px solid #E2E8F0', color: '#64748B' }}>
            <ShoppingCart size={32} style={{ color: '#CBD5E1', margin: '0 auto 8px auto' }} />
            <div style={{ fontSize: '14px', fontWeight: '700', color: '#0F172A' }}>No Purchase Orders found</div>
          </div>
        ) : (
          filteredPOs.map((po, idx) => {
            const num = po.purchaseorder_number || po.poNo || `PO-${idx + 1}`;
            const vendor = po.vendor_name || po.vendor || 'Authorized Supplier';
            const total = po.total || po.amount || 0;
            const status = String(po.status || 'Draft');
            const isApproved = status.toLowerCase().includes('approved') || status.toLowerCase().includes('issued') || status.toLowerCase().includes('proceed');

            return (
              <div
                key={num}
                onClick={() => setActivePO(po)}
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
                    <span style={{ fontSize: '13px', fontWeight: '800', color: '#059669', backgroundColor: '#ECFDF5', padding: '2px 8px', borderRadius: '6px' }}>
                      {num}
                    </span>
                    <span style={{ fontSize: '11px', color: '#64748B' }}>
                      {po.date || 'Today'}
                    </span>
                  </div>
                  <div style={{ fontSize: '14px', fontWeight: '700', color: '#0F172A', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {vendor}
                  </div>
                  <div style={{ fontSize: '13px', color: '#059669', fontWeight: '800', marginTop: '2px' }}>
                    ₹ {Number(total).toLocaleString('en-IN')}
                  </div>
                </div>

                <div style={{ textAlign: 'right', flexShrink: 0 }}>
                  <span style={{
                    backgroundColor: isApproved ? '#ECFDF5' : '#FEF3C7',
                    color: isApproved ? '#065F46' : '#92400E',
                    border: `1px solid ${isApproved ? '#A7F3D0' : '#FDE68A'}`,
                    padding: '3px 8px',
                    borderRadius: '10px',
                    fontSize: '11px',
                    fontWeight: '800'
                  }}>
                    {status}
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

      {/* 4. Bottom Sheet Details Modal */}
      {activePO && (
        <div
          onClick={() => setActivePO(null)}
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
                <span style={{ fontSize: '12px', fontWeight: '800', color: '#059669', backgroundColor: '#ECFDF5', padding: '3px 8px', borderRadius: '6px' }}>
                  {activePO.purchaseorder_number || activePO.poNo}
                </span>
                <h3 style={{ fontSize: '16px', fontWeight: '800', color: '#0F172A', margin: '6px 0 2px 0' }}>
                  {activePO.vendor_name || activePO.vendor || 'Authorized Supplier'}
                </h3>
                <div style={{ fontSize: '14px', fontWeight: '800', color: '#059669', marginTop: '4px' }}>
                  Total: ₹ {Number(activePO.total || activePO.amount || 0).toLocaleString('en-IN')}
                </div>
              </div>
              <button
                onClick={() => setActivePO(null)}
                style={{ border: 'none', background: '#F1F5F9', borderRadius: '50%', width: '32px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#64748B' }}
              >
                <X size={16} />
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '13px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid #F1F5F9' }}>
                <span style={{ color: '#64748B' }}>Status</span>
                <strong style={{ color: '#059669' }}>{activePO.status || 'Draft'}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid #F1F5F9' }}>
                <span style={{ color: '#64748B' }}>Issued Date</span>
                <strong style={{ color: '#0F172A' }}>{activePO.date || 'Today'}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid #F1F5F9' }}>
                <span style={{ color: '#64748B' }}>Line Items</span>
                <strong style={{ color: '#0F172A' }}>{activePO.line_items?.length || 0} Items</strong>
              </div>
            </div>

            <button
              onClick={() => setActivePO(null)}
              style={{
                backgroundColor: '#059669',
                color: '#FFFFFF',
                border: 'none',
                height: '44px',
                borderRadius: '10px',
                fontSize: '14px',
                fontWeight: '700',
                cursor: 'pointer',
                marginTop: '8px'
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
