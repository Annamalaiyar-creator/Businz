import React from 'react';
import { ArrowRight, Factory, FileCheck, ShoppingCart, Wallet } from 'lucide-react';
import { CeoKpiGrid } from '../views/CeoExecutiveDashboardView';

export default function CeoReportsTab({
  totalRevenueCr = '0.00',
  invList = [],
  totalPoSpendCr = '0.00',
  poList = [],
  totalProductionTonnage = 0,
  bomList = [],
  totalCollectedCr = '0.00',
  totalInvoicedNum = 0,
  totalCollectedNum = 0,
  outstandingOverdueCr = '0.00',
  onNavigateTab
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
      {/* Reports Top Ribbon (BUSINZ DESIGN SYSTEM) */}
      <CeoKpiGrid kpis={[
        {
          title: 'TOTAL INVOICED REVENUE',
          value: `₹ ${totalRevenueCr} Cr`,
          trend: `${invList.length} Invoices`,
          trendUp: invList.length > 0,
          icon: FileCheck,
          iconColor: '#0E7490',
          iconBg: '#ECFEFF',
          bottomPrefix: 'GST billing ',
          bottomHighlight: `${invList.length} Tax Invoices`,
          onClick: () => onNavigateTab && onNavigateTab('Sales Reports')
        },
        {
          title: 'TOTAL PROCUREMENT SPEND',
          value: `₹ ${totalPoSpendCr} Cr`,
          trend: `${poList.length} POs`,
          trendUp: poList.length > 0,
          icon: ShoppingCart,
          iconColor: '#2563EB',
          iconBg: '#EFF6FF',
          bottomPrefix: 'Purchase orders ',
          bottomHighlight: `${poList.length} Authorized POs`,
          onClick: () => onNavigateTab && onNavigateTab('Procurement Reports')
        },
        {
          title: 'PLANT PRODUCTION OUTPUT',
          value: `${Number(totalProductionTonnage || 0).toFixed(1)} MT`,
          trend: `${bomList.length} BOMs`,
          trendUp: bomList.length > 0,
          icon: Factory,
          iconColor: '#0284C7',
          iconBg: '#F0F9FF',
          bottomPrefix: 'Factory output ',
          bottomHighlight: `${bomList.length} BOM Orders`,
          onClick: () => onNavigateTab && onNavigateTab('Production Reports')
        },
        {
          title: 'COLLECTIONS REALIZED',
          value: `₹ ${totalCollectedCr} Cr`,
          trend: totalInvoicedNum > 0 ? `${((totalCollectedNum / totalInvoicedNum) * 100).toFixed(1)}%` : '0%',
          trendUp: totalCollectedNum > 0,
          icon: Wallet,
          iconColor: '#16A34A',
          iconBg: '#F0FDF4',
          bottomPrefix: 'Outstanding ',
          bottomHighlight: `₹ ${outstandingOverdueCr} Cr Pending`
        }
      ]} />

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '12px' }}>
        {[
          { title: 'Sales Analytics & Reports', desc: 'Quotation conversion, Proforma pipeline, and rep-wise revenue breakdown.', target: 'Sales Reports', color: '#0E7490', bg: '#ECFEFF' },
          { title: 'Operational & Production Reports', desc: 'Plant extrusion tonnage, BOM order completion, and dispatch turnaround.', target: 'Production Reports', color: '#0284C7', bg: '#F0F9FF' },
          { title: 'Inventory & Stock Analytics', desc: 'Raw material consumption, reserved stock, and reorder valuation.', target: 'Stock Status', color: '#059669', bg: '#ECFDF5' },
          { title: 'Financial & Procurement MIS', desc: 'Vendor spend analysis, PO history, GST tax billing, and cash flow.', target: 'Procurement Reports', color: '#7C3AED', bg: '#F5F3FF' }
        ].map((repCard, idx) => (
          <div key={idx} style={{ backgroundColor: '#FFFFFF', borderRadius: '16px', border: '1px solid #EAEFEF', padding: '16px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', gap: '10px' }}>
            <div>
              <span style={{ fontSize: '10px', fontWeight: '800', color: repCard.color, backgroundColor: repCard.bg, padding: '2px 8px', borderRadius: '6px', textTransform: 'uppercase' }}>MIS Report</span>
              <div style={{ fontSize: '13px', fontWeight: '800', color: '#0F172A', marginTop: '8px' }}>{repCard.title}</div>
              <p style={{ fontSize: '11px', color: '#64748B', margin: '4px 0 0 0', lineHeight: '1.4' }}>{repCard.desc}</p>
            </div>
            <button
              onClick={() => onNavigateTab && onNavigateTab(repCard.target)}
              style={{ border: 'none', backgroundColor: repCard.color, color: '#FFFFFF', padding: '7px 12px', borderRadius: '8px', fontSize: '11px', fontWeight: '700', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}
            >
              Open {repCard.title.split(' ')[0]} Report <ArrowRight size={12} />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
