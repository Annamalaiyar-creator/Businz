import React, { useState } from 'react';
import { SlidersHorizontal, ArrowUpDown } from 'lucide-react';
import StatusBadge from './StatusBadge';

export default function RecentPurchaseOrders({ purchaseOrders: realPurchaseOrders = [], isLoading = false }) {
  const [selectedPOs, setSelectedPOs] = useState([]);

  const safeRealOrders = Array.isArray(realPurchaseOrders) ? realPurchaseOrders : [];
  const purchaseOrders = safeRealOrders.slice(0, 5);

  const handleSelectAll = (e) => {
    if (e.target.checked) {
      setSelectedPOs(purchaseOrders.map(po => po.poNo));
    } else {
      setSelectedPOs([]);
    }
  };

  const handleSelectRow = (poNo) => {
    if (selectedPOs.includes(poNo)) {
      setSelectedPOs(selectedPOs.filter(item => item !== poNo));
    } else {
      setSelectedPOs([...selectedPOs, poNo]);
    }
  };

  const renderStatusBadge = (type, label) => {
    return <StatusBadge status={label || type} size="sm" />;
  };

  return (
    <div 
      style={{ 
        backgroundColor: '#FFFFFF',
        borderRadius: '12px',
        border: '1px solid #E2E8F0',
        padding: '14px 16px',
        display: 'flex',
        flexDirection: 'column',
        gap: '10px',
        boxShadow: '0 1px 3px rgba(0, 0, 0, 0.04)',
        width: '100%',
        boxSizing: 'border-box'
      }}
    >
      {/* Title Header Matching User Directive */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h3 style={{ fontSize: '12px', fontWeight: '800', margin: 0, color: '#1E3A8A', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
          Recent Purchase Orders
        </h3>
      </div>

      {/* Inner Rounded Table Box */}
      <div style={{ border: '1px solid #F1F5F9', borderRadius: '10px', overflow: 'hidden', backgroundColor: '#FFFFFF' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px', textAlign: 'left' }}>
          <thead>
            <tr style={{ backgroundColor: '#F8FAFC', borderBottom: '1px solid #F1F5F9' }}>
              <th style={{ padding: '8px 12px', color: '#94A3B8', fontWeight: '700', fontSize: '10.5px' }}>
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                  PO No. <ArrowUpDown style={{ width: '11px', height: '11px', color: '#94A3B8' }} />
                </div>
              </th>
              <th style={{ padding: '8px 12px', color: '#94A3B8', fontWeight: '700', fontSize: '10.5px' }}>Vendor</th>
              <th style={{ padding: '8px 12px', color: '#94A3B8', fontWeight: '700', fontSize: '10.5px', textAlign: 'right' }}>Amount</th>
              <th style={{ padding: '8px 12px', color: '#94A3B8', fontWeight: '700', fontSize: '10.5px' }}>Delivery Date</th>
              <th style={{ padding: '8px 12px', color: '#94A3B8', fontWeight: '700', fontSize: '10.5px', textAlign: 'center' }}>Status</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              Array.from({ length: 5 }).map((_, idx) => (
                <tr key={idx} style={{ borderBottom: idx === 4 ? 'none' : '1px solid #F1F5F9' }}>
                  <td style={{ padding: '8px 12px' }}><div className="skeleton-shimmer skeleton-text" style={{ width: '80%', height: '12px' }} /></td>
                  <td style={{ padding: '8px 12px' }}><div className="skeleton-shimmer skeleton-text" style={{ width: '70%', height: '12px' }} /></td>
                  <td style={{ padding: '8px 12px' }}><div className="skeleton-shimmer skeleton-text" style={{ width: '60%', height: '12px' }} /></td>
                  <td style={{ padding: '8px 12px' }}><div className="skeleton-shimmer skeleton-text" style={{ width: '60%', height: '12px' }} /></td>
                  <td style={{ padding: '8px 12px' }}><div className="skeleton-shimmer skeleton-text" style={{ width: '60px', height: '16px', borderRadius: '8px' }} /></td>
                </tr>
              ))
            ) : purchaseOrders.length === 0 ? (
              <tr>
                <td colSpan={5} style={{ padding: '28px 12px', textAlign: 'center', color: '#94A3B8', fontSize: '12px' }}>
                  No recent purchase orders created yet.
                </td>
              </tr>
            ) : (
              purchaseOrders.map((po, idx) => {
                return (
                  <tr 
                    key={idx} 
                    style={{ 
                      borderBottom: idx === purchaseOrders.length - 1 ? 'none' : '1px solid #F1F5F9',
                      transition: 'background-color 0.15s ease'
                    }}
                  >
                    <td style={{ padding: '8px 12px', color: '#64748B', fontWeight: '600' }}>
                      {po.poNo}
                    </td>
                    <td style={{ padding: '8px 12px', fontWeight: '700', color: '#0F172A' }}>
                      {po.vendor}
                    </td>
                    <td style={{ padding: '8px 12px', fontWeight: '700', color: '#0F172A', textAlign: 'right' }}>
                      {po.amount}
                    </td>
                    <td style={{ padding: '8px 12px', color: '#64748B' }}>
                      {po.deliveryDate}
                    </td>
                    <td style={{ padding: '8px 12px', textAlign: 'center' }}>
                      {renderStatusBadge(po.statusType, po.status)}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
