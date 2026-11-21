import React, { useEffect, useState } from 'react';
import {
  TrendingUp, Award, DollarSign, Layers,
  Download, FileSpreadsheet, Printer
} from 'lucide-react';
import { slApi, formatINR } from './smartLeadsApi';
import { SkeletonRows } from './SlShared';

const RANGES = [
  { key: 'month', label: 'This Month' },
  { key: '30d', label: 'Last 30 Days' },
  { key: 'quarter', label: 'This Quarter' },
  { key: 'year', label: 'This Year' },
  { key: 'all', label: 'All Time' }
];

export default function ReportsView({ meta, onNavigate, toast }) {
  const [range, setRange] = useState('month');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const res = await slApi.reports({ range });
      setData(res.data);
    } catch (err) {
      if (toast) toast(err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [range]);

  const kpis = data?.kpis || {};
  const sources = data?.sources || [];
  const lostReasons = data?.lostReasons || [];
  const leaderboard = data?.leaderboard || [];

  const statCards = [
    { label: 'Total Leads', value: String(kpis.totalLeads || 0), sub: 'Ingested in period', icon: Layers, color: '#0E7490' },
    { label: 'Win Rate', value: `${kpis.conversionRate || 0}%`, sub: `${kpis.wonCount || 0} Won · ${kpis.lostCount || 0} Lost`, icon: TrendingUp, color: '#16A34A' },
    { label: 'Closed Revenue', value: formatINR(kpis.totalRevenue || 0), sub: 'From converted deals', icon: DollarSign, color: '#2563EB' },
    { label: 'Avg Deal Size', value: formatINR(kpis.avgDealSize || 0), sub: 'Per converted deal', icon: Award, color: '#7C3AED' }
  ];

  // Download Report as formatted Excel (.xlsx) spreadsheet
  const downloadExcel = async () => {
    if (!data) return;
    setDownloading(true);
    try {
      const XLSX = await import('xlsx');
      const wb = XLSX.utils.book_new();
      const currentRangeObj = RANGES.find(r => r.key === range);
      const rangeLabel = currentRangeObj ? currentRangeObj.label : range;
      const todayStr = new Date().toISOString().split('T')[0];

      // Sheet 1: Executive Summary & Performance KPIs
      const summaryAoa = [
        ['BUSINZ — Sales Intelligence & Lead Performance Report'],
        ['Time Period:', rangeLabel],
        ['Report Generated:', new Date().toLocaleString('en-IN')],
        ['Application:', 'BUSINZ Smart Leads'],
        [],
        ['Executive Metric', 'Value', 'Context'],
        ['Total Leads Ingested', kpis.totalLeads || 0, 'New opportunities created in timeframe'],
        ['Closed Won Deals', kpis.wonCount || 0, 'Successfully converted deals'],
        ['Closed Lost Deals', kpis.lostCount || 0, 'Lost deals recorded'],
        ['Win Rate', `${kpis.conversionRate || 0}%`, 'Won / (Won + Lost)'],
        ['Closed Revenue (INR)', kpis.totalRevenue || 0, 'Actual closed won order value'],
        ['Average Deal Size (INR)', kpis.avgDealSize || 0, 'Average revenue per won deal']
      ];
      const wsSummary = XLSX.utils.aoa_to_sheet(summaryAoa);
      XLSX.utils.book_append_sheet(wb, wsSummary, 'Summary');

      // Sheet 2: Sales Representative Leaderboard
      const leaderboardAoa = [
        ['Rank', 'Representative Name', 'Assigned Deals', 'Won Deals', 'Win Rate (%)', 'Active In-Flight Deals', 'Closed Revenue (INR)']
      ];
      leaderboard.forEach((rep, idx) => {
        leaderboardAoa.push([
          idx + 1,
          rep.repName || 'Unassigned',
          rep.totalAssigned || 0,
          rep.wonCount || 0,
          rep.winRate || 0,
          rep.activeCount || 0,
          rep.revenue || 0
        ]);
      });
      const wsLeaderboard = XLSX.utils.aoa_to_sheet(leaderboardAoa);
      XLSX.utils.book_append_sheet(wb, wsLeaderboard, 'Sales Leaderboard');

      // Sheet 3: Lead Acquisition Channels
      const sourcesAoa = [
        ['Channel / Source', 'Total Ingested', 'Won Deals', 'Lost Deals', 'Active In-Flight', 'Win Rate (%)', 'Revenue (INR)']
      ];
      sources.forEach(s => {
        sourcesAoa.push([
          s.source || 'Direct',
          s.total || 0,
          s.won || 0,
          s.lost || 0,
          s.active || 0,
          s.conversionRate || 0,
          s.revenue || 0
        ]);
      });
      const wsSources = XLSX.utils.aoa_to_sheet(sourcesAoa);
      XLSX.utils.book_append_sheet(wb, wsSources, 'Acquisition Channels');

      // Sheet 4: Lost Deal Reasons
      if (lostReasons.length > 0) {
        const lostAoa = [
          ['Root Cause / Lost Reason', 'Lost Count']
        ];
        lostReasons.forEach(r => {
          lostAoa.push([r.reason || 'Unspecified', r.count || 0]);
        });
        const wsLost = XLSX.utils.aoa_to_sheet(lostAoa);
        XLSX.utils.book_append_sheet(wb, wsLost, 'Lost Reasons');
      }

      const fileName = `BUSINZ_SmartLeads_Report_${range}_${todayStr}.xlsx`;
      XLSX.writeFile(wb, fileName);
      if (toast) toast('Report downloaded successfully as Excel (.xlsx)', 'success');
    } catch (err) {
      console.error('Failed to download Excel report:', err);
      if (toast) toast('Failed to download Excel report: ' + err.message, 'error');
    } finally {
      setDownloading(false);
    }
  };

  // Download Report as CSV
  const downloadCSV = () => {
    if (!data) return;
    try {
      const currentRangeObj = RANGES.find(r => r.key === range);
      const rangeLabel = currentRangeObj ? currentRangeObj.label : range;
      const todayStr = new Date().toISOString().split('T')[0];

      const escape = (val) => {
        const s = String(val ?? '').replace(/"/g, '""');
        return `"${s}"`;
      };

      const rows = [
        ['BUSINZ — Sales Intelligence & Lead Performance Report'],
        ['Time Period', rangeLabel],
        ['Report Generated', new Date().toLocaleString('en-IN')],
        [],
        ['--- EXECUTIVE SUMMARY ---'],
        ['Metric', 'Value', 'Details'],
        ['Total Leads Ingested', kpis.totalLeads || 0, 'New opportunities created in period'],
        ['Closed Won Deals', kpis.wonCount || 0, 'Successfully converted deals'],
        ['Closed Lost Deals', kpis.lostCount || 0, 'Lost deals recorded'],
        ['Win Rate', `${kpis.conversionRate || 0}%`, 'Won / (Won + Lost)'],
        ['Closed Revenue (INR)', kpis.totalRevenue || 0, 'Actual closed revenue'],
        ['Average Deal Size (INR)', kpis.avgDealSize || 0, 'Average revenue per won deal'],
        [],
        ['--- SALES LEADERBOARD ---'],
        ['Rank', 'Representative Name', 'Assigned Deals', 'Won Deals', 'Win Rate (%)', 'Active Deals', 'Closed Revenue (INR)'],
        ...leaderboard.map((rep, idx) => [
          idx + 1,
          rep.repName || 'Unassigned',
          rep.totalAssigned || 0,
          rep.wonCount || 0,
          `${rep.winRate || 0}%`,
          rep.activeCount || 0,
          rep.revenue || 0
        ]),
        [],
        ['--- ACQUISITION CHANNELS ---'],
        ['Channel', 'Total Ingested', 'Won Deals', 'Lost Deals', 'Active In-Flight', 'Win Rate (%)', 'Revenue (INR)'],
        ...sources.map(s => [
          s.source || 'Direct',
          s.total || 0,
          s.won || 0,
          s.lost || 0,
          s.active || 0,
          `${s.conversionRate || 0}%`,
          s.revenue || 0
        ]),
        [],
        ['--- LOST DEAL ROOT CAUSES ---'],
        ['Reason', 'Lost Count'],
        ...lostReasons.map(r => [r.reason || 'Unspecified', r.count || 0])
      ];

      const csvContent = '\uFEFF' + rows.map(r => r.map(escape).join(',')).join('\r\n');
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `BUSINZ_SmartLeads_Report_${range}_${todayStr}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      if (toast) toast('Report downloaded successfully as CSV', 'success');
    } catch (err) {
      console.error('Failed to download CSV report:', err);
      if (toast) toast('Failed to download CSV: ' + err.message, 'error');
    }
  };

  const handlePrint = () => {
    window.print();
  };

  if (loading && !data) {
    return (
      <div style={{ padding: '24px', background: '#FFFFFF', borderRadius: '12px', border: '1px solid #E2E8F0' }}>
        <SkeletonRows rows={6} />
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      {/* 1. Header Toolbar: Range Filter & Download Actions */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '12px',
        background: '#fafbfc',
        border: '1px solid #E2E8F0',
        borderRadius: '12px',
        padding: '12px 18px',
        flexWrap: 'wrap'
      }}>
        {/* Left: Time Range Pills */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
          <span style={{ fontSize: '13px', fontWeight: 700, color: '#334155' }}>Time Period:</span>
          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
            {RANGES.map(r => (
              <button
                key={r.key}
                onClick={() => setRange(r.key)}
                className={`sl-chip ${range === r.key ? 'active' : ''}`}
                style={{
                  cursor: 'pointer',
                  padding: '6px 12px',
                  borderRadius: '20px',
                  fontSize: '12px',
                  fontWeight: range === r.key ? '700' : '500',
                  border: range === r.key ? '1px solid #0E7490' : '1px solid #E2E8F0',
                  backgroundColor: range === r.key ? '#ECFEFF' : '#FFFFFF',
                  color: range === r.key ? '#0E7490' : '#475569',
                  transition: 'all 0.15s ease'
                }}
              >
                {r.label}
              </button>
            ))}
          </div>
        </div>

        {/* Right: Download Actions */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', marginLeft: 'auto' }}>
          <button
            type="button"
            onClick={downloadExcel}
            disabled={downloading || !data}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '8px 14px',
              borderRadius: '8px',
              border: 'none',
              backgroundColor: '#0E7490',
              color: '#FFFFFF',
              fontSize: '12.5px',
              fontWeight: '700',
              cursor: downloading || !data ? 'not-allowed' : 'pointer',
              opacity: downloading ? 0.7 : 1,
              boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
              transition: 'all 0.15s ease'
            }}
            title="Download complete multi-sheet report in Excel (.xlsx)"
          >
            <Download size={14} /> {downloading ? 'Preparing...' : 'Download Excel'}
          </button>

          <button
            type="button"
            onClick={downloadCSV}
            disabled={downloading || !data}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '8px 14px',
              borderRadius: '8px',
              border: '1px solid #CBD5E1',
              backgroundColor: '#FFFFFF',
              color: '#334155',
              fontSize: '12.5px',
              fontWeight: '600',
              cursor: downloading || !data ? 'not-allowed' : 'pointer',
              transition: 'all 0.15s ease'
            }}
            title="Download report data as CSV file"
          >
            <FileSpreadsheet size={14} color="#0E7490" /> Download CSV
          </button>

          <button
            type="button"
            onClick={handlePrint}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '8px 12px',
              borderRadius: '8px',
              border: '1px solid #CBD5E1',
              backgroundColor: '#FFFFFF',
              color: '#475569',
              fontSize: '12.5px',
              fontWeight: '600',
              cursor: 'pointer'
            }}
            title="Print or Save as PDF"
          >
            <Printer size={14} /> Print / PDF
          </button>
        </div>
      </div>

      {/* 2. KPI Summary Row */}
      <div style={{
        display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px'
      }}>
        {statCards.map(c => (
          <div
            key={c.label}
            style={{
              background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: '12px',
              padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: '4px',
              boxShadow: '0 1px 3px rgba(0,0,0,0.02)'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: '11px', fontWeight: 700, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.03em' }}>{c.label}</span>
              <c.icon size={16} style={{ color: c.color }} />
            </div>
            <span style={{ fontSize: '22px', fontWeight: 800, color: '#0F172A', lineHeight: 1.2 }}>{c.value}</span>
            <span style={{ fontSize: '11px', color: '#64748B' }}>{c.sub}</span>
          </div>
        ))}
      </div>

      {/* 3. Two-Column Breakdown Panels */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(380px, 1fr))', gap: '16px' }}>
        {/* Acquisition Channels */}
        <div className="sl-card" style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <h3 style={{ fontSize: '14px', fontWeight: 700, color: '#0F172A', margin: 0 }}>Acquisition Channels</h3>
              <p style={{ fontSize: '11px', color: '#64748B', margin: '2px 0 0 0' }}>Conversion rate & revenue by lead source</p>
            </div>
            <span style={{ fontSize: '11px', color: '#0E7490', fontWeight: '700' }}>{sources.length} Channels</span>
          </div>

          {sources.length === 0 ? (
            <div style={{ padding: '30px', textAlign: 'center', color: '#94A3B8', fontSize: '13px' }}>
              No lead source activity in this timeframe
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {sources.map(s => (
                <div key={s.source} style={{ padding: '10px 12px', borderRadius: '8px', background: '#F8FAFC', border: '1px solid #F1F5F9' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                    <span style={{ fontWeight: 700, fontSize: '13px', color: '#1E293B' }}>{s.source}</span>
                    <span style={{ fontSize: '12px', fontWeight: 700, color: '#0E7490' }}>
                      {s.total} leads · {s.conversionRate}% Win
                    </span>
                  </div>
                  <div style={{ width: '100%', height: '5px', background: '#E2E8F0', borderRadius: '4px', overflow: 'hidden' }}>
                    <div style={{ width: `${Math.min(s.conversionRate, 100)}%`, height: '100%', background: '#0E7490', borderRadius: '4px' }} />
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '6px', fontSize: '11px', color: '#64748B' }}>
                    <span>{s.won} Won · {s.lost} Lost · {s.active} In Flight</span>
                    <span style={{ fontWeight: 700, color: '#059669' }}>{formatINR(s.revenue)}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Deal Slip & Lost Reasons */}
        <div className="sl-card" style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <h3 style={{ fontSize: '14px', fontWeight: 700, color: '#0F172A', margin: 0 }}>Deal Slip & Lost Reasons</h3>
              <p style={{ fontSize: '11px', color: '#64748B', margin: '2px 0 0 0' }}>Root cause breakdown for missed conversions</p>
            </div>
            <span style={{ fontSize: '11px', color: '#DC2626', fontWeight: '700' }}>{lostReasons.reduce((sum, r) => sum + r.count, 0)} Lost Deals</span>
          </div>

          {lostReasons.length === 0 ? (
            <div style={{ padding: '30px', textAlign: 'center', color: '#94A3B8', fontSize: '13px' }}>
              No lost deals recorded in this timeframe
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {lostReasons.map(r => {
                const max = lostReasons[0]?.count || 1;
                const pct = Math.round((r.count / max) * 100);
                return (
                  <div key={r.reason} style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px' }}>
                      <span style={{ fontWeight: 600, color: '#334155' }}>{r.reason}</span>
                      <span style={{ fontWeight: 700, color: '#DC2626' }}>{r.count} deals</span>
                    </div>
                    <div style={{ width: '100%', height: '5px', background: '#F1F5F9', borderRadius: '4px', overflow: 'hidden' }}>
                      <div style={{ width: `${pct}%`, height: '100%', background: '#EF4444', borderRadius: '4px' }} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* 4. Sales Leaderboard Table */}
      <div className="sl-card sl-table-wrap">
        <div style={{ padding: '16px 20px', borderBottom: '1px solid #E2E8F0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h3 style={{ fontSize: '14px', fontWeight: 700, color: '#0F172A', margin: 0 }}>Sales Representative Leaderboard</h3>
            <p style={{ fontSize: '11px', color: '#64748B', margin: '2px 0 0 0' }}>Performance ranked by closed won revenue and deal conversion velocity</p>
          </div>
          <span style={{ fontSize: '11px', color: '#64748B' }}>{leaderboard.length} Representatives Ranked</span>
        </div>

        {leaderboard.length === 0 ? (
          <div style={{ padding: '30px', textAlign: 'center', color: '#94A3B8', fontSize: '13px' }}>
            No sales activity found in this timeframe
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className="sl-table" style={{ width: '100%', minWidth: '700px', borderCollapse: 'collapse', fontSize: '13px', textAlign: 'left' }}>
              <thead>
                <tr style={{ color: '#475569', borderBottom: '1px solid #E2E8F0', backgroundColor: '#F8FAFC', fontSize: '12px', fontWeight: 'bold', height: '48px' }}>
                  <th style={{ padding: '12px 14px', fontWeight: 'bold', whiteSpace: 'nowrap' }}>Rank & Representative</th>
                  <th style={{ padding: '12px 14px', fontWeight: 'bold', whiteSpace: 'nowrap' }}>Assigned Deals</th>
                  <th style={{ padding: '12px 14px', fontWeight: 'bold', whiteSpace: 'nowrap' }}>Won Deals</th>
                  <th style={{ padding: '12px 14px', fontWeight: 'bold', whiteSpace: 'nowrap' }}>Win Rate</th>
                  <th style={{ padding: '12px 14px', fontWeight: 'bold', whiteSpace: 'nowrap' }}>Active Deals</th>
                  <th style={{ padding: '12px 16px', fontWeight: 'bold', whiteSpace: 'nowrap', textAlign: 'right' }}>Closed Revenue</th>
                </tr>
              </thead>
              <tbody>
                {leaderboard.map((rep, idx) => (
                  <tr key={rep.repName} style={{ borderBottom: '1px solid #F1F5F9' }}>
                    <td style={{ padding: '12px 14px', fontWeight: 600, color: '#0F172A' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{
                          width: '24px', height: '24px', borderRadius: '50%',
                          background: idx === 0 ? '#FEF08A' : idx === 1 ? '#E2E8F0' : idx === 2 ? '#FED7AA' : '#F1F5F9',
                          color: idx === 0 ? '#854D0E' : '#334155', display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                          fontSize: '11px', fontWeight: 800, flexShrink: 0
                        }}>
                          {idx + 1}
                        </span>
                        <span>{rep.repName}</span>
                      </div>
                    </td>
                    <td style={{ padding: '12px 14px', color: '#334155' }}>{rep.totalAssigned}</td>
                    <td style={{ padding: '12px 14px', fontWeight: 700, color: '#059669' }}>{rep.wonCount}</td>
                    <td style={{ padding: '12px 14px' }}>
                      <span style={{
                        padding: '2px 8px', borderRadius: '999px', fontSize: '11px', fontWeight: 700,
                        background: rep.winRate >= 50 ? '#DCFCE7' : '#F1F5F9',
                        color: rep.winRate >= 50 ? '#059669' : '#64748B'
                      }}>
                        {rep.winRate}%
                      </span>
                    </td>
                    <td style={{ padding: '12px 14px', color: '#0E7490', fontWeight: 600 }}>{rep.activeCount}</td>
                    <td style={{ padding: '12px 16px', fontWeight: 800, color: '#0F172A', textAlign: 'right' }}>
                      {formatINR(rep.revenue)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
