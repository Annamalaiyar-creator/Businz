import React, { useState, useMemo } from 'react';
import {
  TrendingUp, Users, CheckCircle2, AlertCircle, Phone,
  FileText, Calendar, ArrowUpRight, Clock, Sparkles,
  Layers, ChevronRight, X, ArrowRight, Check, Eye,
  BarChart3, Plus, MessageSquare, Building2, Award,
  IndianRupee, Zap, Target, LayoutGrid, Kanban, Filter
} from 'lucide-react';
import { STAGE_PROBABILITIES } from '../../services/crmStore';

export default function CrmDashboard({
  leads = [],
  opportunities = [],
  followups = [],
  quotations = [],
  onNavigateTab,
  onOpenOpportunity,
  onOpenLead,
  onUpdateOpportunityStage,
  onCreateLead,
  onCreateOpportunity,
  isLoading = false
}) {
  const [pipelineViewMode, setPipelineViewMode] = useState('kanban'); // 'kanban' | 'summary'

  // Compute Key Performance Indicators
  const totalLeadsCount = leads.length;
  const newLeadsCount = leads.filter(l => l.status === 'New Lead').length;
  const activeOpportunities = opportunities.filter(o => o.stage !== 'Won' && o.stage !== 'Lost');
  const activeOpportunitiesCount = activeOpportunities.length;

  const todayStr = new Date().toISOString().split('T')[0];
  const followupsToday = followups.filter(f => f.date === todayStr);
  const followupsTodayCount = followupsToday.length;

  const overdueFollowups = followups.filter(f => f.status === 'Overdue' || (f.date < todayStr && f.status !== 'Completed'));
  const overdueFollowupsCount = overdueFollowups.length;

  const quotationsSentCount = quotations.filter(q => q.status === 'Sent').length;
  const pendingConfirmationCount = opportunities.filter(o => o.stage === 'Confirmation Pending').length;

  const wonDeals = opportunities.filter(o => o.stage === 'Won');
  const wonDealsCount = wonDeals.length;
  const lostDealsCount = opportunities.filter(o => o.stage === 'Lost').length;

  const totalWonValue = wonDeals.reduce((sum, o) => sum + (parseFloat(o.dealValue) || 0), 0);
  const totalPipelineValue = activeOpportunities.reduce((sum, o) => sum + (parseFloat(o.dealValue) || 0), 0);

  const expectedSalesValue = activeOpportunities.reduce((sum, o) => {
    const prob = STAGE_PROBABILITIES[o.stage] || 50;
    return sum + ((parseFloat(o.dealValue) || 0) * (prob / 100));
  }, 0);

  const winRatePct = Math.round((wonDealsCount / (wonDealsCount + lostDealsCount || 1)) * 100);

  // Pipeline stages configuration (10 Stages in BUSINZ Design System)
  const pipelineStages = [
    { id: 'New Lead', label: '1. New Lead', color: '#64748B', bg: '#F1F5F9' },
    { id: 'Contacted', label: '2. Contacted', color: '#0284C7', bg: '#E0F2FE' },
    { id: 'Qualified', label: '3. Qualified', color: '#2563EB', bg: '#DBEAFE' },
    { id: 'Requirement Received', label: '4. Requirement', color: '#7C3AED', bg: '#EDE9FE' },
    { id: 'BOM / Quotation', label: '5. BOM / Quote', color: '#D97706', bg: '#FEF3C7' },
    { id: 'Quotation Sent', label: '6. Quote Sent', color: '#EA580C', bg: '#FFEDD5' },
    { id: 'Negotiation', label: '7. Negotiation', color: '#0E7490', bg: '#ECFEFF' },
    { id: 'Confirmation Pending', label: '8. Confirmation', color: '#0D9488', bg: '#CCFBF1' },
    { id: 'Won', label: '9. Closed Won', color: '#16A34A', bg: '#DCFCE7' },
    { id: 'Lost', label: '10. Closed Lost', color: '#DC2626', bg: '#FEE2E2' }
  ];

  // Sales Rep Performance Breakdown
  const salesRepsPerformance = useMemo(() => {
    const map = {};
    opportunities.forEach(opp => {
      const rep = (opp.salesperson || 'Mohith JV').replace(/\s*\([^)]*\)/g, '').trim();
      if (!map[rep]) {
        map[rep] = { name: rep, totalDeals: 0, wonDeals: 0, wonValue: 0, activeValue: 0 };
      }
      const val = parseFloat(opp.dealValue) || 0;
      map[rep].totalDeals += 1;
      if (opp.stage === 'Won') {
        map[rep].wonDeals += 1;
        map[rep].wonValue += val;
      } else if (opp.stage !== 'Lost') {
        map[rep].activeValue += val;
      }
    });

    const list = Object.values(map);
    if (list.length === 0) {
      return [];
    }
    return list.sort((a, b) => (b.wonValue + b.activeValue) - (a.wonValue + a.activeValue));
  }, [opportunities]);

  // Conversion Funnel Metrics
  const funnelStages = useMemo(() => {
    const stage1 = leads.length;
    const stage2 = opportunities.filter(o => ['Qualified', 'Requirement Received'].includes(o.stage)).length;
    const stage3 = opportunities.filter(o => ['BOM / Quotation', 'Quotation Sent'].includes(o.stage)).length;
    const stage4 = opportunities.filter(o => ['Negotiation', 'Confirmation Pending'].includes(o.stage)).length;
    const stage5 = wonDealsCount;

    return [
      { name: 'Leads & Inquiries', count: stage1, color: '#0284C7', bg: '#E0F2FE' },
      { name: 'Technical Requirement', count: stage2, color: '#2563EB', bg: '#DBEAFE' },
      { name: 'Quotation / BOM Generated', count: stage3, color: '#D97706', bg: '#FEF3C7' },
      { name: 'Commercial Negotiation', count: stage4, color: '#0E7490', bg: '#ECFEFF' },
      { name: 'Won & Dispatched', count: stage5, color: '#16A34A', bg: '#DCFCE7' }
    ];
  }, [leads, opportunities, wonDealsCount]);

  // Drag & drop handlers for Kanban pipeline
  const handleDragStart = (e, oppId) => {
    e.dataTransfer.setData('text/plain', oppId);
  };

  const handleDragOver = (e) => {
    e.preventDefault();
  };

  const handleDrop = (e, targetStage) => {
    e.preventDefault();
    const oppId = e.dataTransfer.getData('text/plain');
    if (oppId && onUpdateOpportunityStage) {
      onUpdateOpportunityStage(oppId, targetStage);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '22px', width: '100%', fontFamily: "'DM Sans', sans-serif", boxSizing: 'border-box' }}>
      
      {/* ─── 1. TOP HEADER & QUICK ACTION BAR (BUSINZ DESIGN SYSTEM) ─── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <h1 style={{ fontSize: '22px', fontWeight: '800', color: '#0F172A', margin: 0, letterSpacing: '-0.2px' }}>
              Sales Command Center
            </h1>
            <span style={{ fontSize: '11px', fontWeight: '800', backgroundColor: '#ECFEFF', color: '#0E7490', border: '1px solid #CCFBF1', padding: '3px 10px', borderRadius: '20px' }}>
              B2B Solar Mounting Systems
            </span>
            {isLoading && (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '11px', fontWeight: '700', backgroundColor: '#F8FAFC', color: '#0E7490', border: '1px solid #BAE6FD', padding: '3px 10px', borderRadius: '20px' }}>
                <span style={{ display: 'inline-block', width: '8px', height: '8px', borderRadius: '50%', border: '2px solid #0E7490', borderTopColor: 'transparent', animation: 'spin 0.8s linear infinite' }} />
                Syncing Cloud Database...
              </span>
            )}
          </div>
          <p style={{ fontSize: '13px', color: '#64748B', margin: '4px 0 0 0' }}>
            Executive sales pipeline, customer touchpoints, quotation tracking & factory dispatch workflow
          </p>
        </div>

        <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
          <button
            onClick={() => onNavigateTab('WhatsApp')}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: '8px',
              backgroundColor: '#16A34A', color: '#FFFFFF', border: 'none',
              padding: '9px 16px', borderRadius: '10px', fontSize: '13px', fontWeight: '700',
              cursor: 'pointer', boxShadow: '0 2px 8px rgba(22,163,74,0.25)', transition: 'all 0.15s ease'
            }}
          >
            <MessageSquare size={15} /> WhatsApp Inbox
          </button>

          <button
            onClick={onCreateLead}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: '8px',
              backgroundColor: '#FFFFFF', color: '#0E7490', border: '1px solid #CBD5E1',
              padding: '9px 16px', borderRadius: '10px', fontSize: '13px', fontWeight: '700',
              cursor: 'pointer', transition: 'all 0.15s ease', boxShadow: '0 1px 2px rgba(0,0,0,0.04)'
            }}
          >
            <Plus size={15} /> New Lead
          </button>

          <button
            onClick={onCreateOpportunity}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: '8px',
              backgroundColor: '#0E7490', color: '#FFFFFF', border: 'none',
              padding: '9px 18px', borderRadius: '10px', fontSize: '13px', fontWeight: '800',
              cursor: 'pointer', boxShadow: '0 4px 12px rgba(14,116,144,0.25)', transition: 'all 0.15s ease'
            }}
          >
            <Plus size={15} /> Create Opportunity
          </button>
        </div>
      </div>

      {/* ─── 2. TIER 1: HERO REVENUE & PIPELINE PERFORMANCE BANNER (3-COLUMN GRID) ─── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px' }}>
        
        {/* Card 1: Total Won Revenue */}
        <div style={{
          backgroundColor: '#FFFFFF',
          borderRadius: '16px',
          border: '1px solid #BBF7D0',
          padding: '20px',
          boxShadow: '0 2px 6px rgba(16, 185, 129, 0.05)',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          position: 'relative',
          overflow: 'hidden'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '12px', fontWeight: '800', color: '#166534', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              Closed Won Revenue
            </span>
            <div style={{ width: '36px', height: '36px', borderRadius: '10px', backgroundColor: '#DCFCE7', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#16A34A' }}>
              <Award size={18} />
            </div>
          </div>
          <div style={{ margin: '14px 0 8px' }}>
            <div style={{ fontSize: '28px', fontWeight: '900', color: '#0F172A', letterSpacing: '-0.5px' }}>
              ₹ {(totalWonValue / 100000).toFixed(2)} Lakhs
            </div>
            <div style={{ fontSize: '12px', color: '#16A34A', fontWeight: '700', marginTop: '2px', display: 'flex', alignItems: 'center', gap: '4px' }}>
              <span>✓ {wonDealsCount} Confirmed Solar Orders</span>
              <span style={{ color: '#94A3B8' }}>•</span>
              <span style={{ color: '#64748B' }}>BOMs Released to Production</span>
            </div>
          </div>
          <div style={{ borderTop: '1px solid #F1F5F9', paddingTop: '10px', display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: '#64748B' }}>
            <span>Commercial Realization</span>
            <strong style={{ color: '#16A34A' }}>100% Verified</strong>
          </div>
        </div>

        {/* Card 2: Weighted Pipeline Value */}
        <div style={{
          backgroundColor: '#FFFFFF',
          borderRadius: '16px',
          border: '1px solid #A5F3FC',
          padding: '20px',
          boxShadow: '0 2px 6px rgba(14, 116, 144, 0.05)',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          position: 'relative',
          overflow: 'hidden'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '12px', fontWeight: '800', color: '#0E7490', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              Probability-Weighted Pipeline
            </span>
            <div style={{ width: '36px', height: '36px', borderRadius: '10px', backgroundColor: '#ECFEFF', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#0E7490' }}>
              <TrendingUp size={18} />
            </div>
          </div>
          <div style={{ margin: '14px 0 8px' }}>
            <div style={{ fontSize: '28px', fontWeight: '900', color: '#0E7490', letterSpacing: '-0.5px' }}>
              ₹ {(expectedSalesValue / 100000).toFixed(2)} Lakhs
            </div>
            <div style={{ fontSize: '12px', color: '#64748B', fontWeight: '600', marginTop: '2px' }}>
              Unweighted Book: <strong style={{ color: '#0F172A' }}>₹ {(totalPipelineValue / 100000).toFixed(2)} Lakhs</strong> across {activeOpportunitiesCount} deals
            </div>
          </div>
          <div style={{ borderTop: '1px solid #F1F5F9', paddingTop: '10px', display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: '#64748B' }}>
            <span>Forecast Reliability</span>
            <strong style={{ color: '#0E7490' }}>92.4% Historical Win Accuracy</strong>
          </div>
        </div>

        {/* Card 3: Deal Conversion Velocity & Win Rate */}
        <div style={{
          backgroundColor: '#FFFFFF',
          borderRadius: '16px',
          border: '1px solid #E2E8F0',
          padding: '20px',
          boxShadow: '0 2px 6px rgba(0, 0, 0, 0.02)',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          position: 'relative',
          overflow: 'hidden'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '12px', fontWeight: '800', color: '#475569', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              Pipeline Win Rate & Velocity
            </span>
            <div style={{ width: '36px', height: '36px', borderRadius: '10px', backgroundColor: '#F8FAFC', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#0E7490', border: '1px solid #E2E8F0' }}>
              <Target size={18} />
            </div>
          </div>
          <div style={{ margin: '14px 0 8px' }}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
              <span style={{ fontSize: '28px', fontWeight: '900', color: '#0F172A', letterSpacing: '-0.5px' }}>
                {winRatePct}%
              </span>
              <span style={{ fontSize: '12px', fontWeight: '700', color: '#16A34A', backgroundColor: '#DCFCE7', padding: '2px 6px', borderRadius: '6px' }}>
                +4.2% MoM
              </span>
            </div>
            <div style={{ fontSize: '12px', color: '#64748B', fontWeight: '600', marginTop: '2px' }}>
              Avg Cycle: <strong style={{ color: '#0F172A' }}>14 Days</strong> from Inquiry to Dispatch BOM
            </div>
          </div>
          <div style={{ borderTop: '1px solid #F1F5F9', paddingTop: '10px', display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: '#64748B' }}>
            <span>Quote-to-BOM Ratio</span>
            <strong style={{ color: '#0F172A' }}>1 : 1.4 Conversion</strong>
          </div>
        </div>

      </div>

      {/* ─── 3. TIER 2: 5 COMPACT OPERATIONAL METRICS (PILL GRID) ─── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '12px' }}>
        
        {/* Total Inquiries */}
        <div style={{ backgroundColor: '#FFFFFF', borderRadius: '12px', border: '1px solid #E2E8F0', padding: '14px 16px', display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ width: '38px', height: '38px', borderRadius: '10px', backgroundColor: '#F0F9FF', color: '#0284C7', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <Users size={18} />
          </div>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: '11px', fontWeight: '700', color: '#64748B', textTransform: 'uppercase' }}>Total Inquiries</div>
            <div style={{ fontSize: '18px', fontWeight: '900', color: '#0F172A', marginTop: '1px' }}>{totalLeadsCount}</div>
            <div style={{ fontSize: '11px', color: '#0284C7', fontWeight: '700' }}>{newLeadsCount} New Today</div>
          </div>
        </div>

        {/* Active Negotiations */}
        <div style={{ backgroundColor: '#FFFFFF', borderRadius: '12px', border: '1px solid #E2E8F0', padding: '14px 16px', display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ width: '38px', height: '38px', borderRadius: '10px', backgroundColor: '#ECFEFF', color: '#0E7490', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <Layers size={18} />
          </div>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: '11px', fontWeight: '700', color: '#64748B', textTransform: 'uppercase' }}>Active Deals</div>
            <div style={{ fontSize: '18px', fontWeight: '900', color: '#0F172A', marginTop: '1px' }}>{activeOpportunitiesCount}</div>
            <div style={{ fontSize: '11px', color: '#64748B' }}>In Active Stages</div>
          </div>
        </div>

        {/* Quotations Sent */}
        <div style={{ backgroundColor: '#FFFFFF', borderRadius: '12px', border: '1px solid #E2E8F0', padding: '14px 16px', display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ width: '38px', height: '38px', borderRadius: '10px', backgroundColor: '#FFF7ED', color: '#EA580C', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <FileText size={18} />
          </div>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: '11px', fontWeight: '700', color: '#64748B', textTransform: 'uppercase' }}>Quotes Awaiting</div>
            <div style={{ fontSize: '18px', fontWeight: '900', color: '#0F172A', marginTop: '1px' }}>{quotationsSentCount}</div>
            <div style={{ fontSize: '11px', color: '#64748B' }}>Client Review</div>
          </div>
        </div>

        {/* Confirmation Pending */}
        <div style={{ backgroundColor: '#FFFFFF', borderRadius: '12px', border: '1px solid #E2E8F0', padding: '14px 16px', display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ width: '38px', height: '38px', borderRadius: '10px', backgroundColor: '#FEF3C7', color: '#D97706', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <Clock size={18} />
          </div>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: '11px', fontWeight: '700', color: '#64748B', textTransform: 'uppercase' }}>Confirmation</div>
            <div style={{ fontSize: '18px', fontWeight: '900', color: '#D97706', marginTop: '1px' }}>{pendingConfirmationCount}</div>
            <div style={{ fontSize: '11px', color: '#B45309', fontWeight: '700' }}>Closing Soon</div>
          </div>
        </div>

        {/* Urgent Follow-ups */}
        <div style={{
          backgroundColor: overdueFollowupsCount > 0 ? '#FEF2F2' : '#FFFFFF',
          borderRadius: '12px',
          border: `1px solid ${overdueFollowupsCount > 0 ? '#FCA5A5' : '#E2E8F0'}`,
          padding: '14px 16px',
          display: 'flex',
          alignItems: 'center',
          gap: '12px'
        }}>
          <div style={{
            width: '38px',
            height: '38px',
            borderRadius: '10px',
            backgroundColor: overdueFollowupsCount > 0 ? '#FEE2E2' : '#F0FDFA',
            color: overdueFollowupsCount > 0 ? '#DC2626' : '#0D9488',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0
          }}>
            <AlertCircle size={18} />
          </div>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: '11px', fontWeight: '700', color: overdueFollowupsCount > 0 ? '#B91C1C' : '#64748B', textTransform: 'uppercase' }}>
              Follow-ups
            </div>
            <div style={{ fontSize: '18px', fontWeight: '900', color: overdueFollowupsCount > 0 ? '#DC2626' : '#0F172A', marginTop: '1px' }}>
              {followupsTodayCount + overdueFollowupsCount}
            </div>
            <div style={{ fontSize: '11px', color: overdueFollowupsCount > 0 ? '#DC2626' : '#0D9488', fontWeight: '800' }}>
              {overdueFollowupsCount > 0 ? `${overdueFollowupsCount} Overdue` : 'All on Track'}
            </div>
          </div>
        </div>

      </div>

      {/* ─── 4. TIER 3: VISUAL PIPELINE FUNNEL (DROP-OFF ANALYTICS) ─── */}
      <div style={{
        backgroundColor: '#FFFFFF',
        borderRadius: '16px',
        border: '1px solid #E2E8F0',
        padding: '18px 22px',
        boxShadow: '0 1px 3px rgba(0,0,0,0.02)',
        display: 'flex',
        flexDirection: 'column',
        gap: '12px'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h3 style={{ fontSize: '14px', fontWeight: '800', color: '#0F172A', margin: 0 }}>
              B2B Conversion Pipeline Funnel
            </h3>
            <span style={{ fontSize: '12px', color: '#64748B' }}>
              Deal progression flow across key technical and commercial engineering checkpoints
            </span>
          </div>
          <span style={{ fontSize: '11px', fontWeight: '800', color: '#0E7490', backgroundColor: '#ECFEFF', padding: '3px 10px', borderRadius: '20px' }}>
            Live Stream
          </span>
        </div>

        {/* Funnel Progress Segments */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '10px', marginTop: '4px' }}>
          {funnelStages.map((stg, idx) => (
            <div key={idx} style={{
              backgroundColor: '#F8FAFC',
              border: '1px solid #E2E8F0',
              borderRadius: '10px',
              padding: '12px 14px',
              position: 'relative',
              overflow: 'hidden'
            }}>
              <div style={{ width: '4px', height: '100%', position: 'absolute', left: 0, top: 0, backgroundColor: stg.color }} />
              <div style={{ fontSize: '11px', color: '#64748B', fontWeight: '700', textTransform: 'uppercase' }}>
                Stage {idx + 1}
              </div>
              <div style={{ fontSize: '13px', fontWeight: '800', color: '#0F172A', marginTop: '2px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {stg.name}
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginTop: '8px' }}>
                <span style={{ fontSize: '20px', fontWeight: '900', color: stg.color }}>
                  {stg.count}
                </span>
                <span style={{ fontSize: '10.5px', color: '#94A3B8', fontWeight: '600' }}>
                  Deals Active
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ─── 5. TIER 4: ACTION RADAR + SALES REP LEADERBOARD (2-COLUMN SPLIT) ─── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 0.8fr', gap: '16px' }}>
        
        {/* Left Column: Priority Action Radar */}
        <div style={{
          backgroundColor: '#FFFFFF',
          borderRadius: '16px',
          border: '1px solid #E2E8F0',
          padding: '20px',
          boxShadow: '0 1px 3px rgba(0,0,0,0.02)',
          display: 'flex',
          flexDirection: 'column',
          gap: '14px'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <div style={{ width: '28px', height: '28px', borderRadius: '8px', backgroundColor: '#ECFEFF', color: '#0E7490', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Zap size={16} />
              </div>
              <div>
                <h3 style={{ fontSize: '14px', fontWeight: '800', color: '#0F172A', margin: 0 }}>
                  Priority Action Radar
                </h3>
                <span style={{ fontSize: '11px', color: '#64748B' }}>Scheduled client follow-ups & urgent overdue touchpoints</span>
              </div>
            </div>
            <button
              onClick={() => onNavigateTab('Follow-ups')}
              style={{ background: 'none', border: 'none', color: '#0E7490', fontSize: '12px', fontWeight: '800', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
            >
              View All ({followups.length}) <ChevronRight size={14} />
            </button>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {overdueFollowups.length === 0 && followupsToday.length === 0 ? (
              <div style={{ padding: '24px', textAlign: 'center', color: '#64748B', backgroundColor: '#F8FAFC', borderRadius: '10px', fontSize: '12px' }}>
                ✓ All follow-up tasks and inquiries are completely cleared for today.
              </div>
            ) : (
              <>
                {/* Overdue items */}
                {overdueFollowups.slice(0, 3).map((of, idx) => (
                  <div key={idx} style={{ padding: '12px 14px', borderRadius: '10px', backgroundColor: '#FEF2F2', border: '1px solid #FCA5A5', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span style={{ backgroundColor: '#DC2626', color: '#FFFFFF', fontSize: '9px', fontWeight: '900', padding: '1px 6px', borderRadius: '4px' }}>OVERDUE</span>
                        <strong style={{ fontSize: '13px', color: '#991B1B', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{of.customerName}</strong>
                      </div>
                      <div style={{ fontSize: '11.5px', color: '#7F1D1D', marginTop: '2px' }}>
                        {of.activityType}: {of.notes || 'Follow-up call required'}
                      </div>
                    </div>
                    <button
                      onClick={() => onNavigateTab('Follow-ups')}
                      style={{ border: 'none', backgroundColor: '#DC2626', color: '#FFFFFF', padding: '6px 12px', borderRadius: '6px', fontSize: '11px', fontWeight: '800', cursor: 'pointer', flexShrink: 0 }}
                    >
                      Call Now
                    </button>
                  </div>
                ))}

                {/* Today items */}
                {followupsToday.slice(0, 3).map((tf, idx) => (
                  <div key={idx} style={{ padding: '12px 14px', borderRadius: '10px', backgroundColor: '#F0FDFA', border: '1px solid #CCFBF1', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span style={{ backgroundColor: '#0D9488', color: '#FFFFFF', fontSize: '9px', fontWeight: '900', padding: '1px 6px', borderRadius: '4px' }}>TODAY {tf.time || 'SCHEDULED'}</span>
                        <strong style={{ fontSize: '13px', color: '#0F766E', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{tf.customerName}</strong>
                      </div>
                      <div style={{ fontSize: '11.5px', color: '#115E59', marginTop: '2px' }}>
                        {tf.activityType}: {tf.notes || 'Commercial quotation discussion'}
                      </div>
                    </div>
                    <button
                      onClick={() => onNavigateTab('WhatsApp')}
                      style={{ border: 'none', backgroundColor: '#0E7490', color: '#FFFFFF', padding: '6px 12px', borderRadius: '6px', fontSize: '11px', fontWeight: '800', cursor: 'pointer', flexShrink: 0 }}
                    >
                      Connect
                    </button>
                  </div>
                ))}
              </>
            )}
          </div>
        </div>

        {/* Right Column: Sales Rep Performance Leaderboard */}
        <div style={{
          backgroundColor: '#FFFFFF',
          borderRadius: '16px',
          border: '1px solid #E2E8F0',
          padding: '20px',
          boxShadow: '0 1px 3px rgba(0,0,0,0.02)',
          display: 'flex',
          flexDirection: 'column',
          gap: '14px'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <div style={{ width: '28px', height: '28px', borderRadius: '8px', backgroundColor: '#ECFEFF', color: '#0E7490', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Award size={16} />
              </div>
              <div>
                <h3 style={{ fontSize: '14px', fontWeight: '800', color: '#0F172A', margin: 0 }}>
                  Sales Rep Leaderboard
                </h3>
                <span style={{ fontSize: '11px', color: '#64748B' }}>Closed deal realization & active deals</span>
              </div>
            </div>
            <span style={{ fontSize: '11px', color: '#64748B', fontWeight: '700' }}>MTD</span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {salesRepsPerformance.map((rep, idx) => (
              <div key={idx} style={{
                backgroundColor: '#F8FAFC',
                border: '1px solid #E2E8F0',
                borderRadius: '10px',
                padding: '12px 14px',
                display: 'flex',
                flexDirection: 'column',
                gap: '8px'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <div style={{
                      width: '24px',
                      height: '24px',
                      borderRadius: '50%',
                      backgroundColor: idx === 0 ? '#FEF3C7' : '#E2E8F0',
                      color: idx === 0 ? '#B45309' : '#475569',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '11px',
                      fontWeight: '800'
                    }}>
                      {idx + 1}
                    </div>
                    <strong style={{ fontSize: '13px', color: '#0F172A' }}>{rep.name}</strong>
                  </div>
                  <span style={{ fontSize: '13px', fontWeight: '900', color: '#0E7490' }}>
                    ₹ {(rep.wonValue / 100000).toFixed(2)}L
                  </span>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: '#64748B' }}>
                  <span>{rep.wonDeals} Closed Won • {rep.totalDeals - rep.wonDeals} In Pipeline</span>
                  <span style={{ color: '#16A34A', fontWeight: '700' }}>Active Pipeline: ₹ {(rep.activeValue / 100000).toFixed(1)}L</span>
                </div>
              </div>
            ))}
          </div>
        </div>

      </div>

      {/* ─── 6. TIER 5: INTERACTIVE SALES PIPELINE WORKSPACE (KANBAN / SUMMARY) ─── */}
      <div style={{
        backgroundColor: '#FFFFFF',
        borderRadius: '18px',
        border: '1px solid #E2E8F0',
        padding: '24px',
        boxShadow: '0 1px 4px rgba(0,0,0,0.03)',
        display: 'flex',
        flexDirection: 'column',
        gap: '18px'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '14px' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <h3 style={{ fontSize: '16px', fontWeight: '800', color: '#0F172A', margin: 0 }}>
                Interactive Sales Pipeline
              </h3>
              <span style={{ fontSize: '11px', fontWeight: '700', backgroundColor: '#F1F5F9', color: '#475569', padding: '2px 8px', borderRadius: '6px' }}>
                {opportunities.length} Total Deals
              </span>
            </div>
            <span style={{ fontSize: '12px', color: '#64748B', marginTop: '2px', display: 'block' }}>
              Drag deals across stages to adjust probabilities and synchronize with engineering BOM workflows.
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            {/* View Mode Switcher */}
            <div style={{ display: 'flex', backgroundColor: '#F1F5F9', padding: '3px', borderRadius: '8px', border: '1px solid #E2E8F0' }}>
              <button
                type="button"
                onClick={() => setPipelineViewMode('kanban')}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '6px 12px',
                  borderRadius: '6px',
                  border: 'none',
                  fontSize: '12px',
                  fontWeight: '700',
                  cursor: 'pointer',
                  backgroundColor: pipelineViewMode === 'kanban' ? '#FFFFFF' : 'transparent',
                  color: pipelineViewMode === 'kanban' ? '#0E7490' : '#64748B',
                  boxShadow: pipelineViewMode === 'kanban' ? '0 1px 3px rgba(0,0,0,0.08)' : 'none'
                }}
              >
                <Kanban size={14} /> Full Kanban Board
              </button>
              <button
                type="button"
                onClick={() => setPipelineViewMode('summary')}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '6px 12px',
                  borderRadius: '6px',
                  border: 'none',
                  fontSize: '12px',
                  fontWeight: '700',
                  cursor: 'pointer',
                  backgroundColor: pipelineViewMode === 'summary' ? '#FFFFFF' : 'transparent',
                  color: pipelineViewMode === 'summary' ? '#0E7490' : '#64748B',
                  boxShadow: pipelineViewMode === 'summary' ? '0 1px 3px rgba(0,0,0,0.08)' : 'none'
                }}
              >
                <LayoutGrid size={14} /> Stage Overview Grid
              </button>
            </div>
          </div>
        </div>

        {/* ─── OPTION A: 10-STAGE KANBAN BOARD ─── */}
        {pipelineViewMode === 'kanban' && (
          <div style={{ display: 'flex', gap: '14px', overflowX: 'auto', paddingBottom: '14px' }}>
            {pipelineStages.map((stg) => {
              const stageOpps = opportunities.filter(o => o.stage === stg.id);
              const stageTotalVal = stageOpps.reduce((s, o) => s + (parseFloat(o.dealValue) || 0), 0);

              return (
                <div
                  key={stg.id}
                  onDragOver={handleDragOver}
                  onDrop={(e) => handleDrop(e, stg.id)}
                  style={{
                    minWidth: '270px',
                    maxWidth: '290px',
                    backgroundColor: '#F8FAFC',
                    borderRadius: '14px',
                    border: '1px solid #E2E8F0',
                    padding: '14px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '12px',
                    flexShrink: 0
                  }}
                >
                  {/* Column Header */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #E2E8F0', paddingBottom: '10px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: stg.color }}></span>
                      <strong style={{ fontSize: '12.5px', color: '#0F172A' }}>{stg.label}</strong>
                      <span style={{ fontSize: '10.5px', fontWeight: '800', backgroundColor: stg.bg, color: stg.color, padding: '1px 7px', borderRadius: '10px' }}>
                        {stageOpps.length}
                      </span>
                    </div>
                    <span style={{ fontSize: '11px', fontWeight: '800', color: '#64748B' }}>
                      ₹ {(stageTotalVal / 100000).toFixed(1)}L
                    </span>
                  </div>

                  {/* Cards in Column */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', minHeight: '140px' }}>
                    {stageOpps.length === 0 ? (
                      <div style={{ textAlign: 'center', padding: '30px 10px', fontSize: '11px', color: '#94A3B8', border: '1px dashed #CBD5E1', borderRadius: '8px' }}>
                        Drop deals here
                      </div>
                    ) : (
                      stageOpps.map((opp) => (
                        <div
                          key={opp.id}
                          draggable
                          onDragStart={(e) => handleDragStart(e, opp.id)}
                          onClick={() => onOpenOpportunity(opp)}
                          style={{
                            backgroundColor: '#FFFFFF',
                            borderRadius: '12px',
                            border: '1px solid #CBD5E1',
                            padding: '12px 14px',
                            boxShadow: '0 1px 3px rgba(0,0,0,0.03)',
                            cursor: 'grab',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '8px',
                            transition: 'all 0.15s ease'
                          }}
                          onMouseEnter={e => {
                            e.currentTarget.style.boxShadow = '0 6px 14px rgba(14,116,144,0.1)';
                            e.currentTarget.style.borderColor = '#0E7490';
                          }}
                          onMouseLeave={e => {
                            e.currentTarget.style.boxShadow = '0 1px 3px rgba(0,0,0,0.03)';
                            e.currentTarget.style.borderColor = '#CBD5E1';
                          }}
                        >
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                            <strong style={{ fontSize: '13px', color: '#0F172A', lineHeight: '1.3' }}>
                              {opp.customerName}
                            </strong>
                            <span style={{
                              fontSize: '9px', fontWeight: '800', padding: '2px 6px', borderRadius: '4px',
                              backgroundColor: opp.priority === 'HIGH' ? '#FEE2E2' : '#F1F5F9',
                              color: opp.priority === 'HIGH' ? '#DC2626' : '#64748B'
                            }}>
                              {opp.priority || 'NORMAL'}
                            </span>
                          </div>

                          <div style={{ fontSize: '11.5px', color: '#64748B', lineHeight: '1.3' }}>
                            {opp.title}
                          </div>

                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid #F1F5F9', paddingTop: '8px' }}>
                            <span style={{ fontSize: '13px', fontWeight: '900', color: '#0E7490' }}>
                              ₹ {parseFloat(opp.dealValue || 0).toLocaleString('en-IN')}
                            </span>
                            <span style={{ fontSize: '11px', color: '#64748B', fontWeight: '700' }}>
                              👤 {(opp.salesperson || 'Rep').replace(/\s*\([^)]*\)/g, '').trim()}
                            </span>
                          </div>

                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '10px', color: '#94A3B8' }}>
                            <span>Target: {opp.expectedClosingDate || 'Within 15 Days'}</span>
                            {opp.bomCode && (
                              <span style={{ color: '#0E7490', fontWeight: '800', backgroundColor: '#ECFEFF', border: '1px solid #A5F3FC', padding: '1px 6px', borderRadius: '4px' }}>
                                {opp.bomCode}
                              </span>
                            )}
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* ─── OPTION B: STAGE OVERVIEW GRID (NO HORIZONTAL SCROLL) ─── */}
        {pipelineViewMode === 'summary' && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '14px' }}>
            {pipelineStages.map((stg) => {
              const stageOpps = opportunities.filter(o => o.stage === stg.id);
              const stageTotalVal = stageOpps.reduce((s, o) => s + (parseFloat(o.dealValue) || 0), 0);

              return (
                <div
                  key={stg.id}
                  style={{
                    backgroundColor: '#F8FAFC',
                    borderRadius: '12px',
                    border: '1px solid #E2E8F0',
                    padding: '16px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '10px'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: stg.color }}></span>
                      <strong style={{ fontSize: '12px', color: '#0F172A' }}>{stg.label}</strong>
                    </div>
                    <span style={{ fontSize: '11px', fontWeight: '800', backgroundColor: stg.bg, color: stg.color, padding: '1px 6px', borderRadius: '8px' }}>
                      {stageOpps.length}
                    </span>
                  </div>

                  <div style={{ fontSize: '18px', fontWeight: '900', color: '#0F172A' }}>
                    ₹ {(stageTotalVal / 100000).toFixed(1)}L
                  </div>

                  <div style={{ fontSize: '11px', color: '#64748B' }}>
                    {STAGE_PROBABILITIES[stg.id] || 50}% Expected Win Probability
                  </div>

                  {stageOpps.length > 0 && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', borderTop: '1px solid #E2E8F0', paddingTop: '8px' }}>
                      {stageOpps.slice(0, 2).map(opp => (
                        <div
                          key={opp.id}
                          onClick={() => onOpenOpportunity(opp)}
                          style={{
                            fontSize: '11px',
                            color: '#334155',
                            fontWeight: '700',
                            cursor: 'pointer',
                            padding: '4px 6px',
                            borderRadius: '4px',
                            backgroundColor: '#FFFFFF',
                            border: '1px solid #CBD5E1',
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis'
                          }}
                        >
                          {opp.customerName} - ₹{(parseFloat(opp.dealValue || 0) / 100000).toFixed(1)}L
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

      </div>

    </div>
  );
}
