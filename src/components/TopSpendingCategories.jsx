import React from 'react';
import { Package, Sun, Zap, Settings } from 'lucide-react';

export default function TopSpendingCategories({ purchaseOrders = [] }) {
  const safeOrders = Array.isArray(purchaseOrders) ? purchaseOrders : [];

  // Group purchase orders by category or item type dynamically
  const categoryMap = new Map();
  let totalSpend = 0;

  safeOrders.forEach(po => {
    const amt = Number(String(po.amount || po.total || 0).replace(/[^0-9.]+/g, '')) || 0;
    if (amt <= 0) return;
    totalSpend += amt;
    const cat = po.category || (Array.isArray(po.items) && po.items[0]?.account) || 'General Procurement';
    categoryMap.set(cat, (categoryMap.get(cat) || 0) + amt);
  });

  const categories = Array.from(categoryMap.entries()).map(([name, amount]) => {
    const pctNum = totalSpend > 0 ? ((amount / totalSpend) * 100).toFixed(1) : '0';
    return {
      name,
      amount: `₹${amount.toLocaleString('en-IN')}`,
      percentage: `${pctNum}%`,
      pctWidth: `${pctNum}%`,
      color: '#0E7490',
      icon: Package
    };
  });

  return (
    <div className="section-card">
      <div 
        className="section-card-title" 
        style={{ justifyContent: 'space-between', borderBottom: 'none', marginBottom: 'var(--spacing-8)' }}
      >
        <span>Top Spending Categories</span>
        <a href="#" style={{ fontSize: '11px', fontWeight: 'bold', color: 'var(--color-primary-blue)' }}>
          View Report
        </a>
      </div>
      
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-12)', flex: 1 }}>
        {categories.length === 0 ? (
          <div style={{ padding: '24px 12px', textAlign: 'center', color: '#94A3B8', fontSize: '12px' }}>
            No spending recorded yet.
          </div>
        ) : (
          categories.map((cat, idx) => {
          const IconComponent = cat.icon;
          return (
            <div key={idx} className="category-item" style={{ marginBottom: idx === categories.length - 1 ? 0 : '' }}>
              <div className="category-header">
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <IconComponent style={{ width: '14px', height: '14px', color: 'var(--color-text-secondary)' }} />
                  <span>{cat.name}</span>
                </div>
                <div className="category-details">
                  <span style={{ fontWeight: 'bold', color: 'var(--color-text-primary)' }}>{cat.amount}</span>
                  <span>{cat.percentage} of Spend</span>
                </div>
              </div>
              <div className="category-progress-bg">
                <div 
                  className="category-progress-fill" 
                  style={{ width: cat.percentage, backgroundColor: cat.color }}
                ></div>
              </div>
            </div>
          );
        })
      )}
      </div>
    </div>
  );
}
