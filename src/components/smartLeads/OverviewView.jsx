import React, { useEffect, useState } from 'react';
import {
  TrendingUp, Users, CalendarClock, AlertTriangle, CheckCircle2,
  Phone, ArrowRight, Sparkles, Flame, DollarSign, Activity, RefreshCw
} from 'lucide-react';
import { slApi, formatINR, formatDate } from './smartLeadsApi';
import { StageBadge, TempBadge, SkeletonRows, BusinzKpiGrid, BusinzKpiCard } from './SlShared';

export default function OverviewView({ meta, onNavigate, onOpenLead, toast }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      const res = await slApi.overview();
      setData(res.data);
    } catch (err) {
      if (toast) toast(err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  if (loading || !data) {
    return (
      <div style={{ padding: '24px', background: '#FFFFFF', borderRadius: '14px', border: '1px solid #E2E8F0' }}>
        <SkeletonRows rows={6} />
      </div>
    );
  }

  const s = data.summary || {};
  const stages = data.stages || [];
  const followups = data.followups || {};
  const attention = data.attentionQueue || [];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '22px' }}>
      {/* Signature BUSINZ KPI Cards */}
      <BusinzKpiGrid minWidth="220px">
        <BusinzKpiCard
          title="ACTIVE PIPELINE VALUE"
          value={formatINR(s.pipelineValue)}
          valColor="#0E7490"
          icon={TrendingUp}
          iconColor="#0E7490"
          iconBg="#ECFEFF"
          trend={`${s.totalLeads || 0} Leads`}
          trendNeutral={true}
          bottomPrefix="Non-closed pipeline"
          bottomHighlight={formatINR(s.pipelineValue)}
          bottomHighlightColor="#0E7490"
          onClick={() => onNavigate && onNavigate('pipeline')}
        />

        <BusinzKpiCard
          title="WEIGHTED SALES FORECAST"
          value={formatINR(s.weightedForecast)}
          valColor="#2563EB"
          icon={DollarSign}
          iconColor="#2563EB"
          iconBg="#EFF6FF"
          trend="Stage Adjusted"
          trendNeutral={true}
          bottomPrefix="Expected conversion"
          bottomHighlight={formatINR(s.weightedForecast)}
          bottomHighlightColor="#2563EB"
          onClick={() => onNavigate && onNavigate('pipeline')}
        />

        <BusinzKpiCard
          title="TOTAL ACTIVE LEADS"
          value={String(s.totalLeads || 0)}
          valColor="#0F172A"
          icon={Users}
          iconColor="#0F172A"
          iconBg="#F8FAFC"
          trend={s.newThisWeek > 0 ? `+${s.newThisWeek} new` : '0 new'}
          trendUp={s.newThisWeek > 0}
          trendNeutral={!s.newThisWeek}
          bottomPrefix="New leads this week"
          bottomHighlight={`+${s.newThisWeek || 0} Added`}
          bottomHighlightColor="#059669"
          onClick={() => onNavigate && onNavigate('leads')}
        />

        <BusinzKpiCard
          title="CONVERSION WIN RATE"
          value={`${s.winRate || 0}%`}
          valColor="#059669"
          icon={CheckCircle2}
          iconColor="#059669"
          iconBg="#ECFDF5"
          trend={`${s.wonCount || 0} Won`}
          trendUp={(s.winRate || 0) > 0}
          trendNeutral={!s.winRate}
          bottomPrefix="Won orders revenue"
          bottomHighlight={formatINR(s.wonValue || 0)}
          bottomHighlightColor="#059669"
          onClick={() => onNavigate && onNavigate('reports')}
        />
      </BusinzKpiGrid>

      {/* Middle Row: Follow-up SLA + Stage Funnel */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: '18px' }}>
        {/* Follow-up SLA Card */}
        <div style={{ background: '#FFFFFF', padding: '20px', borderRadius: '14px', border: '1px solid #E2E8F0', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h3 style={{ fontSize: '15px', fontWeight: '800', color: '#0F172A', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                <CalendarClock size={18} color="#0E7490" />
                Customer Follow-up SLA
              </h3>
              <button
                onClick={load}
                style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: '#94A3B8' }}
                title="Refresh"
              >
                <RefreshCw size={14} />
              </button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '16px' }}>
              <div style={{ background: '#F0FDFA', padding: '14px', borderRadius: '10px', borderLeft: '4px solid #0E7490' }}>
                <div style={{ fontSize: '12px', fontWeight: '700', color: '#0E7490' }}>TODAY'S ACTIONS</div>
                <div style={{ fontSize: '26px', fontWeight: '800', color: '#0F172A', marginTop: '4px' }}>{followups.today || 0}</div>
                <div style={{ fontSize: '11px', color: '#64748B', marginTop: '2px' }}>Calls & meetings due</div>
              </div>

              <div style={{ background: '#FEF2F2', padding: '14px', borderRadius: '10px', borderLeft: '4px solid #DC2626' }}>
                <div style={{ fontSize: '12px', fontWeight: '700', color: '#DC2626' }}>OVERDUE SLA</div>
                <div style={{ fontSize: '26px', fontWeight: '800', color: '#DC2626', marginTop: '4px' }}>{followups.overdue || 0}</div>
                <div style={{ fontSize: '11px', color: '#64748B', marginTop: '2px' }}>Requires immediate call</div>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', color: '#64748B', padding: '0 4px' }}>
              <span>Upcoming scheduled: <strong>{followups.upcoming || 0}</strong></span>
              <span>Completed: <strong>{followups.completed || 0}</strong></span>
            </div>
          </div>

          <button
            onClick={() => onNavigate('followups')}
            style={{
              marginTop: '18px',
              padding: '10px 16px',
              background: '#0E7490',
              border: 'none',
              borderRadius: '8px',
              color: '#FFFFFF',
              fontSize: '13px',
              fontWeight: '700',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px'
            }}
          >
            Open Follow-up Center <ArrowRight size={14} />
          </button>
        </div>

        {/* Pipeline Stage Funnel */}
        <div style={{ background: '#FFFFFF', padding: '20px', borderRadius: '14px', border: '1px solid #E2E8F0' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <h3 style={{ fontSize: '15px', fontWeight: '800', color: '#0F172A', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Activity size={18} color="#0E7490" />
              Pipeline Stage Breakdown
            </h3>
            <button
              onClick={() => onNavigate('pipeline')}
              style={{ border: 'none', background: 'transparent', color: '#0E7490', fontSize: '12px', fontWeight: '700', cursor: 'pointer' }}
            >
              View Kanban →
            </button>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {['New', 'Contacted', 'Qualified', 'Quotation Sent', 'Negotiation', 'Won', 'Lost'].map(stageName => {
              const item = stages.find(st => st.pipeline_stage === stageName) || { count: 0, total_value: 0 };
              const count = parseInt(item.count, 10);
              const val = parseFloat(item.total_value);
              const maxCount = Math.max(...stages.map(st => parseInt(st.count, 10)), 1);
              const pct = Math.min(100, Math.round((count / maxCount) * 100));

              return (
                <div key={stageName}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', marginBottom: '3px' }}>
                    <span style={{ fontWeight: '700', color: '#334155' }}>{stageName}</span>
                    <span style={{ color: '#64748B' }}>
                      <strong>{count}</strong> leads {val > 0 ? `· ${formatINR(val)}` : ''}
                    </span>
                  </div>
                  <div style={{ height: '7px', background: '#F1F5F9', borderRadius: '4px', overflow: 'hidden' }}>
                    <div
                      style={{
                        height: '100%',
                        width: `${pct}%`,
                        background: stageName === 'Won' ? '#059669' : stageName === 'Lost' ? '#DC2626' : '#0E7490',
                        borderRadius: '4px',
                        transition: 'width 0.3s ease'
                      }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* High-Priority Attention Queue */}
      <div style={{ background: '#FFFFFF', padding: '20px', borderRadius: '14px', border: '1px solid #E2E8F0' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
          <div>
            <h3 style={{ fontSize: '15px', fontWeight: '800', color: '#0F172A', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Flame size={18} color="#D97706" />
              High-Priority Attention Queue
            </h3>
            <div style={{ fontSize: '12px', color: '#64748B', marginTop: '2px' }}>
              Hot opportunities and overdue leads requiring urgent action
            </div>
          </div>

          <button
            onClick={() => onNavigate('leads')}
            style={{ border: 'none', background: 'transparent', color: '#0E7490', fontSize: '12px', fontWeight: '700', cursor: 'pointer' }}
          >
            All Leads →
          </button>
        </div>

        {attention.length === 0 ? (
          <div style={{ padding: '20px', textAlign: 'center', color: '#94A3B8', fontSize: '13px' }}>
            No urgent leads in attention queue. All active leads are on schedule!
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '12px' }}>
            {attention.map(lead => {
              const cleanPhone = (lead.phone || '').replace(/[^0-9]/g, '');

              return (
                <div
                  key={lead.id}
                  style={{
                    padding: '14px',
                    borderRadius: '10px',
                    border: '1px solid #E2E8F0',
                    background: '#FAFAFA',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    gap: '10px'
                  }}
                >
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <span
                        onClick={() => onOpenLead(lead.id)}
                        style={{ fontSize: '14px', fontWeight: '700', color: '#0F172A', cursor: 'pointer', textDecoration: 'underline' }}
                      >
                        {lead.company_name || 'Individual Lead'}
                      </span>
                      <TempBadge temp={lead.temperature || 'HOT'} />
                    </div>

                    <div style={{ fontSize: '12px', color: '#64748B', marginTop: '4px' }}>
                      👤 {lead.contact_person || 'No contact'} · 📞 {lead.phone}
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '6px' }}>
                      <StageBadge stage={lead.pipeline_stage} />
                      {lead.estimated_value > 0 && (
                        <span style={{ fontSize: '12px', fontWeight: '700', color: '#0E7490' }}>
                          {formatINR(lead.estimated_value)}
                        </span>
                      )}
                    </div>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid #E2E8F0', paddingTop: '8px' }}>
                    <span style={{ fontSize: '11px', color: '#64748B' }}>
                      {lead.assigned_salesperson_name || 'Sales Team'}
                    </span>

                    <div style={{ display: 'flex', gap: '6px' }}>
                      {cleanPhone && (
                        <a
                          href={`tel:${cleanPhone}`}
                          style={{
                            padding: '4px 8px', borderRadius: '6px', border: '1px solid #E2E8F0',
                            background: '#FFFFFF', color: '#2563EB', fontSize: '11px', fontWeight: '700',
                            textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '4px'
                          }}
                        >
                          <Phone size={12} /> Call
                        </a>
                      )}
                      <button
                        onClick={() => onOpenLead(lead.id)}
                        style={{
                          padding: '4px 10px', borderRadius: '6px', border: 'none',
                          background: '#0E7490', color: '#FFFFFF', fontSize: '11px', fontWeight: '700', cursor: 'pointer'
                        }}
                      >
                        View
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
