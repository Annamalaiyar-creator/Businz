import React, { useState, useEffect, useMemo } from 'react';
import { Search, GitBranch, Plus, ChevronRight, X, Clock, CheckCircle2, AlertCircle, FileText, User } from 'lucide-react';

export default function MobileBomOrdersView({ userRole, onNavigate, onOpenCreateBom }) {
  const [bomList, setBomList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('All'); // 'All' | 'Confirmed' | 'Draft'
  const [activeBom, setActiveBom] = useState(null);

  const loadBoms = () => {
    setLoading(true);
    fetch('/api/boms')
      .then(res => res.json())
      .then(data => {
        if (data && Array.isArray(data.data)) {
          setBomList(data.data);
          try {
            localStorage.setItem('controlroom_bom_store', JSON.stringify(data.data));
          } catch (_) {}
        }
      })
      .catch(() => {
        try {
          const saved = localStorage.getItem('controlroom_bom_store');
          if (saved) setBomList(JSON.parse(saved));
        } catch (_) {}
      })
      .finally(() => {
        setLoading(false);
      });
  };

  useEffect(() => {
    loadBoms();
    window.addEventListener('controlroom_bom_updated', loadBoms);
    window.addEventListener('controlroom_bom_store_updated', loadBoms);
    window.addEventListener('controlroom_storage_update', loadBoms);
    return () => {
      window.removeEventListener('controlroom_bom_updated', loadBoms);
      window.removeEventListener('controlroom_bom_store_updated', loadBoms);
      window.removeEventListener('controlroom_storage_update', loadBoms);
    };
  }, []);

  const filteredBoms = useMemo(() => {
    return (bomList || []).filter(b => {
      const status = String(b.status || 'Active').toLowerCase();
      if (selectedStatus === 'Confirmed' && !status.includes('confirmed')) return false;
      if (selectedStatus === 'Draft' && (status.includes('confirmed') || status.includes('delivered'))) return false;

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const codeMatch = String(b.bomCode || b.code || b.id || '').toLowerCase().includes(q);
        const custMatch = String(b.customerName || b.customer || '').toLowerCase().includes(q);
        const piMatch = String(b.piNo || b.sourcePi || '').toLowerCase().includes(q);
        if (!codeMatch && !custMatch && !piMatch) return false;
      }
      return true;
    });
  }, [bomList, selectedStatus, searchQuery]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', paddingBottom: '90px', fontFamily: "'Plus Jakarta Sans', -apple-system, sans-serif" }}>
      {/* 1. Top Header */}
      <div style={{ backgroundColor: '#2563EB', color: '#FFFFFF', padding: '16px', borderRadius: '14px', boxShadow: '0 4px 12px rgba(37, 99, 235, 0.15)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.5px', color: '#BFDBFE', fontWeight: '700' }}>Sales & Production</div>
            <h2 style={{ fontSize: '18px', fontWeight: '800', margin: '2px 0 0 0' }}>BOM Orders</h2>
          </div>
          <div style={{ backgroundColor: 'rgba(255, 255, 255, 0.15)', padding: '6px 12px', borderRadius: '20px', fontSize: '12px', fontWeight: '800' }}>
            {filteredBoms.length} Active
          </div>
        </div>

        {/* Filter Pills */}
        <div style={{ display: 'flex', gap: '8px', marginTop: '12px' }}>
          {['All', 'Confirmed', 'Draft'].map(st => (
            <button
              key={st}
              onClick={() => setSelectedStatus(st)}
              style={{
                border: 'none',
                backgroundColor: selectedStatus === st ? '#FFFFFF' : 'rgba(255, 255, 255, 0.15)',
                color: selectedStatus === st ? '#2563EB' : '#FFFFFF',
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
          placeholder="Search BOM Code, Customer, PI No..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          style={{ width: '100%', height: '44px', borderRadius: '12px', border: '1px solid #E2E8F0', padding: '0 40px 0 38px', fontSize: '14px', backgroundColor: '#FFFFFF', outline: 'none', boxSizing: 'border-box' }}
        />
        <Search size={16} style={{ position: 'absolute', left: '12px', top: '14px', color: '#94A3B8' }} />
        {searchQuery && (
          <X size={16} onClick={() => setSearchQuery('')} style={{ position: 'absolute', right: '12px', top: '14px', color: '#94A3B8', cursor: 'pointer' }} />
        )}
      </div>

      {/* 3. BOM Cards Feed */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        {loading ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <div style={{ padding: '14px 16px', backgroundColor: '#F0FDFA', borderRadius: '12px', border: '1px solid #CCFBF1', display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div className="businz-spin-ring-sm" />
              <div style={{ fontSize: '13px', fontWeight: '700', color: '#0E7490' }}>
                Loading BOM Orders & Inventory...
              </div>
            </div>
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} style={{ backgroundColor: '#FFFFFF', borderRadius: '12px', border: '1px solid #E2E8F0', padding: '14px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <div className="skeleton-shimmer skeleton-text" style={{ width: '80px', height: '14px' }} />
                <div className="skeleton-shimmer skeleton-text" style={{ width: '65%', height: '16px' }} />
                <div className="skeleton-shimmer skeleton-text" style={{ width: '45%', height: '12px' }} />
              </div>
            ))}
          </div>
        ) : filteredBoms.length === 0 ? (
          <div style={{ padding: '32px 16px', textAlign: 'center', backgroundColor: '#FFFFFF', borderRadius: '14px', border: '1px solid #E2E8F0', color: '#64748B' }}>
            <GitBranch size={32} style={{ color: '#CBD5E1', margin: '0 auto 8px auto' }} />
            <div style={{ fontSize: '14px', fontWeight: '700', color: '#0F172A' }}>No BOM orders found</div>
          </div>
        ) : (
          filteredBoms.map((b, idx) => {
            const code = b.bomCode || b.code || b.id || `BOM-${idx + 1}`;
            const customer = b.customerName || b.customer || 'Direct Client';
            const itemsCount = Array.isArray(b.items) ? b.items.length : 0;
            const status = String(b.status || 'Active');
            const isConfirmed = status.toLowerCase().includes('confirmed');

            return (
              <div
                key={code}
                onClick={() => setActiveBom(b)}
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
                    <span style={{ fontSize: '13px', fontWeight: '800', color: '#2563EB', backgroundColor: '#EFF6FF', padding: '2px 8px', borderRadius: '6px' }}>
                      {code}
                    </span>
                    <span style={{ fontSize: '11px', color: '#64748B' }}>
                      {b.date || b.createdAt ? new Date(b.date || b.createdAt).toLocaleDateString('en-GB') : 'Today'}
                    </span>
                  </div>
                  <div style={{ fontSize: '14px', fontWeight: '700', color: '#0F172A', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {customer}
                  </div>
                  <div style={{ fontSize: '11.5px', color: '#64748B', marginTop: '2px' }}>
                    {itemsCount} Allocated Line Items {b.piNo ? `• PI: ${b.piNo}` : ''}
                  </div>
                </div>

                <div style={{ textAlign: 'right', flexShrink: 0 }}>
                  <span style={{
                    backgroundColor: isConfirmed ? '#F0FDF4' : '#EFF6FF',
                    color: isConfirmed ? '#166534' : '#1E40AF',
                    border: `1px solid ${isConfirmed ? '#DCFCE7' : '#DBEAFE'}`,
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
      {activeBom && (
        <div
          onClick={() => setActiveBom(null)}
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
              maxHeight: '85vh',
              overflowY: 'auto',
              display: 'flex',
              flexDirection: 'column',
              gap: '16px'
            }}
          >
            <div style={{ width: '40px', height: '4px', backgroundColor: '#CBD5E1', borderRadius: '2px', margin: '0 auto 8px auto' }} />

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <span style={{ fontSize: '12px', fontWeight: '800', color: '#2563EB', backgroundColor: '#EFF6FF', padding: '3px 8px', borderRadius: '6px' }}>
                  {activeBom.bomCode || activeBom.code || activeBom.id}
                </span>
                <h3 style={{ fontSize: '16px', fontWeight: '800', color: '#0F172A', margin: '6px 0 2px 0' }}>
                  {activeBom.customerName || activeBom.customer || 'Direct Client'}
                </h3>
                <div style={{ fontSize: '12px', color: '#64748B' }}>
                  Status: <strong style={{ color: '#2563EB' }}>{activeBom.status || 'Active'}</strong>
                </div>
              </div>
              <button
                onClick={() => setActiveBom(null)}
                style={{ border: 'none', background: '#F1F5F9', borderRadius: '50%', width: '32px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#64748B' }}
              >
                <X size={16} />
              </button>
            </div>

            {/* Line Items List */}
            <div>
              <div style={{ fontSize: '13px', fontWeight: '700', color: '#0F172A', marginBottom: '8px' }}>
                Allocated Products & Materials ({activeBom.items?.length || 0})
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {(activeBom.items || []).map((it, i) => (
                  <div key={i} style={{ backgroundColor: '#F8FAFC', borderRadius: '8px', padding: '10px 12px', border: '1px solid #E2E8F0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <strong style={{ fontSize: '13px', color: '#0F172A' }}>{it.name || it.description || it.code}</strong>
                      <div style={{ fontSize: '11px', color: '#64748B' }}>Code: {it.code || '—'}</div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <strong style={{ fontSize: '14px', color: '#2563EB' }}>{it.qty || it.bomQty || 1} {it.unit || it.uom || 'Nos'}</strong>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <button
              onClick={() => setActiveBom(null)}
              style={{
                backgroundColor: '#2563EB',
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
              Close Details
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
