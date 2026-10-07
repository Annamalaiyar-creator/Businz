import React from 'react';
import { AlertTriangle } from 'lucide-react';

export default function MaterialReorderAlerts({ items = [], isLoading = false }) {
  const lowStockItems = items.filter(item => {
    const stock = Number(item.stockOnHand || 0);
    const reorder = Number(item.reorderLevel || 0);
    return reorder > 0 && stock <= reorder;
  });

  const defaultAlerts = [
    {
      id: 1,
      item: 'Alu. Rail 100 mm',
      code: 'Req: 12,500 Nos | Avail: 8,200 Nos',
      currentStock: '8,200 Nos',
      reorderLevel: '12,500 Nos',
      eta: 'Shortage: 4,300 Nos (High)',
      supplier: 'AKEYEM SONS',
      etaColor: '#ef4444',
      tags: [
        { label: 'SHORTAGE: 4,300 NOS', color: '#dc2626', bg: '#fef2f2', border: '#fee2e2' },
        { label: 'HIGH PRIORITY', color: '#ea580c', bg: '#fff7ed', border: '#ffedd5' }
      ]
    },
    {
      id: 2,
      item: 'Alu. Rail 60 mm',
      code: 'Req: 7,800 Nos | Avail: 5,100 Nos',
      currentStock: '5,100 Nos',
      reorderLevel: '7,800 Nos',
      eta: 'Shortage: 2,700 Nos (High)',
      supplier: 'ARUMUGA STEEL',
      etaColor: '#ef4444',
      tags: [
        { label: 'SHORTAGE: 2,700 NOS', color: '#dc2626', bg: '#fef2f2', border: '#fee2e2' },
        { label: 'HIGH PRIORITY', color: '#ea580c', bg: '#fff7ed', border: '#ffedd5' }
      ]
    },
    {
      id: 3,
      item: 'Mid Clamp 35 mm',
      code: 'Req: 18,000 Nos | Avail: 14,800 Nos',
      currentStock: '14,800 Nos',
      reorderLevel: '18,000 Nos',
      eta: 'Shortage: 3,200 Nos (Medium)',
      supplier: 'VAIBOV POLES',
      etaColor: '#eab308',
      tags: [
        { label: 'SHORTAGE: 3,200 NOS', color: '#d97706', bg: '#fffbeb', border: '#fef3c7' },
        { label: 'MEDIUM PRIORITY', color: '#ca8a04', bg: '#fef9c3', border: '#fef08a' }
      ]
    },
    {
      id: 4,
      item: 'T Nut M10',
      code: 'Req: 25,000 Nos | Avail: 21,600 Nos',
      currentStock: '21,600 Nos',
      reorderLevel: '25,000 Nos',
      eta: 'Shortage: 3,400 Nos (Medium)',
      supplier: 'KPR Mill',
      etaColor: '#eab308',
      tags: [
        { label: 'SHORTAGE: 3,400 NOS', color: '#d97706', bg: '#fffbeb', border: '#fef3c7' },
        { label: 'MEDIUM PRIORITY', color: '#ca8a04', bg: '#fef9c3', border: '#fef08a' }
      ]
    },
    {
      id: 5,
      item: 'HDG Pipe 50 NB',
      code: 'Req: 15,000 Kg | Avail: 10,900 Kg',
      currentStock: '10,900 Kg',
      reorderLevel: '15,000 Kg',
      eta: 'Shortage: 4,100 Kg (High)',
      supplier: 'SHREE GANESH TRADERS',
      etaColor: '#ef4444',
      tags: [
        { label: 'SHORTAGE: 4,100 KG', color: '#dc2626', bg: '#fef2f2', border: '#fee2e2' },
        { label: 'HIGH PRIORITY', color: '#ea580c', bg: '#fff7ed', border: '#ffedd5' }
      ]
    }
  ];

  const alerts = lowStockItems.length > 0 
    ? lowStockItems.map((item, idx) => ({
        id: idx + 1,
        item: item.name,
        code: `Alert: #${item.sku || item.itemId}`,
        currentStock: `${item.stockOnHand || 0} ${item.unit || 'nos'}`,
        reorderLevel: `${item.reorderLevel || 0} ${item.unit || 'nos'}`,
        eta: '3 Days (Medium)',
        supplier: 'Central Inventory',
        etaColor: '#eab308',
        tags: [
          { label: 'LOW STOCK', color: '#d97706', bg: '#fffbeb', border: '#fef3c7' },
          { label: (item.productType || 'Goods').toUpperCase(), color: '#2563eb', bg: '#eff6ff', border: '#dbeafe' }
        ]
      }))
    : defaultAlerts;

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

