import React from 'react';
import { AlertCircle, AlertTriangle, CheckCircle2, Factory } from 'lucide-react';
import { CeoKpiGrid } from '../views/CeoExecutiveDashboardView';
import CeoCreditApprovalsCard from '../views/CeoCreditApprovalsCard';
import { parseAmt } from './ceoDashboardUtils';

export default function CeoTasksTab({
  pendingMdPOs = [],
  poList = [],
  bomList = [],
  realRiskAlerts = [],
  onNavigateTab
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
      {/* Tasks Top Ribbon (BUSINZ DESIGN SYSTEM) */}
      <CeoKpiGrid kpis={[
        {
          title: 'PENDING MD PO APPROVALS',
          value: `${pendingMdPOs.length} POs`,
          trend: pendingMdPOs.length > 0 ? 'Sign-Off Needed' : 'Zero Pending',
          trendUp: pendingMdPOs.length === 0,
          highlightCard: pendingMdPOs.length > 0,
          icon: AlertCircle,
          iconColor: pendingMdPOs.length > 0 ? '#DC2626' : '#16A34A',
          iconBg: pendingMdPOs.length > 0 ? '#FEF2F2' : '#F0FDF4',
          bottomPrefix: 'Executive signature ',
          bottomHighlight: pendingMdPOs.length > 0 ? 'Awaiting CEO / MD' : 'All Approved',
          onClick: () => onNavigateTab && onNavigateTab('Purchase Orders', null, 'WAITING FOR APPROVAL')
        },
        {
          title: 'APPROVED POS HISTORY',
          value: `${Math.max(0, poList.length - pendingMdPOs.length)} Approved`,
          trend: 'Proceeded',
          trendUp: true,
          icon: CheckCircle2,
          iconColor: '#2563EB',
          iconBg: '#EFF6FF',
          bottomPrefix: 'Execution flow ',
          bottomHighlight: 'Proceeded to Payment & GRN'
        },
        {
          title: 'ACTIVE BOM APPROVALS',
          value: `${bomList.length} BOM Orders`,
          trend: `${bomList.length} Active`,
          trendUp: bomList.length > 0,
          icon: Factory,
          iconColor: '#0E7490',
          iconBg: '#ECFEFF',
          bottomPrefix: 'Workflow span ',
          bottomHighlight: 'Across Production & Dispatch',
          onClick: () => onNavigateTab && onNavigateTab('BOM Orders')
        },
        {
          title: 'CRITICAL ESCALATIONS',
          value: `${realRiskAlerts.length} Alerts`,
          trend: realRiskAlerts.length > 0 ? 'Watchlist' : 'Healthy',
          trendUp: realRiskAlerts.length === 0,
          highlightCard: realRiskAlerts.length > 0,
          icon: AlertTriangle,
          iconColor: realRiskAlerts.length > 0 ? '#D97706' : '#16A34A',
          iconBg: realRiskAlerts.length > 0 ? '#FFFBEB' : '#F0FDF4',
          bottomPrefix: 'Watchlist ',
          bottomHighlight: realRiskAlerts.length > 0 ? 'SLA & Overdue Watchlist' : 'Zero Critical Breaches'
        }
      ]} />

      <div style={{ backgroundColor: '#FFFFFF', borderRadius: '16px', border: '1px solid #EAEFEF', padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
          <div>
            <span style={{ fontSize: '13px', fontWeight: '800', color: '#0F172A', textTransform: 'uppercase' }}>9. Executive Approvals & Action Queue</span>
            <div style={{ fontSize: '11px', color: '#64748B', marginTop: '2px' }}>Authorize pending Purchase Orders and review high-priority operational tasks</div>
          </div>
          <button onClick={() => onNavigateTab && onNavigateTab('Purchase Orders', null, 'WAITING FOR APPROVAL')} style={{ border: 'none', backgroundColor: '#0E7490', color: '#FFFFFF', padding: '6px 14px', borderRadius: '8px', fontSize: '11.5px', fontWeight: '800', cursor: 'pointer' }}>
            PO Approval →
          </button>
        </div>

        <div style={{ border: '1px solid #F1F5F9', borderRadius: '10px', overflowX: 'auto' }}>
          <table style={{ width: '100%', fontSize: '11.5px', borderCollapse: 'collapse', textAlign: 'left' }}>
            <thead>
              <tr style={{ backgroundColor: '#F8FAFC', borderBottom: '1px solid #E2E8F0', color: '#64748B' }}>
                <th style={{ padding: '8px 10px' }}>Reference</th>
                <th style={{ padding: '8px 10px' }}>Vendor / Counterparty</th>
                <th style={{ padding: '8px 10px' }}>Value</th>
                <th style={{ padding: '8px 10px' }}>Current Stage</th>
                <th style={{ padding: '8px 10px', textAlign: 'right' }}>Action</th>
              </tr>
            </thead>
            <tbody>
              {pendingMdPOs.length > 0 ? pendingMdPOs.map((po, idx) => (
                <tr key={idx} style={{ borderBottom: '1px solid #F1F5F9' }}>
                  <td style={{ padding: '8px 10px', fontWeight: '800', color: '#2563EB' }}>{po.poNo || po.poNumber || po.purchaseorder_number || '-'}</td>
                  <td style={{ padding: '8px 10px', fontWeight: '700', color: '#0F172A' }}>{po.vendor || po.vendorName || po.vendor_name || 'Vendor'}</td>
                  <td style={{ padding: '8px 10px', fontWeight: '800' }}>₹ {(parseAmt(po.amount || po.total) / 100000).toFixed(2)} Lakhs</td>
                  <td style={{ padding: '8px 10px' }}>
                    <span style={{ fontSize: '10px', fontWeight: '800', padding: '2px 7px', borderRadius: '8px', backgroundColor: '#FEF2F2', color: '#DC2626' }}>
                      Awaiting MD Approval
                    </span>
                  </td>
                  <td style={{ padding: '8px 10px', textAlign: 'right' }}>
                    <button onClick={() => onNavigateTab && onNavigateTab('Purchase Orders', po.poNo || po.poNumber || po.purchaseorder_number || null, 'WAITING FOR APPROVAL')} style={{ border: 'none', backgroundColor: '#0E7490', color: '#FFFFFF', padding: '4px 10px', borderRadius: '6px', fontSize: '10.5px', fontWeight: '700', cursor: 'pointer' }}>
                      Review & Approve
                    </button>
                  </td>
                </tr>
              )) : (
                <tr><td colSpan={5} style={{ padding: '24px', textAlign: 'center', color: '#16A34A', fontWeight: '700' }}>All Purchase Orders are approved and up to date.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <CeoCreditApprovalsCard />
    </div>
  );
}
