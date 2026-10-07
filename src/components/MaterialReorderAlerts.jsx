import React from 'react';
import { AlertTriangle } from 'lucide-react';

export default function MaterialReorderAlerts({ items = [], isLoading = false }) {
  const lowStockItems = items.filter(item => {
    const stock = Number(item.stockOnHand || 0);
    const reorder = Number(item.reorderLevel || 0);
    return reorder > 0 && stock <= reorder;
  });

  const alerts = lowStockItems.map((item, idx) => ({
    id: idx + 1,
    item: item.name,
    code: `Alert: #${item.sku || item.itemId || item.code}`,
    currentStock: `${item.stockOnHand || item.stock || 0} ${item.unit || 'nos'}`,
    reorderLevel: `${item.reorderLevel || item.minLevel || 0} ${item.unit || 'nos'}`,
    eta: 'Reorder Needed',
    supplier: 'Central Inventory',
    etaColor: '#eab308',
    tags: [
      { label: 'LOW STOCK', color: '#d97706', bg: '#fffbeb', border: '#fef3c7' },
      { label: (item.productType || 'Goods').toUpperCase(), color: '#2563eb', bg: '#eff6ff', border: '#dbeafe' }
    ]
  }));

  return (
    <div 
      className="section-card" 
      style={{ 
        display: 'flex', 
        flexDirection: 'column', 
        padding: '24px', 
        backgroundColor: 'white', 
        border: '1px solid var(--color-border)',
        borderRadius: 'var(--radius-card)',
        boxShadow: 'var(--shadow-sm)'
      }}
    >
      {/* Title Header inside the card */}
      <span style={{ fontSize: '15px', fontWeight: 'bold', color: 'var(--color-text-primary)', marginBottom: '16px' }}>
        Material Reorder Alerts
      </span>

      {/* Grid container rendering separate child cards */}
      <div 
        style={{ 
          display: 'grid', 
          gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', 
          gap: '20px' 
        }}
      >
        {isLoading ? (
          Array.from({ length: 3 }).map((_, idx) => (
            <div 
              key={idx}
              style={{ 
                display: 'flex', 
                flexDirection: 'column', 
                padding: '20px', 
                backgroundColor: '#f8fafc',
                border: '1px solid var(--color-border)',
                borderRadius: '12px',
                margin: 0
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '14px' }}>
                <div className="skeleton-shimmer" style={{ width: '36px', height: '36px', borderRadius: '8px' }} />
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', flex: 1 }}>
                  <div className="skeleton-shimmer skeleton-text" style={{ width: '70%', height: '12px' }} />
                  <div className="skeleton-shimmer skeleton-text" style={{ width: '40%', height: '10px' }} />
                </div>
              </div>

              <div 
                style={{ 
                  backgroundColor: 'white',
                  border: '1px solid #e2e8f0',
                  borderRadius: '10px',
                  padding: '12px 14px',
                  display: 'grid',
                  gridTemplateColumns: '1fr 1fr',
                  gap: '10px 12px',
                  marginBottom: '14px',
                  flex: 1
                }}
              >
                {Array.from({ length: 4 }).map((_, sIdx) => (
                  <div key={sIdx} style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <div className="skeleton-shimmer skeleton-text" style={{ width: '50%', height: '8px' }} />
                    <div className="skeleton-shimmer skeleton-text" style={{ width: '70%', height: '12px' }} />
                  </div>
                ))}
              </div>

              <div style={{ borderTop: '1px solid #e2e8f0', paddingTop: '10px', display: 'flex', gap: '6px' }}>
                <div className="skeleton-shimmer" style={{ width: '60px', height: '16px', borderRadius: '4px' }} />
                <div className="skeleton-shimmer" style={{ width: '80px', height: '16px', borderRadius: '4px' }} />
              </div>
            </div>
          ))
        ) : alerts.length === 0 ? (
          <div style={{
            gridColumn: '1 / -1',
            padding: '28px 16px',
            backgroundColor: '#F8FAFC',
            borderRadius: '12px',
            border: '1px dashed #CBD5E1',
            textAlign: 'center',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '6px'
          }}>
            <div style={{ width: '32px', height: '32px', borderRadius: '50%', backgroundColor: '#DCFCE7', color: '#16A34A', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold' }}>
              ✓
            </div>
            <span style={{ fontSize: '13px', fontWeight: '700', color: '#1E293B' }}>All Stock Levels Healthy</span>
            <span style={{ fontSize: '12px', color: '#64748B' }}>Zero materials or items currently require reordering.</span>
          </div>
        ) : (
          alerts.map((alert) => (
            <div 
              key={alert.id}
              style={{ 
                display: 'flex', 
                flexDirection: 'column', 
                padding: '20px', 
                backgroundColor: '#f8fafc', // soft off-white child card bg
                border: '1px solid var(--color-border)',
                borderRadius: '12px',
                margin: 0
              }}
            >
            {/* 1. Child Card Header */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '14px' }}>
              
              {/* Yellow Alert Logo */}
              <div 
                style={{ 
                  width: '36px', 
                  height: '36px', 
                  borderRadius: '8px', 
                  backgroundColor: '#facc15', // yellow
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0
                }}
              >
                <AlertTriangle style={{ width: '18px', height: '18px', color: '#1e293b' }} />
              </div>

              {/* Item details */}
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <strong style={{ fontSize: '13px', color: '#1e293b' }}>{alert.item}</strong>
                <span style={{ fontSize: '10px', color: '#64748b', marginTop: '1px' }}>{alert.code}</span>
              </div>

            </div>

            {/* 2. Key Metadata 2x2 Grid */}
            <div 
              style={{ 
                backgroundColor: 'white',
                border: '1px solid #e2e8f0',
                borderRadius: '10px',
                padding: '12px 14px',
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: '10px 12px',
                marginBottom: '14px',
                flex: 1
              }}
            >
              <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                <span style={{ fontSize: '8px', fontWeight: 'bold', color: '#94a3b8', textTransform: 'uppercase' }}>Current Stock</span>
                <span style={{ fontSize: '12px', fontWeight: 'bold', color: '#1e293b' }}>{alert.currentStock}</span>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                <span style={{ fontSize: '8px', fontWeight: 'bold', color: '#94a3b8', textTransform: 'uppercase' }}>Reorder Level</span>
                <span style={{ fontSize: '12px', fontWeight: 'bold', color: '#1e293b' }}>{alert.reorderLevel}</span>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                <span style={{ fontSize: '8px', fontWeight: 'bold', color: '#94a3b8', textTransform: 'uppercase' }}>ETA to Stock</span>
                <span style={{ fontSize: '12px', fontWeight: 'bold', color: alert.etaColor }}>{alert.eta}</span>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                <span style={{ fontSize: '8px', fontWeight: 'bold', color: '#94a3b8', textTransform: 'uppercase' }}>Supplier</span>
                <span style={{ fontSize: '12px', fontWeight: 'bold', color: '#1e293b' }}>{alert.supplier}</span>
              </div>
            </div>

            {/* 3. Bottom Tags pill Row */}
            <div 
              style={{ 
                borderTop: '1px solid #e2e8f0', 
                paddingTop: '10px', 
                display: 'flex', 
                flexWrap: 'wrap', 
                gap: '6px' 
              }}
            >
              {alert.tags.map((tag, idx) => (
                <span 
                  key={idx}
                  style={{
                    fontSize: '8px',
                    fontWeight: 'bold',
                    padding: '2px 6px',
                    borderRadius: '4px',
                    color: tag.color,
                    backgroundColor: tag.bg,
                    border: `1px solid ${tag.border}`
                  }}
                >
                  {tag.label}
                </span>
              ))}
            </div>

          </div>
        ))
      )}
      </div>
    </div>
  );
}

