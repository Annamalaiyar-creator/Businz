import React from 'react';
import { ArrowRight, Clock, Truck } from 'lucide-react';
import { CeoKpiGrid } from '../views/CeoExecutiveDashboardView';

export default function CeoDispatchTab({
  todayDispatchesCount = 0,
  pendingDispatchQueueCount = 0,
  onNavigateTab,
  teamDirectory = [],
  personPerformanceData = [],
  setActivePersonModal,
  periodMultiplier = 1,
  challansList = [],
  dispatchesList = []
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
      {/* Dispatch Top Ribbon (BUSINZ DESIGN SYSTEM) */}
      <CeoKpiGrid kpis={[
        {
          title: 'TOTAL DISPATCH TODAY',
          value: `${todayDispatchesCount} Dispatches`,
          trend: todayDispatchesCount > 0 ? `${todayDispatchesCount} Dispatched` : '0 Today',
          trendUp: todayDispatchesCount > 0,
          icon: Truck,
          iconColor: '#059669',
          iconBg: '#ECFDF5',
          bottomPrefix: 'Today activity ',
          bottomHighlight: `${todayDispatchesCount} Dispatches Cleared`,
          onClick: () => onNavigateTab && onNavigateTab('Delivery Challans')
        },
        {
          title: 'PENDING DISPATCH',
          value: `${pendingDispatchQueueCount} Pending`,
          trend: pendingDispatchQueueCount > 0 ? `${pendingDispatchQueueCount} In Queue` : '0 Pending',
          trendUp: pendingDispatchQueueCount === 0,
          highlightCard: pendingDispatchQueueCount > 0,
          icon: Clock,
          iconColor: pendingDispatchQueueCount > 0 ? '#D97706' : '#16A34A',
          iconBg: pendingDispatchQueueCount > 0 ? '#FFFBEB' : '#F0FDF4',
          bottomPrefix: 'Dispatch stage ',
          bottomHighlight: 'Packing & Loading Queue',
          onClick: () => onNavigateTab && onNavigateTab('BOM Orders')
        }
      ]} />

      {/* Dispatch Leadership Accountability */}
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
            Logistics & Dispatch Operations Lead
          </span>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              onClick={() => onNavigateTab && onNavigateTab('Dispatch Orders')}
              style={{
                border: 'none',
                backgroundColor: '#059669',
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
              Go to Dispatch Orders <ArrowRight size={12} />
            </button>
            <button
              onClick={() => onNavigateTab && onNavigateTab('Delivery Challans')}
              style={{
                border: '1px solid #CBD5E1',
                backgroundColor: '#FFFFFF',
                color: '#475569',
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
              Delivery Challans <ArrowRight size={12} />
            </button>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '12px' }}>
          {teamDirectory.filter(t => t.department === 'Dispatch').map(disp => {
            const perf = personPerformanceData.find(p => p.code === disp.code);
            return (
              <div
                key={disp.code}
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
                    <div style={{ fontSize: '12.5px', fontWeight: '800', color: '#0F172A' }}>{disp.name}</div>
                    <div style={{ fontSize: '10.5px', color: '#64748B' }}>{disp.designation}</div>
                  </div>
                  <span style={{ fontSize: '10px', fontWeight: '700', color: perf?.ratingColor, backgroundColor: perf?.ratingBg, padding: '2px 7px', borderRadius: '6px' }}>
                    {perf?.targetPct}% Target
                  </span>
                </div>

                <div style={{ fontSize: '18px', fontWeight: '900', color: '#059669', marginTop: '4px' }}>
                  {Math.round(perf?.achievedVal || 0)} Consignments Cleared
                </div>

                <div style={{ width: '100%', height: '5px', backgroundColor: '#E2E8F0', borderRadius: '3px', overflow: 'hidden' }}>
                  <div style={{
                    width: `${Math.min(100, perf?.targetPct || 0)}%`,
                    height: '100%',
                    backgroundColor: '#059669'
                  }} />
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10.5px', color: '#64748B' }}>
                  <span>{perf?.recordCount || 0} Dispatches Tracked</span>
                  <span>Target: {Math.round(disp.monthlyTarget * periodMultiplier)} Shipments</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Recent Delivery Challans & Vehicles */}
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
          Recent Delivery Challan & Dispatch Clearances
        </span>

        <div style={{ border: '1px solid #E2E8F0', borderRadius: '10px', overflow: 'hidden' }}>
          <table style={{ width: '100%', fontSize: '11px', borderCollapse: 'collapse', textAlign: 'left' }}>
            <thead>
              <tr style={{ backgroundColor: '#F8FAFC', borderBottom: '1px solid #E2E8F0', color: '#64748B' }}>
                <th style={{ padding: '8px 10px' }}>Challan No</th>
                <th style={{ padding: '8px 10px' }}>Customer Destination</th>
                <th style={{ padding: '8px 10px' }}>Vehicle Number</th>
                <th style={{ padding: '8px 10px' }}>Transporter</th>
                <th style={{ padding: '8px 10px' }}>Tonnage</th>
                <th style={{ padding: '8px 10px' }}>Status</th>
              </tr>
            </thead>
            <tbody>
              {(challansList.length > 0 || dispatchesList.length > 0) ? (
                (challansList.length > 0 ? challansList : dispatchesList).slice(0, 6).map((row, idx) => (
                  <tr key={idx} style={{ borderBottom: '1px solid #F1F5F9' }}>
                    <td style={{ padding: '8px 10px', fontWeight: '800', color: '#059669' }}>
                      {row.challanNo || row.dcNo || row.id || `DC-${idx + 1}`}
                    </td>
                    <td style={{ padding: '8px 10px', fontWeight: '700' }}>
                      {row.customerName || row.customer || '-'}
                    </td>
                    <td style={{ padding: '8px 10px', color: '#0F172A', fontWeight: '800' }}>
                      {row.vehicleNo || row.vehicle || '-'}
                    </td>
                    <td style={{ padding: '8px 10px', color: '#64748B' }}>
                      {row.transporter || row.transporterName || '-'}
                    </td>
                    <td style={{ padding: '8px 10px', fontWeight: '800' }}>
                      {row.weight ? `${row.weight} MT` : (row.tonnage ? `${row.tonnage} MT` : '-')}
                    </td>
                    <td style={{ padding: '8px 10px' }}>
                      <span style={{ fontSize: '9.5px', fontWeight: '800', padding: '2px 6px', borderRadius: '6px', backgroundColor: '#DCFCE7', color: '#059669' }}>
                        {row.status || 'Dispatched'}
                      </span>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={6} style={{ padding: '24px', textAlign: 'center', color: '#64748B' }}>
                    No delivery challans or dispatch clearances issued yet.
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
