import React, { useEffect, useState } from 'react';
import {
  BarChart3, TrendingUp, PieChart, Award, DollarSign,
  Calendar, CheckCircle2, XCircle, RefreshCw, Layers
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

  if (loading && !data) {
    return (
      <div style={{ padding: '24px', background: '#FFFFFF', borderRadius: '14px', border: '1px solid #E2E8F0' }}>
        <SkeletonRows rows={6} />
      </div>
    );
  }

  const kpis = data?.kpis || {};
  const sources = data?.sources || [];
  const lostReasons = data?.lostReasons || [];
  const stages = data?.stages || [];
  const leaderboard = data?.leaderboard || [];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '22px' }}>
      {/* Top Banner & Filter Controls */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h2 style={{ fontSize: '18px', fontWeight: '800', color: '#0F172A', margin: 0 }}>
            Sales Intelligence & Performance Reports
          </h2>
          <p style={{ fontSize: '13px', color: '#64748B', margin: '4px 0 0 0' }}>
            Multi-dimensional conversion analytics, channel performance, and team rankings.
          </p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div style={{
            display: 'inline-flex', background: '#F1F5F9', padding: '3px',
            borderRadius: '8px', border: '1px solid #E2E8F0'
          }}>
            {RANGES.map(r => (
              <button
                key={r.key}
                onClick={() => setRange(r.key)}
                style={{
                  padding: '5px 12px', borderRadius: '6px', border: 'none',
                  fontSize: '12px', fontWeight: range === r.key ? '700' : '500',
                  background: range === r.key ? '#FFFFFF' : 'transparent',
                  color: range === r.key ? '#0E7490' : '#64748B',
                  cursor: 'pointer', boxShadow: range === r.key ? '0 1px 2px rgba(0,0,0,0.05)' : 'none'
                }}
              >
                {r.label}
              </button>
            ))}
          </div>
          <button
            onClick={load}
            title="Refresh Report"
            style={{
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              width: '34px', height: '34px', borderRadius: '8px', border: '1px solid #CBD5E1',
              background: '#FFFFFF', color: '#475569', cursor: 'pointer'
            }}
          >
            <RefreshCw size={14} />
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: '14px' }}>
        <div style={{ background: '#FFFFFF', padding: '18px', borderRadius: '12px', border: '1px solid #E2E8F0', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '13px', fontWeight: '600', color: '#64748B' }}>Total Leads Ingested</span>
            <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: '#F0FDFA', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Layers size={16} color="#0E7490" />
            </div>
          </div>
          <div style={{ fontSize: '24px', fontWeight: '800', color: '#0E7490', marginTop: '10px' }}>
            {kpis.totalLeads || 0}
          </div>
          <div style={{ fontSize: '12px', color: '#64748B', marginTop: '4px' }}>
            In selected timeframe
          </div>
        </div>

        <div style={{ background: '#FFFFFF', padding: '18px', borderRadius: '12px', border: '1px solid #E2E8F0', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '13px', fontWeight: '600', color: '#64748B' }}>Conversion Win Rate</span>
            <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: '#F0FDF4', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <TrendingUp size={16} color="#16A34A" />
            </div>
          </div>
          <div style={{ fontSize: '24px', fontWeight: '800', color: '#16A34A', marginTop: '10px' }}>
            {kpis.conversionRate || 0}%
          </div>
          <div style={{ fontSize: '12px', color: '#64748B', marginTop: '4px' }}>
            {kpis.wonCount || 0} Won vs {kpis.lostCount || 0} Lost
          </div>
        </div>

        <div style={{ background: '#FFFFFF', padding: '18px', borderRadius: '12px', border: '1px solid #E2E8F0', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '13px', fontWeight: '600', color: '#64748B' }}>Closed Revenue</span>
            <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: '#EFF6FF', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <DollarSign size={16} color="#2563EB" />
            </div>
          </div>
          <div style={{ fontSize: '24px', fontWeight: '800', color: '#1E293B', marginTop: '10px' }}>
            {formatINR(kpis.totalRevenue || 0)}
          </div>
          <div style={{ fontSize: '12px', color: '#64748B', marginTop: '4px' }}>
            From converted deals
          </div>
        </div>

        <div style={{ background: '#FFFFFF', padding: '18px', borderRadius: '12px', border: '1px solid #E2E8F0', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '13px', fontWeight: '600', color: '#64748B' }}>Average Deal Size</span>
            <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: '#FAF5FF', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Award size={16} color="#9333EA" />
            </div>
          </div>
          <div style={{ fontSize: '24px', fontWeight: '800', color: '#9333EA', marginTop: '10px' }}>
            {formatINR(kpis.avgDealSize || 0)}
          </div>
          <div style={{ fontSize: '12px', color: '#64748B', marginTop: '4px' }}>
            Per successful order
          </div>
        </div>
      </div>

      {/* Main Analytics Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(440px, 1fr))', gap: '18px' }}>
        {/* Panel 1: Lead Sources & Channel Performance */}
        <div style={{ background: '#FFFFFF', borderRadius: '14px', border: '1px solid #E2E8F0', padding: '20px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3 style={{ fontSize: '15px', fontWeight: '700', color: '#0F172A', margin: 0 }}>
              Acquisition Channels Performance
            </h3>
            <span style={{ fontSize: '12px', color: '#64748B' }}>Lead sources</span>
          </div>

          {sources.length === 0 ? (
            <div style={{ padding: '30px', textAlign: 'center', color: '#94A3B8', fontSize: '13px' }}>
              No lead source activity in this timeframe
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {sources.map(s => (
                <div key={s.source} style={{ padding: '10px 12px', borderRadius: '8px', background: '#F8FAFC', border: '1px solid #F1F5F9' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                    <span style={{ fontWeight: '700', fontSize: '13px', color: '#1E293B' }}>{s.source}</span>
                    <span style={{ fontSize: '12px', fontWeight: '700', color: '#0E7490' }}>
                      {s.total} leads · {s.conversionRate}% Win
                    </span>
                  </div>
                  <div style={{ width: '100%', height: '6px', background: '#E2E8F0', borderRadius: '4px', overflow: 'hidden' }}>
                    <div style={{ width: `${Math.min(s.conversionRate, 100)}%`, height: '100%', background: '#0E7490', borderRadius: '4px' }} />
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '6px', fontSize: '11px', color: '#64748B' }}>
                    <span>{s.won} Won · {s.lost} Lost · {s.active} In Flight</span>
                    <span style={{ fontWeight: '600', color: '#16A34A' }}>{formatINR(s.revenue)}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Panel 2: Lost Reasons Breakdown */}
        <div style={{ background: '#FFFFFF', borderRadius: '14px', border: '1px solid #E2E8F0', padding: '20px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3 style={{ fontSize: '15px', fontWeight: '700', color: '#0F172A', margin: 0 }}>
              Deal Slip & Lost Reasons
            </h3>
            <span style={{ fontSize: '12px', color: '#64748B' }}>Root causes</span>
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
                      <span style={{ fontWeight: '600', color: '#334155' }}>{r.reason}</span>
                      <span style={{ fontWeight: '700', color: '#DC2626' }}>{r.count} leads</span>
                    </div>
                    <div style={{ width: '100%', height: '6px', background: '#F1F5F9', borderRadius: '4px', overflow: 'hidden' }}>
                      <div style={{ width: `${pct}%`, height: '100%', background: '#EF4444', borderRadius: '4px' }} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Panel 3: Sales Rep Leaderboard Table */}
      <div style={{ background: '#FFFFFF', borderRadius: '14px', border: '1px solid #E2E8F0', padding: '20px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3 style={{ fontSize: '15px', fontWeight: '700', color: '#0F172A', margin: 0 }}>
            Sales Leaderboard & Conversion Rank
          </h3>
          <span style={{ fontSize: '12px', color: '#64748B' }}>By revenue and deal velocity</span>
        </div>

        {leaderboard.length === 0 ? (
          <div style={{ padding: '30px', textAlign: 'center', color: '#94A3B8', fontSize: '13px' }}>
            No sales activity found in this timeframe
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid #E2E8F0', color: '#64748B', fontSize: '12px' }}>
                  <th style={{ padding: '10px 8px', fontWeight: '700' }}>Representative</th>
                  <th style={{ padding: '10px 8px', fontWeight: '700' }}>Assigned</th>
                  <th style={{ padding: '10px 8px', fontWeight: '700' }}>Won Deals</th>
                  <th style={{ padding: '10px 8px', fontWeight: '700' }}>Win Rate</th>
                  <th style={{ padding: '10px 8px', fontWeight: '700' }}>Active Deals</th>
                  <th style={{ padding: '10px 8px', fontWeight: '700', textAlign: 'right' }}>Closed Revenue</th>
                </tr>
              </thead>
              <tbody>
                {leaderboard.map((rep, idx) => (
                  <tr key={rep.repName} style={{ borderBottom: '1px solid #F1F5F9' }}>
                    <td style={{ padding: '12px 8px', fontWeight: '600', color: '#0F172A', display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{
                        width: '22px', height: '22px', borderRadius: '50%',
                        background: idx === 0 ? '#FEF08A' : (idx === 1 ? '#E2E8F0' : (idx === 2 ? '#FED7AA' : '#F1F5F9')),
                        color: idx === 0 ? '#854D0E' : '#334155', display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: '11px', fontWeight: '800'
                      }}>
                        {idx + 1}
                      </span>
                      {rep.repName}
                    </td>
                    <td style={{ padding: '12px 8px', color: '#334155' }}>{rep.totalAssigned}</td>
                    <td style={{ padding: '12px 8px', fontWeight: '700', color: '#16A34A' }}>{rep.wonCount}</td>
                    <td style={{ padding: '12px 8px' }}>
                      <span style={{
                        padding: '2px 8px', borderRadius: '12px', fontSize: '11px', fontWeight: '700',
                        background: rep.winRate >= 50 ? '#DCFCE7' : '#F1F5F9',
                        color: rep.winRate >= 50 ? '#16A34A' : '#64748B'
                      }}>
                        {rep.winRate}%
                      </span>
                    </td>
                    <td style={{ padding: '12px 8px', color: '#0E7490', fontWeight: '600' }}>{rep.activeCount}</td>
                    <td style={{ padding: '12px 8px', fontWeight: '800', color: '#0F172A', textAlign: 'right' }}>
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
