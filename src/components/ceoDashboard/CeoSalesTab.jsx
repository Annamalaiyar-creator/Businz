import React from 'react';
import { DollarSign, Edit3, FileSpreadsheet, Receipt, Target } from 'lucide-react';
import { CeoKpiGrid } from '../views/CeoExecutiveDashboardView';
import { parseAmt } from './ceoDashboardUtils';

export default function CeoSalesTab({
  totalPiPipelineCr = '0.00',
  piList = [],
  quotesList = [],
  periodMultiplier = 1,
  totalPiPipelineNum = 0,
  onNavigateTab,
  setEditingTargetRep,
  setEditingTargetAmount,
  ceoTargetStore = {},
  setShowCeoTargetModal,
  teamDirectory = [],
  personPerformanceData = [],
  setActivePersonModal
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
      {/* Sales Top Ribbon (BUSINZ DESIGN SYSTEM) */}
      <CeoKpiGrid kpis={[
        {
          title: 'ACTIVE PROFORMAS (PI)',
          value: `₹ ${totalPiPipelineCr} Cr`,
          trend: `${piList.length} Active PIs`,
          trendUp: piList.length > 0,
          icon: Receipt,
          iconColor: '#0E7490',
          iconBg: '#ECFEFF',
          bottomPrefix: 'Pending BOM ',
          bottomHighlight: `${piList.length} Orders In-Queue`,
          onClick: () => onNavigateTab && onNavigateTab('Sales Proforma')
        },
        {
          title: 'QUOTATIONS PIPELINE',
          value: `₹ ${((quotesList.reduce((acc, q) => acc + parseAmt(q.amount || q.total || q.grandTotal || 0), 0) * periodMultiplier) / 10000000).toFixed(2)} Cr`,
          trend: `${quotesList.length} Quotes`,
          trendUp: quotesList.length > 0,
          icon: FileSpreadsheet,
          iconColor: '#2563EB',
          iconBg: '#EFF6FF',
          bottomPrefix: 'Total submitted ',
          bottomHighlight: `${quotesList.length} Commercial Quotes`
        },
        {
          title: 'QUOTE-TO-PI WIN RATE',
          value: quotesList.length > 0 && piList.length > 0 ? `${Math.min(100, Math.round((piList.length / quotesList.length) * 100))}%` : '0%',
          trend: quotesList.length > 0 ? `${piList.length} / ${quotesList.length}` : '0%',
          trendUp: quotesList.length > 0 && piList.length > 0,
          icon: Target,
          iconColor: '#16A34A',
          iconBg: '#F0FDF4',
          bottomPrefix: 'Pipeline velocity ',
          bottomHighlight: quotesList.length > 0 ? `${piList.length} PIs Generated` : 'Active Pipeline'
        },
        {
          title: 'AVERAGE CONTRACT SIZE',
          value: piList.length > 0 
            ? (totalPiPipelineNum / piList.length >= 10000000 
                ? `₹ ${(totalPiPipelineNum / piList.length / 10000000).toFixed(2)} Cr` 
                : `₹ ${(totalPiPipelineNum / piList.length / 100000).toFixed(2)} L`)
            : '₹ 0.00',
          trend: 'Per Order',
          trendUp: true,
          icon: DollarSign,
          iconColor: '#0F172A',
          iconBg: '#F1F5F9',
          bottomPrefix: 'Basis ',
          bottomHighlight: `${piList.length} Active Proformas`
        }
      ]} />

      {/* Salesperson Leaderboard Comparison */}
      <div style={{
        backgroundColor: '#FFFFFF',
        borderRadius: '16px',
        border: '1px solid #EAEFEF',
        padding: '16px',
        display: 'flex',
        flexDirection: 'column',
        gap: '12px',
        boxShadow: '0 4px 18px rgba(15, 23, 42, 0.03)'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
          <span style={{ fontSize: '13px', fontWeight: '800', color: '#0F172A', textTransform: 'uppercase' }}>
            Sales Representatives Performance & Pipeline Contribution
          </span>
          <button
            onClick={() => {
              if (setEditingTargetRep) setEditingTargetRep('All');
              if (setEditingTargetAmount) setEditingTargetAmount(String(ceoTargetStore?.monthlyCompanyTarget || 18000000));
              if (setShowCeoTargetModal) setShowCeoTargetModal(true);
            }}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '5px 12px',
              borderRadius: '8px',
              backgroundColor: '#0E7490',
              color: '#FFFFFF',
              border: 'none',
              fontSize: '11.5px',
              fontWeight: '700',
              cursor: 'pointer',
              boxShadow: '0 2px 6px rgba(14, 116, 144, 0.2)'
            }}
            title="Configure monthly sales targets as CEO"
          >
            <Edit3 size={13} /> Set Monthly Targets
          </button>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '10px' }}>
          {teamDirectory.filter(t => t.department === 'Sales').map(salesRep => {
            const perf = personPerformanceData.find(p => p.code === salesRep.code);
            return (
              <div
                key={salesRep.code}
                onClick={() => setActivePersonModal && setActivePersonModal(perf)}
                style={{
                  padding: '12px',
                  borderRadius: '12px',
                  backgroundColor: '#F8FAFC',
                  border: '1px solid #E2E8F0',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '8px',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease'
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '12px', fontWeight: '800', color: '#0F172A' }}>{salesRep.name}</span>
                  <span style={{ fontSize: '10px', fontWeight: '700', color: perf?.ratingColor, backgroundColor: perf?.ratingBg, padding: '2px 6px', borderRadius: '6px' }}>
                    {perf?.targetPct}%
                  </span>
                </div>

                <div style={{ fontSize: '16px', fontWeight: '900', color: '#0E7490' }}>
                  ₹ {perf ? (perf.achievedVal / 10000000).toFixed(2) : '0.00'} Cr
                </div>

                <div style={{ width: '100%', height: '5px', backgroundColor: '#E2E8F0', borderRadius: '3px', overflow: 'hidden' }}>
                  <div style={{
                    width: `${Math.min(100, perf?.targetPct || 0)}%`,
                    height: '100%',
                    backgroundColor: '#0E7490'
                  }} />
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10.5px', color: '#64748B' }}>
                  <span>{perf?.recordCount || 0} Deals</span>
                  <span>Target: ₹ {(salesRep.monthlyTarget * periodMultiplier / 10000000).toFixed(2)} Cr</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Live Recent High-Value Proforma Invoices Table */}
      <div style={{
        backgroundColor: '#FFFFFF',
        borderRadius: '16px',
        border: '1px solid #EAEFEF',
        padding: '16px',
        display: 'flex',
        flexDirection: 'column',
        gap: '12px',
        boxShadow: '0 4px 18px rgba(15, 23, 42, 0.03)'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: '13px', fontWeight: '800', color: '#0F172A', textTransform: 'uppercase' }}>
            Recent Proforma Invoices Synced with Sales Pipeline
          </span>
          <span style={{ fontSize: '11px', color: '#64748B' }}>Showing active high-value deals</span>
        </div>

        <div style={{ border: '1px solid #F1F5F9', borderRadius: '10px', overflowX: 'auto', maxWidth: '100%', minWidth: 0 }}>
          <table style={{ width: '100%', minWidth: '650px', fontSize: '11.5px', borderCollapse: 'collapse', textAlign: 'left' }}>
            <thead>
              <tr style={{ backgroundColor: '#F8FAFC', borderBottom: '1px solid #E2E8F0', color: '#64748B', fontWeight: '700' }}>
                <th style={{ padding: '8px 10px' }}>PI Number</th>
                <th style={{ padding: '8px 10px' }}>Customer Name</th>
                <th style={{ padding: '8px 10px' }}>Sales Executive</th>
                <th style={{ padding: '8px 10px' }}>Amount</th>
                <th style={{ padding: '8px 10px' }}>Status</th>
              </tr>
            </thead>
            <tbody>
              {piList.length > 0 ? (
                piList.slice(0, 5).map((pi, idx) => (
                  <tr key={idx} style={{ borderBottom: '1px solid #F1F5F9' }}>
                    <td style={{ padding: '8px 10px', fontWeight: '800', color: '#0E7490' }}>
                      {pi.piNo || pi.id}
                    </td>
                    <td style={{ padding: '8px 10px', fontWeight: '700', color: '#0F172A' }}>
                      {pi.customerName || pi.customer || 'Solar EPC Client'}
                    </td>
                    <td style={{ padding: '8px 10px' }}>
                      <span style={{ padding: '2px 6px', borderRadius: '4px', backgroundColor: '#F1F5F9', fontWeight: '700', color: '#334155' }}>
                        {pi.salesPerson || 'Sales Executive'}
                      </span>
                    </td>
                    <td style={{ padding: '8px 10px', fontWeight: '800', color: '#0F172A' }}>
                      {typeof pi.grandTotal === 'number' ? `₹ ${pi.grandTotal.toLocaleString('en-IN')}` : (pi.grandTotal || pi.amount || '₹ 0.00')}
                    </td>
                    <td style={{ padding: '8px 10px' }}>
                      <span style={{
                        fontSize: '10px',
                        fontWeight: '800',
                        padding: '2px 7px',
                        borderRadius: '8px',
                        backgroundColor: String(pi.status).toLowerCase().includes('confirmed') || String(pi.status).toLowerCase().includes('advance') ? '#DCFCE7' : '#FEF3C7',
                        color: String(pi.status).toLowerCase().includes('confirmed') || String(pi.status).toLowerCase().includes('advance') ? '#16A34A' : '#D97706'
                      }}>
                        {pi.status || 'Active'}
                      </span>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={5} style={{ padding: '24px', textAlign: 'center', color: '#64748B' }}>
                    No Proforma Invoices generated yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
