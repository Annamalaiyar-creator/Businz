import React, { useEffect, useState } from 'react';
import {
  TrendingUp, Users, CalendarClock, AlertTriangle, CheckCircle2,
  Phone, ArrowRight, DollarSign, RefreshCw,
  BarChart3, Trophy, XCircle
} from 'lucide-react';
import { slApi, formatINR } from './smartLeadsApi';
import { SkeletonRows, BusinzKpiGrid, BusinzKpiCard } from './SlShared';

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
        <div style={{ background: '#FFFFFF', padding: '22px', borderRadius: '14px', border: '1px solid #E2E8F0', boxShadow: '0 1px 3px rgba(0,0,0,0.03)', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
          <div>
            {/* Header with Title, Status Badge & Refresh */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{ width: '34px', height: '34px', borderRadius: '8px', background: '#ECFEFF', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid #CFFAFE' }}>
                  <CalendarClock size={18} color="#0E7490" />
                </div>
                <div>
                  <h3 style={{ fontSize: '15px', fontWeight: '800', color: '#0F172A', margin: 0, lineHeight: 1.2 }}>
                    Customer Follow-up SLA
                  </h3>
                  <div style={{ fontSize: '11px', color: '#64748B', marginTop: '2px' }}>
                    Scheduled client touches & action queue
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                {(followups.overdue || 0) > 0 ? (
                  <span style={{ background: '#FEF2F2', color: '#DC2626', border: '1px solid #FECACA', padding: '3px 8px', borderRadius: '6px', fontSize: '11px', fontWeight: '700' }}>
                    {followups.overdue} SLA Overdue
                  </span>
                ) : (
                  <span style={{ background: '#F0FDF4', color: '#16A34A', border: '1px solid #BBF7D0', padding: '3px 8px', borderRadius: '6px', fontSize: '11px', fontWeight: '700' }}>
                    SLA on Track
                  </span>
                )}
                <button
                  onClick={load}
                  style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: '#94A3B8', display: 'flex', alignItems: 'center', padding: '4px' }}
                  title="Refresh"
                >
                  <RefreshCw size={13} />
                </button>
              </div>
            </div>

            {/* 2x2 Clean Balanced Metric Grid */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '16px' }}>
              {/* Today's Actions */}
              <div style={{ background: '#F0FDFA', padding: '14px', borderRadius: '10px', border: '1px solid #CCFBF1' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '11px', fontWeight: '800', color: '#0E7490', letterSpacing: '0.04em' }}>TODAY'S DUE</span>
                  <Phone size={13} color="#0E7490" />
                </div>
                <div style={{ fontSize: '26px', fontWeight: '800', color: '#0F172A', marginTop: '4px', lineHeight: 1.1 }}>
                  {followups.today || 0}
                </div>
                <div style={{ fontSize: '11px', color: '#64748B', marginTop: '4px' }}>Calls & meetings due</div>
              </div>

              {/* Overdue SLA */}
              <div style={{
                background: (followups.overdue || 0) > 0 ? '#FEF2F2' : '#F8FAFC',
                padding: '14px',
                borderRadius: '10px',
                border: (followups.overdue || 0) > 0 ? '1px solid #FECACA' : '1px solid #E2E8F0'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '11px', fontWeight: '800', color: (followups.overdue || 0) > 0 ? '#DC2626' : '#64748B', letterSpacing: '0.04em' }}>
                    OVERDUE SLA
                  </span>
                  <AlertTriangle size={13} color={(followups.overdue || 0) > 0 ? '#DC2626' : '#94A3B8'} />
                </div>
                <div style={{ fontSize: '26px', fontWeight: '800', color: (followups.overdue || 0) > 0 ? '#DC2626' : '#64748B', marginTop: '4px', lineHeight: 1.1 }}>
                  {followups.overdue || 0}
                </div>
                <div style={{ fontSize: '11px', color: '#64748B', marginTop: '4px' }}>
                  {(followups.overdue || 0) > 0 ? 'Requires immediate call' : 'Zero SLA violations'}
                </div>
              </div>

              {/* Upcoming Scheduled */}
              <div style={{ background: '#EFF6FF', padding: '14px', borderRadius: '10px', border: '1px solid #DBEAFE' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '11px', fontWeight: '800', color: '#2563EB', letterSpacing: '0.04em' }}>UPCOMING</span>
                  <CalendarClock size={13} color="#2563EB" />
                </div>
                <div style={{ fontSize: '26px', fontWeight: '800', color: '#0F172A', marginTop: '4px', lineHeight: 1.1 }}>
                  {followups.upcoming || 0}
                </div>
                <div style={{ fontSize: '11px', color: '#64748B', marginTop: '4px' }}>Next 7 days scheduled</div>
              </div>

              {/* Completed */}
              <div style={{ background: '#F0FDF4', padding: '14px', borderRadius: '10px', border: '1px solid #DCFCE7' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '11px', fontWeight: '800', color: '#16A34A', letterSpacing: '0.04em' }}>COMPLETED</span>
                  <CheckCircle2 size={13} color="#16A34A" />
                </div>
                <div style={{ fontSize: '26px', fontWeight: '800', color: '#0F172A', marginTop: '4px', lineHeight: 1.1 }}>
                  {followups.completed || 0}
                </div>
                <div style={{ fontSize: '11px', color: '#64748B', marginTop: '4px' }}>Successfully resolved</div>
              </div>
            </div>

            {/* SLA Activity Progress Bar */}
            {(() => {
              const totalActions = (followups.today || 0) + (followups.overdue || 0) + (followups.completed || 0);
              const completedPct = totalActions > 0 ? Math.round(((followups.completed || 0) / totalActions) * 100) : 100;
              return (
                <div style={{ background: '#F8FAFC', padding: '10px 14px', borderRadius: '8px', border: '1px solid #E2E8F0', marginTop: '2px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: '#475569', marginBottom: '6px' }}>
                    <span style={{ fontWeight: '600' }}>Follow-up Completion Rate</span>
                    <span style={{ fontWeight: '800', color: completedPct >= 80 ? '#16A34A' : '#0E7490' }}>{completedPct}% Met</span>
                  </div>
                  <div style={{ height: '6px', background: '#E2E8F0', borderRadius: '3px', overflow: 'hidden', display: 'flex' }}>
                    <div style={{ width: `${completedPct}%`, background: '#16A34A', transition: 'width 0.3s' }} />
                    <div style={{ width: `${100 - completedPct}%`, background: (followups.overdue || 0) > 0 ? '#DC2626' : '#0E7490', transition: 'width 0.3s' }} />
                  </div>
                </div>
              );
            })()}
          </div>

          <button
            onClick={() => onNavigate('followups')}
            style={{
              marginTop: '18px',
              padding: '11px 16px',
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
              gap: '6px',
              boxShadow: '0 1px 2px rgba(14, 116, 144, 0.2)',
              transition: 'background 0.15s ease'
            }}
            onMouseOver={(e) => { e.currentTarget.style.background = '#0B5E74'; }}
            onMouseOut={(e) => { e.currentTarget.style.background = '#0E7490'; }}
          >
            Open Follow-up Center <ArrowRight size={14} />
          </button>
        </div>

        {/* Pipeline Stage Funnel Breakdown */}
        <div style={{ background: '#FFFFFF', padding: '22px', borderRadius: '14px', border: '1px solid #E2E8F0', boxShadow: '0 1px 3px rgba(0,0,0,0.03)', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
          <div>
            {/* Header with Title, Total Leads Badge & Kanban Link */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{ width: '34px', height: '34px', borderRadius: '8px', background: '#ECFEFF', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid #CFFAFE' }}>
                  <BarChart3 size={18} color="#0E7490" />
                </div>
                <div>
                  <h3 style={{ fontSize: '15px', fontWeight: '800', color: '#0F172A', margin: 0, lineHeight: 1.2 }}>
                    Pipeline Stage Breakdown
                  </h3>
                  <div style={{ fontSize: '11px', color: '#64748B', marginTop: '2px' }}>
                    Active sales funnel & deal progression
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ background: '#F1F5F9', color: '#475569', padding: '3px 8px', borderRadius: '6px', fontSize: '11px', fontWeight: '700' }}>
                  {s.totalLeads || 0} Total Leads
                </span>
                <button
                  onClick={() => onNavigate('pipeline')}
                  style={{ border: 'none', background: 'transparent', color: '#0E7490', fontSize: '12px', fontWeight: '700', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}
                >
                  Kanban <ArrowRight size={13} />
                </button>
              </div>
            </div>

            {/* Active Funnel Stages List */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {[
                { name: 'New', label: 'New Inbound', color: '#0E7490', bg: '#ECFEFF' },
                { name: 'Contacted', label: 'Contacted', color: '#0284C7', bg: '#E0F2FE' },
                { name: 'Qualified', label: 'Qualified', color: '#16A34A', bg: '#F0FDF4' },
                { name: 'Quotation Sent', label: 'Quotation Sent', color: '#7C3AED', bg: '#F3E8FF' },
                { name: 'Negotiation', label: 'Negotiation', color: '#D97706', bg: '#FEF3C7' }
              ].map(stDef => {
                const item = stages.find(st => st.pipeline_stage === stDef.name) || { count: 0, total_value: 0 };
                const count = parseInt(item.count, 10) || 0;
                const val = parseFloat(item.total_value) || 0;
                const activeLeadCount = stages
                  .filter(st => ['New', 'Contacted', 'Qualified', 'Quotation Sent', 'Negotiation'].includes(st.pipeline_stage))
                  .reduce((sum, st) => sum + (parseInt(st.count, 10) || 0), 0);
                const maxCount = Math.max(...stages.map(st => parseInt(st.count, 10)), 1);
                const pct = Math.min(100, Math.round((count / maxCount) * 100));
                const sharePct = activeLeadCount > 0 ? Math.round((count / activeLeadCount) * 100) : 0;

                return (
                  <div key={stDef.name} style={{ background: '#F8FAFC', padding: '9px 12px', borderRadius: '8px', border: '1px solid #F1F5F9' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{
                          display: 'inline-block',
                          width: '7px',
                          height: '7px',
                          borderRadius: '50%',
                          background: stDef.color
                        }} />
                        <span style={{ fontSize: '12px', fontWeight: '700', color: '#1E293B' }}>
                          {stDef.label}
                        </span>
                        <span style={{
                          background: stDef.bg,
                          color: stDef.color,
                          fontSize: '10px',
                          fontWeight: '800',
                          padding: '1px 6px',
                          borderRadius: '4px'
                        }}>
                          {count}
                        </span>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px' }}>
                        {val > 0 && (
                          <span style={{ fontWeight: '700', color: '#0F172A' }}>
                            {formatINR(val)}
                          </span>
                        )}
                        <span style={{ fontSize: '11px', color: '#94A3B8', fontWeight: '600' }}>
                          {sharePct}% share
                        </span>
                      </div>
                    </div>

                    <div style={{ height: '6px', background: '#E2E8F0', borderRadius: '3px', overflow: 'hidden' }}>
                      <div
                        style={{
                          height: '100%',
                          width: `${pct}%`,
                          background: stDef.color,
                          borderRadius: '3px',
                          transition: 'width 0.3s ease'
                        }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Bottom Conversion Outcomes: Won & Lost Split */}
          {(() => {
            const wonItem = stages.find(st => st.pipeline_stage === 'Won') || { count: s.wonCount || 0, total_value: s.wonValue || 0 };
            const lostItem = stages.find(st => st.pipeline_stage === 'Lost') || { count: 0, total_value: 0 };
            const wonCount = parseInt(wonItem.count, 10) || 0;
            const wonVal = parseFloat(wonItem.total_value) || 0;
            const lostCount = parseInt(lostItem.count, 10) || 0;
            const lostVal = parseFloat(lostItem.total_value) || 0;

            return (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginTop: '14px', paddingTop: '14px', borderTop: '1px solid #F1F5F9' }}>
                {/* Won Outcome */}
                <div style={{ background: '#F0FDF4', padding: '10px 12px', borderRadius: '8px', border: '1px solid #DCFCE7', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                      <Trophy size={13} color="#16A34A" />
                      <span style={{ fontSize: '11px', fontWeight: '800', color: '#16A34A', letterSpacing: '0.03em' }}>WON CONVERSIONS</span>
                    </div>
                    <div style={{ fontSize: '16px', fontWeight: '800', color: '#0F172A', marginTop: '3px', lineHeight: 1.1 }}>
                      {wonCount} <span style={{ fontSize: '11px', fontWeight: '600', color: '#16A34A' }}>({s.winRate || 0}% Win Rate)</span>
                    </div>
                    {wonVal > 0 && (
                      <div style={{ fontSize: '11px', fontWeight: '700', color: '#16A34A', marginTop: '2px' }}>
                        {formatINR(wonVal)}
                      </div>
                    )}
                  </div>
                </div>

                {/* Lost Outcome */}
                <div style={{ background: '#FEF2F2', padding: '10px 12px', borderRadius: '8px', border: '1px solid #FEE2E2', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                      <XCircle size={13} color="#DC2626" />
                      <span style={{ fontSize: '11px', fontWeight: '800', color: '#DC2626', letterSpacing: '0.03em' }}>LOST / DROPPED</span>
                    </div>
                    <div style={{ fontSize: '16px', fontWeight: '800', color: '#0F172A', marginTop: '3px', lineHeight: 1.1 }}>
                      {lostCount} <span style={{ fontSize: '11px', fontWeight: '600', color: '#64748B' }}>Deals</span>
                    </div>
                    {lostVal > 0 && (
                      <div style={{ fontSize: '11px', fontWeight: '700', color: '#DC2626', marginTop: '2px' }}>
                        {formatINR(lostVal)}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })()}
        </div>
      </div>
    </div>
  );
}
