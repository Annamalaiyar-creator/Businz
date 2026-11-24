import React from 'react';
import { ArrowRight } from 'lucide-react';
import { parseAmt } from './ceoDashboardUtils';
import { extractGstRate } from '../../utils/gstHelper';

export default function CeoBillingTab({
  selectedPeriod,
  totalRevenueCr,
  invList = [],
  onNavigateTab,
  teamDirectory = [],
  personPerformanceData = [],
  setActivePersonModal,
  periodMultiplier = 1
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
      {/* Billing Top Ribbon */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '10px' }}>
        <div style={{ backgroundColor: '#FFFFFF', borderRadius: '14px', border: '1px solid #EAEFEF', padding: '14px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
          <span style={{ fontSize: '11px', fontWeight: '800', color: '#64748B', textTransform: 'uppercase' }}>Total Invoiced ({selectedPeriod})</span>
          <div style={{ fontSize: '20px', fontWeight: '900', color: '#9333EA' }}>₹ {totalRevenueCr} Cr</div>
          <div style={{ fontSize: '11px', color: '#64748B' }}>{invList.length} Tax Invoices</div>
        </div>

        <div style={{ backgroundColor: '#FFFFFF', borderRadius: '14px', border: '1px solid #EAEFEF', padding: '14px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
          <span style={{ fontSize: '11px', fontWeight: '800', color: '#64748B', textTransform: 'uppercase' }}>Active E-Way Bills</span>
          <div style={{ fontSize: '20px', fontWeight: '900', color: '#2563EB' }}>
            {invList.filter(i => i.ewayBillNo || i.eway_bill || i.ewayBill).length} Generated
          </div>
          <div style={{ fontSize: '11px', color: '#16A34A', fontWeight: '700' }}>Live GST E-Way reconciled</div>
        </div>

        <div style={{ backgroundColor: '#FFFFFF', borderRadius: '14px', border: '1px solid #EAEFEF', padding: '14px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
          <span style={{ fontSize: '11px', fontWeight: '800', color: '#64748B', textTransform: 'uppercase' }}>Dispatch Clearance Speed</span>
          <div style={{ fontSize: '20px', fontWeight: '900', color: '#16A34A' }}>
            {invList.length > 0 ? 'Synchronized' : 'Standby'}
          </div>
          <div style={{ fontSize: '11px', color: '#16A34A', fontWeight: '700' }}>Direct PI to Tax Invoice Flow</div>
        </div>

        <div style={{ backgroundColor: '#FFFFFF', borderRadius: '14px', border: '1px solid #EAEFEF', padding: '14px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
          <span style={{ fontSize: '11px', fontWeight: '800', color: '#64748B', textTransform: 'uppercase' }}>Pending Tax Verification</span>
          <div style={{ fontSize: '20px', fontWeight: '900', color: '#0E7490' }}>
            {invList.filter(i => !i.status || i.status === 'Draft').length} Draft Invoices
          </div>
          <div style={{ fontSize: '11px', color: '#0E7490', fontWeight: '700' }}>Ledger reconciled</div>
        </div>
      </div>

      {/* Billing Lead Card */}
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
            Billing & E-Way Clearances Officer
          </span>
          <button
            onClick={() => onNavigateTab && onNavigateTab('Invoice Management')}
            style={{
              border: 'none',
              backgroundColor: '#9333EA',
              color: '#FFFFFF',
              padding: '5px 12px',
              borderRadius: '6px',
              fontSize: '11px',
              fontWeight: '700',
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px'
            }}
          >
            Go to Invoice Management <ArrowRight size={12} />
          </button>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '12px' }}>
          {teamDirectory.filter(t => t.department === 'Billing').map(bill => {
            const perf = personPerformanceData.find(p => p.code === bill.code);
            return (
              <div
                key={bill.code}
                onClick={() => setActivePersonModal && setActivePersonModal(perf)}
                style={{
                  padding: '14px',
                  borderRadius: '12px',
                  backgroundColor: '#F8FAFC',
                  border: '1px solid #E2E8F0',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '8px',
                  cursor: 'pointer'
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <div style={{ fontSize: '12.5px', fontWeight: '800', color: '#0F172A' }}>{bill.name}</div>
                    <div style={{ fontSize: '10.5px', color: '#64748B' }}>{bill.designation}</div>
                  </div>
                  <span style={{ fontSize: '10px', fontWeight: '700', color: perf?.ratingColor, backgroundColor: perf?.ratingBg, padding: '2px 7px', borderRadius: '6px' }}>
                    {perf?.targetPct}% Target
                  </span>
                </div>

                <div style={{ fontSize: '18px', fontWeight: '900', color: '#9333EA', marginTop: '4px' }}>
                  ₹ {perf ? (perf.achievedVal / 10000000).toFixed(2) : '0.00'} Cr Invoiced
                </div>

                <div style={{ width: '100%', height: '5px', backgroundColor: '#E2E8F0', borderRadius: '3px', overflow: 'hidden' }}>
                  <div style={{
                    width: `${Math.min(100, perf?.targetPct || 0)}%`,
                    height: '100%',
                    backgroundColor: '#9333EA'
                  }} />
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10.5px', color: '#64748B' }}>
                  <span>{perf?.recordCount || 0} Invoices Issued</span>
                  <span>Target: ₹ {(bill.monthlyTarget * periodMultiplier / 10000000).toFixed(2)} Cr</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Live Invoices Summary */}
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
        <span style={{ fontSize: '13px', fontWeight: '800', color: '#0F172A', textTransform: 'uppercase' }}>
          Recent Tax Invoices & E-Way Clearances
        </span>

        <div style={{ border: '1px solid #E2E8F0', borderRadius: '10px', overflow: 'hidden' }}>
          <table style={{ width: '100%', fontSize: '11px', borderCollapse: 'collapse', textAlign: 'left' }}>
            <thead>
              <tr style={{ backgroundColor: '#F8FAFC', borderBottom: '1px solid #E2E8F0', color: '#64748B' }}>
                <th style={{ padding: '8px 10px' }}>Invoice No</th>
                <th style={{ padding: '8px 10px' }}>Customer Name</th>
                <th style={{ padding: '8px 10px' }}>Taxable Value</th>
                <th style={{ padding: '8px 10px' }}>GST 18%</th>
                <th style={{ padding: '8px 10px' }}>Total Invoiced</th>
                <th style={{ padding: '8px 10px' }}>Status</th>
              </tr>
            </thead>
            <tbody>
              {invList.length > 0 ? (
                invList.slice(0, 6).map((row, idx) => {
                  const tot = parseAmt(row.total || row.grandTotal || row.amount || 0);
                  const rowRate = extractGstRate(row.gstRate, 18);
                  const tax = parseAmt(row.taxableAmount || row.subTotal || row.subtotal || (tot > 0 ? tot / (1 + rowRate / 100) : 0));
                  const gst = parseAmt(row.gstAmount || row.taxAmount || (tot > 0 ? tot - tax : 0));
                  return (
                    <tr key={idx} style={{ borderBottom: '1px solid #F1F5F9' }}>
                      <td style={{ padding: '8px 10px', fontWeight: '800', color: '#9333EA' }}>
                        {row.invNo || row.invoiceNo || row.id || `INV-${idx + 1}`}
                      </td>
                      <td style={{ padding: '8px 10px', fontWeight: '700' }}>
                        {row.customerName || row.customer || '-'}
                      </td>
                      <td style={{ padding: '8px 10px', color: '#64748B' }}>₹ {tax.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</td>
                      <td style={{ padding: '8px 10px', color: '#64748B' }}>₹ {gst.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</td>
                      <td style={{ padding: '8px 10px', fontWeight: '800', color: '#0F172A' }}>₹ {tot.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</td>
                      <td style={{ padding: '8px 10px' }}>
                        <span style={{ fontSize: '9.5px', fontWeight: '800', padding: '2px 6px', borderRadius: '6px', backgroundColor: '#F3E8FF', color: '#9333EA' }}>
                          {row.status || 'Generated'}
                        </span>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={6} style={{ padding: '24px', textAlign: 'center', color: '#64748B' }}>
                    No tax invoices generated yet.
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
