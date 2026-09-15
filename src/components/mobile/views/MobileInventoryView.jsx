import React, { useState, useEffect, useMemo } from 'react';
import { Search, Package, X, ShieldCheck } from 'lucide-react';

export default function MobileInventoryView({ userRole }) {
  const [materials, setMaterials] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedFilter, setSelectedFilter] = useState('All'); // 'All' | 'Sufficient' | 'Low' | 'Out'
  const [selectedItem, setSelectedItem] = useState(null);

  const isSalesUser = userRole === 'Sales Executive' || userRole === 'Sales Head' || String(userRole || '').toLowerCase().includes('sales');

  const loadStock = () => {
    try {
      const saved = localStorage.getItem('controlroom_raw_materials_store');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setMaterials(parsed);
          return;
        }
      }
    } catch (_) {}

    // Fallback fetch from database
    fetch('/api/store/raw_materials_store')
      .then(r => r.json())
      .then(res => {
        if (Array.isArray(res?.data) && res.data.length > 0) {
          setMaterials(res.data);
          try {
            localStorage.setItem('controlroom_raw_materials_store', JSON.stringify(res.data));
          } catch (_) {}
        }
      })
      .catch(() => {});
  };

  useEffect(() => {
    loadStock();
    window.addEventListener('controlroom_raw_materials_update', loadStock);
    window.addEventListener('controlroom_storage_update', loadStock);
    window.addEventListener('storage', loadStock);
    return () => {
      window.removeEventListener('controlroom_raw_materials_update', loadStock);
      window.removeEventListener('controlroom_storage_update', loadStock);
      window.removeEventListener('storage', loadStock);
    };
  }, []);

  const filteredMaterials = useMemo(() => {
    return materials.filter(m => {
      // Filter out dummy/empty items
      const c = String(m.code || '').toLowerCase();
      if (!m.code || m.code === '—' || c.includes('item') || c === 'rm-vrm' || c === 'mr100') return false;

      // Status filter
      if (selectedFilter === 'Sufficient' && m.status !== 'In Stock') return false;
      if (selectedFilter === 'Low' && m.status !== 'Low Stock') return false;
      if (selectedFilter === 'Out' && m.status !== 'Out of Stock') return false;

      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchCode = String(m.code || '').toLowerCase().includes(q);
        const matchName = String(m.name || '').toLowerCase().includes(q);
        const matchCat = String(m.cat || m.category || '').toLowerCase().includes(q);
        if (!matchCode && !matchName && !matchCat) return false;
      }
      return true;
    });
  }, [materials, selectedFilter, searchQuery]);

  const stats = useMemo(() => {
    let sufficient = 0;
    let low = 0;
    let out = 0;
    materials.forEach(m => {
      if (m.status === 'In Stock') sufficient++;
      else if (m.status === 'Low Stock') low++;
      else if (m.status === 'Out of Stock') out++;
    });
    return { total: materials.length, sufficient, low, out };
  }, [materials]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', paddingBottom: '90px', fontFamily: "'Plus Jakarta Sans', -apple-system, sans-serif" }}>
      {/* 1. Header Card */}
      <div style={{ backgroundColor: '#0E7490', color: '#FFFFFF', padding: '16px', borderRadius: '14px', boxShadow: '0 4px 12px rgba(14, 116, 144, 0.15)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.5px', color: '#A5F3FC', fontWeight: '700' }}>Live Stores & Materials</div>
            <h2 style={{ fontSize: '18px', fontWeight: '800', margin: '2px 0 0 0' }}>Inventory Balances</h2>
          </div>
          <div style={{ backgroundColor: 'rgba(255, 255, 255, 0.15)', padding: '6px 12px', borderRadius: '20px', fontSize: '12px', fontWeight: '800' }}>
            {filteredMaterials.length} Items
          </div>
        </div>

        {/* Mini KPI Tickers */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px', marginTop: '14px' }}>
          <div
            onClick={() => setSelectedFilter(selectedFilter === 'Sufficient' ? 'All' : 'Sufficient')}
            style={{ backgroundColor: selectedFilter === 'Sufficient' ? '#FFFFFF' : 'rgba(255, 255, 255, 0.12)', color: selectedFilter === 'Sufficient' ? '#0E7490' : '#FFFFFF', padding: '8px', borderRadius: '10px', textAlign: 'center', cursor: 'pointer', transition: 'all 0.15s ease' }}
          >
            <div style={{ fontSize: '10px', fontWeight: '600', opacity: 0.9 }}>Sufficient</div>
            <div style={{ fontSize: '15px', fontWeight: '800' }}>{stats.sufficient}</div>
          </div>
          <div
            onClick={() => setSelectedFilter(selectedFilter === 'Low' ? 'All' : 'Low')}
            style={{ backgroundColor: selectedFilter === 'Low' ? '#FFFFFF' : 'rgba(255, 255, 255, 0.12)', color: selectedFilter === 'Low' ? '#C2410C' : '#FFFFFF', padding: '8px', borderRadius: '10px', textAlign: 'center', cursor: 'pointer', transition: 'all 0.15s ease' }}
          >
            <div style={{ fontSize: '10px', fontWeight: '600', opacity: 0.9 }}>Reorder</div>
            <div style={{ fontSize: '15px', fontWeight: '800' }}>{stats.low}</div>
          </div>
          <div
            onClick={() => setSelectedFilter(selectedFilter === 'Out' ? 'All' : 'Out')}
            style={{ backgroundColor: selectedFilter === 'Out' ? '#FFFFFF' : 'rgba(255, 255, 255, 0.12)', color: selectedFilter === 'Out' ? '#DC2626' : '#FFFFFF', padding: '8px', borderRadius: '10px', textAlign: 'center', cursor: 'pointer', transition: 'all 0.15s ease' }}
          >
            <div style={{ fontSize: '10px', fontWeight: '600', opacity: 0.9 }}>Out of Stock</div>
            <div style={{ fontSize: '15px', fontWeight: '800' }}>{stats.out}</div>
          </div>
        </div>
      </div>

      {isSalesUser && (
        <div style={{
          backgroundColor: '#EFF6FF',
          border: '1px solid #BFDBFE',
          borderRadius: '10px',
          padding: '8px 12px',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          fontSize: '11.5px',
          fontWeight: '600',
          color: '#1D4ED8'
        }}>
          <ShieldCheck size={16} color="#2563EB" />
          <span>View-Only Mode: Physical stock visibility enabled for Sales role.</span>
        </div>
      )}

      {/* 2. Search & Filter Bar */}
      <div style={{ position: 'relative' }}>
        <input
          type="text"
          placeholder="Search materials, item code..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          style={{ width: '100%', height: '44px', borderRadius: '12px', border: '1px solid #E2E8F0', padding: '0 40px 0 38px', fontSize: '14px', backgroundColor: '#FFFFFF', outline: 'none', boxSizing: 'border-box', boxShadow: '0 1px 2px rgba(0,0,0,0.03)' }}
        />
        <Search size={16} style={{ position: 'absolute', left: '12px', top: '14px', color: '#94A3B8' }} />
        {searchQuery && (
          <X size={16} onClick={() => setSearchQuery('')} style={{ position: 'absolute', right: '12px', top: '14px', color: '#94A3B8', cursor: 'pointer' }} />
        )}
      </div>

      {/* 3. Materials List Feed */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        {filteredMaterials.length === 0 ? (
          <div style={{ padding: '32px 16px', textAlign: 'center', backgroundColor: '#FFFFFF', borderRadius: '14px', border: '1px solid #E2E8F0', color: '#64748B' }}>
            <Package size={32} style={{ color: '#CBD5E1', margin: '0 auto 8px auto' }} />
            <div style={{ fontSize: '14px', fontWeight: '700', color: '#0F172A' }}>No materials match your search</div>
            <div style={{ fontSize: '12px', marginTop: '4px' }}>Try a different item code or filter</div>
          </div>
        ) : (
          filteredMaterials.map((mat, idx) => {
            const isOut = mat.status === 'Out of Stock';
            const isLow = mat.status === 'Low Stock';
            const statusBg = isOut ? '#FEF2F2' : isLow ? '#FFF7ED' : '#F0FDF4';
            const statusFg = isOut ? '#B91C1C' : isLow ? '#C2410C' : '#15803D';
            const statusBorder = isOut ? '#FEE2E2' : isLow ? '#FFEDD5' : '#DCFCE7';

            return (
              <div
                key={mat.code || idx}
                onClick={() => setSelectedItem(mat)}
                style={{
                  backgroundColor: '#FFFFFF',
                  borderRadius: '12px',
                  border: '1px solid #E2E8F0',
                  padding: '14px',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  boxShadow: '0 1px 3px rgba(0, 0, 0, 0.02)',
                  cursor: 'pointer',
                  transition: 'transform 0.1s ease',
                  WebkitTapHighlightColor: 'transparent'
                }}
              >
                <div style={{ minWidth: 0, flex: 1, paddingRight: '12px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
                    <span style={{ fontSize: '12px', fontWeight: '800', color: '#0E7490', backgroundColor: '#ECFEFF', padding: '2px 8px', borderRadius: '6px' }}>
                      {mat.code}
                    </span>
                    <span style={{ fontSize: '11px', color: '#64748B', fontWeight: '600' }}>
                      {mat.cat || mat.category || 'Aluminium'}
                    </span>
                  </div>
                  <div style={{ fontSize: '13.5px', fontWeight: '700', color: '#0F172A', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {mat.name}
                  </div>
                  <div style={{ fontSize: '11px', color: '#94A3B8', marginTop: '2px' }}>
                    Store: {mat.store || 'Main Store'}
                  </div>
                </div>

                <div style={{ textAlign: 'right', flexShrink: 0 }}>
                  <div style={{ fontSize: '16px', fontWeight: '800', color: isOut ? '#DC2626' : '#0F172A' }}>
                    {mat.stock} <span style={{ fontSize: '12px', fontWeight: '600', color: '#64748B' }}>{mat.unit || 'Nos'}</span>
                  </div>
                  <div style={{
                    marginTop: '4px',
                    display: 'inline-block',
                    backgroundColor: statusBg,
                    color: statusFg,
                    border: `1px solid ${statusBorder}`,
                    borderRadius: '12px',
                    padding: '2px 8px',
                    fontSize: '10.5px',
                    fontWeight: '800'
                  }}>
                    {mat.status || 'In Stock'}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* 4. Bottom Sheet Details Modal */}
      {selectedItem && (
        <div
          onClick={() => setSelectedItem(null)}
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
            {/* Sheet Handle */}
            <div style={{ width: '40px', height: '4px', backgroundColor: '#CBD5E1', borderRadius: '2px', margin: '0 auto 8px auto' }} />

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <span style={{ fontSize: '12px', fontWeight: '800', color: '#0E7490', backgroundColor: '#ECFEFF', padding: '3px 8px', borderRadius: '6px' }}>
                  {selectedItem.code}
                </span>
                <h3 style={{ fontSize: '16px', fontWeight: '800', color: '#0F172A', margin: '8px 0 0 0' }}>
                  {selectedItem.name}
                </h3>
              </div>
              <button
                onClick={() => setSelectedItem(null)}
                style={{ border: 'none', background: '#F1F5F9', borderRadius: '50%', width: '32px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#64748B' }}
              >
                <X size={16} />
              </button>
            </div>

            {/* Metrics Box */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '10px', backgroundColor: '#F8FAFC', padding: '14px', borderRadius: '12px', border: '1px solid #E2E8F0' }}>
              <div>
                <div style={{ fontSize: '11px', color: '#64748B', fontWeight: '600' }}>Available Physical Stock</div>
                <div style={{ fontSize: '18px', fontWeight: '800', color: '#0E7490', marginTop: '2px' }}>
                  {selectedItem.stock} {selectedItem.unit || 'Nos'}
                </div>
              </div>
              <div>
                <div style={{ fontSize: '11px', color: '#64748B', fontWeight: '600' }}>Safety / Min Level</div>
                <div style={{ fontSize: '18px', fontWeight: '800', color: '#334155', marginTop: '2px' }}>
                  {selectedItem.minLevel || 50} {selectedItem.unit || 'Nos'}
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '13px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid #F1F5F9' }}>
                <span style={{ color: '#64748B' }}>Category</span>
                <strong style={{ color: '#0F172A' }}>{selectedItem.cat || selectedItem.category || 'Aluminium'}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid #F1F5F9' }}>
                <span style={{ color: '#64748B' }}>Warehouse Location</span>
                <strong style={{ color: '#0F172A' }}>{selectedItem.store || 'Main Store'}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid #F1F5F9' }}>
                <span style={{ color: '#64748B' }}>Last Stock Movement</span>
                <strong style={{ color: '#0E7490' }}>{selectedItem.lastUpdated || 'Live Store'}</strong>
              </div>
            </div>

            <button
              onClick={() => setSelectedItem(null)}
              style={{
                backgroundColor: '#0E7490',
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
              Done & Return
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
