import React, { useEffect, useState } from 'react';
import {
  Users, TrendingUp, AlertTriangle, CheckCircle2,
  RefreshCw, ArrowRightLeft, CalendarClock, Briefcase, ChevronRight,
  Search, X, Filter, LayoutList, LayoutGrid, Info, ShieldCheck, ArrowRight,
  Clock, User, Phone, Mail, ExternalLink
} from 'lucide-react';
import { slApi, formatINR, formatDate, isOverdue } from './smartLeadsApi';
import { SkeletonRows, BusinzKpiGrid, BusinzKpiCard, EmptyState, StageBadge, TempBadge } from './SlShared';

export default function TeamView({ meta, onNavigate, onOpenLead, toast }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [workloadFilter, setWorkloadFilter] = useState('all');
  const [viewMode, setViewMode] = useState('table');
  const [reassignModal, setReassignModal] = useState(false);
  const [fromUser, setFromUser] = useState('');
  const [toUser, setToUser] = useState('');
  const [reassigning, setReassigning] = useState(false);

  // Representative Leads Popup State
  const [selectedRep, setSelectedRep] = useState(null);
  const [repLeads, setRepLeads] = useState([]);
  const [loadingRepLeads, setLoadingRepLeads] = useState(false);
  const [repLeadSearch, setRepLeadSearch] = useState('');

  const load = async () => {
    setLoading(true);
    try {
      const res = await slApi.team();
      setData(res.data);
    } catch (err) {
      if (toast) toast(err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  // Fetch leads assigned to selected representative
  useEffect(() => {
    if (!selectedRep) {
      setRepLeads([]);
      setRepLeadSearch('');
      return;
    }
    let cancelled = false;
    setLoadingRepLeads(true);
    slApi.listLeads({ owner: selectedRep.user_id, pageSize: 50 })
      .then(res => {
        if (!cancelled) setRepLeads(res.rows || []);
      })
      .catch(() => {
        if (!cancelled) setRepLeads([]);
      })
      .finally(() => {
        if (!cancelled) setLoadingRepLeads(false);
      });
    return () => { cancelled = true; };
  }, [selectedRep]);

  const handleReassign = async () => {
    if (!fromUser || !toUser) {
      if (toast) toast('Please select both source and target sales reps', 'error');
      return;
    }
    if (fromUser === toUser) {
      if (toast) toast('Source and target representative cannot be the same', 'error');
      return;
    }
    setReassigning(true);
    try {
      const res = await slApi.reassignTeam({ fromUserId: fromUser, toUserId: toUser });
      if (toast) toast(`Successfully reassigned ${res.reassignedCount} leads to ${res.targetName}`, 'success');
      setReassignModal(false);
      setFromUser('');
      setToUser('');
      load();
    } catch (err) {
      if (toast) toast(err.message, 'error');
    } finally {
      setReassigning(false);
    }
  };

  if (loading || !data) {
    return (
      <div style={{ padding: '24px', background: '#FFFFFF', borderRadius: '14px', border: '1px solid #E2E8F0' }}>
        <SkeletonRows rows={8} />
      </div>
    );
  }

  const { members = [], totals = {} } = data;

  const filteredMembers = (members || []).filter(m => {
    if (search.trim()) {
      const q = search.toLowerCase();
      const match = (m.name || '').toLowerCase().includes(q) ||
                    (m.role || '').toLowerCase().includes(q) ||
                    (m.user_id || '').toLowerCase().includes(q);
      if (!match) return false;
    }
    if (workloadFilter === 'available') return m.active_leads < 5;
    if (workloadFilter === 'balanced') return m.active_leads >= 5 && m.active_leads <= 15;
    if (workloadFilter === 'high') return m.active_leads > 15;
    if (workloadFilter === 'overdue') return m.overdue_followups > 0;
    return true;
  });

  const filteredRepLeads = (repLeads || []).filter(lead => {
    if (!repLeadSearch.trim()) return true;
    const q = repLeadSearch.toLowerCase();
    return (lead.company_name || '').toLowerCase().includes(q) ||
           (lead.contact_person || '').toLowerCase().includes(q) ||
           (lead.lead_number || '').toLowerCase().includes(q) ||
           (lead.phone || '').includes(q);
  });

  const avgLeadsPerRep = members.length > 0
    ? (totals.totalActiveLeads / members.length).toFixed(1)
    : '0';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
      {/* 1. Header & Reassign Action */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h2 style={{ fontSize: '18px', fontWeight: '800', color: '#0F172A', margin: 0 }}>
            Sales Team Workload & Allocation
          </h2>
          <p style={{ fontSize: '13px', color: '#64748B', margin: '4px 0 0 0' }}>
            Real-time sales capacity, pipeline distribution, and workload balancing across representatives. Click any row to view assigned leads.
          </p>
        </div>
        <div style={{ display: 'flex', gap: '10px' }}>
          <button
            onClick={() => {
              setFromUser('');
              setToUser('');
              setReassignModal(true);
            }}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              padding: '8px 16px',
              borderRadius: '8px',
              border: 'none',
              background: '#0E7490',
              color: '#FFFFFF',
              fontSize: '13px',
              fontWeight: '700',
              cursor: 'pointer',
              boxShadow: '0 1px 2px rgba(0,0,0,0.05)'
            }}
          >
            <ArrowRightLeft size={15} />
            Reassign Leads
          </button>
          <button
            onClick={load}
            title="Refresh Data"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '36px',
              height: '36px',
              borderRadius: '8px',
              border: '1px solid #CBD5E1',
              background: '#FFFFFF',
              color: '#475569',
              cursor: 'pointer'
            }}
          >
            <RefreshCw size={15} />
          </button>
        </div>
      </div>

      {/* 2. Top Executive Summary KPI Cards */}
      <BusinzKpiGrid minWidth="220px">
        <BusinzKpiCard
          title="ACTIVE SALES TEAM"
          value={String(members.length)}
          valColor="#0E7490"
          bottomPrefix={`Avg. ${avgLeadsPerRep} active deals / rep`}
          bottomHighlight={`${members.length} Reps`}
          bottomHighlightColor="#0E7490"
          icon={Users}
          iconColor="#0E7490"
          iconBg="#ECFEFF"
          trend="Active"
          trendNeutral={true}
        />
        <BusinzKpiCard
          title="MANAGED PIPELINE"
          value={formatINR(totals.totalPipelineValue || 0)}
          valColor="#2563EB"
          bottomPrefix="Active workload"
          bottomHighlight={`${totals.totalActiveLeads || 0} active deals`}
          bottomHighlightColor="#2563EB"
          icon={TrendingUp}
          iconColor="#2563EB"
          iconBg="#EFF6FF"
          trend="In Pipeline"
          trendNeutral={true}
        />
        <BusinzKpiCard
          title="CLOSED WON REVENUE"
          value={formatINR(totals.totalWonValue || 0)}
          valColor="#059669"
          bottomPrefix="Converted orders"
          bottomHighlight={`${totals.totalWonLeads || 0} Won`}
          bottomHighlightColor="#059669"
          icon={CheckCircle2}
          iconColor="#059669"
          iconBg="#ECFDF5"
          trend={`${totals.totalWonLeads || 0} Won`}
          trendUp={(totals.totalWonLeads || 0) > 0}
          trendNeutral={!(totals.totalWonLeads || 0)}
        />
        <BusinzKpiCard
          title="OVERDUE SLA FOLLOW-UPS"
          value={String(totals.totalOverdueFollowups || 0)}
          valColor={totals.totalOverdueFollowups > 0 ? "#DC2626" : "#0F172A"}
          bottomPrefix="Follow-up health"
          bottomHighlight={totals.totalOverdueFollowups > 0 ? "Requires rebalance" : "On track"}
          bottomHighlightColor={totals.totalOverdueFollowups > 0 ? "#DC2626" : "#059669"}
          icon={AlertTriangle}
          iconColor={totals.totalOverdueFollowups > 0 ? "#DC2626" : "#64748B"}
          iconBg={totals.totalOverdueFollowups > 0 ? "#FEF2F2" : "#F1F5F9"}
          highlightCard={totals.totalOverdueFollowups > 0}
        />
      </BusinzKpiGrid>

      {/* 3. Toolbar: Search, Filter, View Mode Toggle */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '12px 16px',
        backgroundColor: '#fafbfc',
        border: '1px solid #E2E8F0',
        borderRadius: '12px',
        gap: '12px',
        flexWrap: 'wrap'
      }}>
        {/* Left: Search Bar */}
        <div style={{
          position: 'relative',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          border: '1px solid #cbd5e1',
          borderRadius: '8px',
          padding: '0 12px',
          height: '38px',
          backgroundColor: '#FFFFFF',
          flex: '1 1 240px',
          maxWidth: '380px'
        }}>
          <Search size={15} color="#94A3B8" style={{ flexShrink: 0 }} />
          <input
            type="text"
            placeholder="Search representatives by name, role or ID..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ border: 'none', background: 'none', outline: 'none', fontSize: '13px', width: '100%', color: '#334155' }}
          />
          {search && (
            <X size={15} color="#94A3B8" style={{ cursor: 'pointer', flexShrink: 0 }} onClick={() => setSearch('')} />
          )}
        </div>

        {/* Right: Workload Filter & View Mode Switch */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginLeft: 'auto', flexWrap: 'wrap' }}>
          {/* Workload Filter */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            border: '1px solid #cbd5e1',
            borderRadius: '8px',
            padding: '0 12px',
            height: '38px',
            backgroundColor: '#FFFFFF'
          }}>
            <Filter size={14} color="#64748B" style={{ flexShrink: 0 }} />
            <select
              value={workloadFilter}
              onChange={(e) => setWorkloadFilter(e.target.value)}
              style={{ border: 'none', outline: 'none', fontSize: '13px', color: '#334155', backgroundColor: 'transparent', cursor: 'pointer' }}
            >
              <option value="all">All Workload States</option>
              <option value="available">Available (&lt; 5 leads)</option>
              <option value="balanced">Balanced (5 – 15 leads)</option>
              <option value="high">Overloaded (&gt; 15 leads)</option>
              <option value="overdue">Has Overdue Touches</option>
            </select>
          </div>

          {/* Table / Cards View Mode Toggle */}
          <div style={{
            display: 'flex',
            backgroundColor: '#F1F5F9',
            padding: '3px',
            borderRadius: '8px',
            border: '1px solid #E2E8F0'
          }}>
            <button
              onClick={() => setViewMode('table')}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '6px 12px',
                borderRadius: '6px',
                border: 'none',
                backgroundColor: viewMode === 'table' ? '#FFFFFF' : 'transparent',
                color: viewMode === 'table' ? '#0E7490' : '#64748B',
                fontWeight: viewMode === 'table' ? '700' : '500',
                fontSize: '12px',
                cursor: 'pointer',
                boxShadow: viewMode === 'table' ? '0 1px 3px rgba(0,0,0,0.06)' : 'none'
              }}
            >
              <LayoutList size={14} /> Table
            </button>
            <button
              onClick={() => setViewMode('cards')}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '6px 12px',
                borderRadius: '6px',
                border: 'none',
                backgroundColor: viewMode === 'cards' ? '#FFFFFF' : 'transparent',
                color: viewMode === 'cards' ? '#0E7490' : '#64748B',
                fontWeight: viewMode === 'cards' ? '700' : '500',
                fontSize: '12px',
                cursor: 'pointer',
                boxShadow: viewMode === 'cards' ? '0 1px 3px rgba(0,0,0,0.06)' : 'none'
              }}
            >
              <LayoutGrid size={14} /> Cards
            </button>
          </div>
        </div>
      </div>

      {/* 4. Main Representative Workload Display */}
      {filteredMembers.length === 0 ? (
        <div style={{ padding: '36px', background: '#FFFFFF', borderRadius: '12px', border: '1px solid #E2E8F0' }}>
          <EmptyState
            title="No representatives match criteria"
            text="Try adjusting your search terms or workload status filter."
          />
        </div>
      ) : viewMode === 'table' ? (
        <div className="sl-card sl-table-wrap">
          <div style={{ overflowX: 'auto', width: '100%' }}>
            <table className="sl-table custom-table" style={{ width: '100%', minWidth: '840px', borderCollapse: 'collapse', fontSize: '13px', textAlign: 'left' }}>
              <thead>
                <tr style={{ color: '#475569', borderBottom: '1px solid #E2E8F0', backgroundColor: '#F8FAFC', fontSize: '12px', fontWeight: 'bold', height: '46px' }}>
                  <th style={{ padding: '12px 16px', fontWeight: 'bold' }}>Representative</th>
                  <th style={{ padding: '12px 14px', fontWeight: 'bold' }}>Workload & Allocation</th>
                  <th style={{ padding: '12px 14px', fontWeight: 'bold' }}>Managed Pipeline</th>
                  <th style={{ padding: '12px 14px', fontWeight: 'bold' }}>SLA & Follow-ups</th>
                  <th style={{ padding: '12px 16px', fontWeight: 'bold' }}>Closed Won</th>
                </tr>
              </thead>
              <tbody>
                {filteredMembers.map(m => {
                  const isHigh = m.active_leads > 15;
                  const isBalanced = m.active_leads >= 5 && m.active_leads <= 15;
                  const capacityPercent = Math.min(100, Math.round((m.active_leads / 15) * 100));

                  const statusBg = isHigh ? '#FEF2F2' : (isBalanced ? '#ECFEFF' : '#EFF6FF');
                  const statusFg = isHigh ? '#DC2626' : (isBalanced ? '#0E7490' : '#2563EB');
                  const statusBorder = isHigh ? '#FECACA' : (isBalanced ? '#A5F3FC' : '#BFDBFE');
                  const statusLabel = isHigh ? 'Overloaded' : (isBalanced ? 'Balanced' : 'Available');

                  return (
                    <tr
                      key={m.user_id}
                      onClick={() => setSelectedRep(m)}
                      style={{
                        borderBottom: '1px solid #F1F5F9',
                        cursor: 'pointer',
                        transition: 'background-color 0.15s ease'
                      }}
                      onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#F8FAFC'; }}
                      onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; }}
                      title={`Click to view all leads assigned to ${m.name}`}
                    >
                      {/* Representative */}
                      <td style={{ padding: '14px 16px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <div style={{
                            width: '36px',
                            height: '36px',
                            borderRadius: '8px',
                            backgroundColor: '#0E7490',
                            color: '#FFFFFF',
                            fontSize: '14px',
                            fontWeight: '800',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            flexShrink: 0
                          }}>
                            {m.name ? m.name.charAt(0).toUpperCase() : 'S'}
                          </div>
                          <div>
                            <div style={{ fontWeight: '700', color: '#0F172A', fontSize: '13.5px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                              <span>{m.name}</span>
                              <ChevronRight size={13} color="#94A3B8" />
                            </div>
                            <div style={{ fontSize: '11px', color: '#64748B', marginTop: '1px' }}>
                              {m.role || 'Sales Executive'} · ID: <span style={{ color: '#0E7490', fontWeight: '600' }}>{m.user_id}</span>
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Workload Status & Progress Bar */}
                      <td style={{ padding: '14px 14px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                          <span style={{
                            display: 'inline-block',
                            padding: '2px 8px',
                            borderRadius: '12px',
                            fontSize: '11px',
                            fontWeight: '700',
                            backgroundColor: statusBg,
                            color: statusFg,
                            border: `1px solid ${statusBorder}`
                          }}>
                            {statusLabel} ({m.active_leads} leads)
                          </span>
                        </div>
                        {/* Capacity meter (0 to 15 optimal capacity) */}
                        <div style={{
                          width: '140px',
                          height: '6px',
                          borderRadius: '4px',
                          backgroundColor: '#E2E8F0',
                          overflow: 'hidden'
                        }}>
                          <div style={{
                            width: `${capacityPercent}%`,
                            height: '100%',
                            backgroundColor: statusFg,
                            borderRadius: '4px'
                          }} />
                        </div>
                      </td>

                      {/* Managed Pipeline Value */}
                      <td style={{ padding: '14px 14px' }}>
                        <div style={{ fontWeight: '800', color: '#0F172A', fontSize: '13.5px' }}>
                          {formatINR(m.pipeline_value)}
                        </div>
                        <div style={{ fontSize: '11px', color: '#64748B', marginTop: '2px' }}>
                          {m.active_leads} deals active
                        </div>
                      </td>

                      {/* SLA & Follow-ups */}
                      <td style={{ padding: '14px 14px' }}>
                        <div>
                          {m.overdue_followups > 0 ? (
                            <span style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px',
                              color: '#DC2626',
                              backgroundColor: '#FEF2F2',
                              border: '1px solid #FECACA',
                              padding: '2px 8px',
                              borderRadius: '6px',
                              fontSize: '11px',
                              fontWeight: '700'
                            }}>
                              <AlertTriangle size={12} /> {m.overdue_followups} Overdue
                            </span>
                          ) : (
                            <span style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px',
                              color: '#059669',
                              backgroundColor: '#ECFDF5',
                              border: '1px solid #A7F3D0',
                              padding: '2px 8px',
                              borderRadius: '6px',
                              fontSize: '11px',
                              fontWeight: '600'
                            }}>
                              <CheckCircle2 size={12} /> SLA On Track
                            </span>
                          )}
                          <div style={{ fontSize: '11px', color: '#64748B', marginTop: '3px' }}>
                            {m.today_followups > 0 ? `${m.today_followups} scheduled today` : 'No touches today'}
                          </div>
                        </div>
                      </td>

                      {/* Closed Won Performance */}
                      <td style={{ padding: '14px 16px' }}>
                        <div style={{ fontWeight: '700', color: '#059669', fontSize: '13px' }}>
                          {m.won_leads} Won <span style={{ fontSize: '11px', color: '#64748B', fontWeight: '500' }}>({m.win_rate}% Win)</span>
                        </div>
                        <div style={{ fontSize: '11px', color: '#64748B', marginTop: '2px' }}>
                          Revenue: {formatINR(m.won_value)}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '16px' }}>
          {filteredMembers.map(member => {
            const isHigh = member.active_leads > 15;
            const isBalanced = member.active_leads >= 5 && member.active_leads <= 15;
            const workloadColor = isHigh ? '#DC2626' : (isBalanced ? '#0E7490' : '#2563EB');
            const workloadBg = isHigh ? '#FEF2F2' : (isBalanced ? '#ECFEFF' : '#EFF6FF');
            const workloadBorder = isHigh ? '#FECACA' : (isBalanced ? '#A5F3FC' : '#BFDBFE');
            const workloadText = isHigh ? 'Overloaded' : (isBalanced ? 'Balanced' : 'Available');

            return (
              <div
                key={member.user_id}
                onClick={() => setSelectedRep(member)}
                style={{
                  background: '#FFFFFF',
                  borderRadius: '12px',
                  border: '1px solid #E2E8F0',
                  padding: '18px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '12px',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.02)',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = '#0E7490';
                  e.currentTarget.style.boxShadow = '0 4px 12px rgba(14,116,144,0.08)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = '#E2E8F0';
                  e.currentTarget.style.boxShadow = '0 1px 3px rgba(0,0,0,0.02)';
                }}
              >
                {/* Header */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div style={{
                      width: '38px',
                      height: '38px',
                      borderRadius: '8px',
                      background: '#0E7490',
                      color: '#FFFFFF',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontWeight: '800',
                      fontSize: '15px'
                    }}>
                      {member.name ? member.name.charAt(0).toUpperCase() : 'S'}
                    </div>
                    <div>
                      <div style={{ fontWeight: '700', fontSize: '14px', color: '#0F172A' }}>{member.name}</div>
                      <div style={{ fontSize: '11px', color: '#64748B' }}>{member.role || 'Sales'} · {member.user_id}</div>
                    </div>
                  </div>
                  <span style={{
                    padding: '2px 8px',
                    borderRadius: '12px',
                    fontSize: '11px',
                    fontWeight: '700',
                    background: workloadBg,
                    color: workloadColor,
                    border: `1px solid ${workloadBorder}`
                  }}>
                    {workloadText}
                  </span>
                </div>

                {/* Metrics Grid */}
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 1fr',
                  gap: '8px',
                  background: '#F8FAFC',
                  padding: '12px',
                  borderRadius: '8px',
                  border: '1px solid #F1F5F9'
                }}>
                  <div>
                    <div style={{ fontSize: '11px', color: '#64748B' }}>Active Deals</div>
                    <div style={{ fontSize: '16px', fontWeight: '800', color: '#0F172A' }}>{member.active_leads}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: '11px', color: '#64748B' }}>Pipeline Value</div>
                    <div style={{ fontSize: '14px', fontWeight: '700', color: '#0E7490' }}>{formatINR(member.pipeline_value)}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: '11px', color: '#64748B' }}>Won Deals</div>
                    <div style={{ fontSize: '13px', fontWeight: '700', color: '#059669' }}>
                      {member.won_leads} <span style={{ fontSize: '11px', color: '#64748B' }}>({member.win_rate}%)</span>
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: '11px', color: '#64748B' }}>Overdue Touches</div>
                    <div style={{ fontSize: '13px', fontWeight: '700', color: member.overdue_followups > 0 ? '#DC2626' : '#059669' }}>
                      {member.overdue_followups > 0 ? `${member.overdue_followups} Overdue` : 'On Track'}
                    </div>
                  </div>
                </div>

                {/* Footer Action */}
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px',
                  padding: '8px 12px',
                  borderRadius: '8px',
                  backgroundColor: '#ECFEFF',
                  color: '#0E7490',
                  fontSize: '12px',
                  fontWeight: '700',
                  marginTop: 'auto'
                }}>
                  <span>View All Assigned Deals</span>
                  <ChevronRight size={14} />
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* 5. Representative Assigned Leads Popup Modal */}
      {selectedRep && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(15, 23, 42, 0.45)',
            backdropFilter: 'blur(3px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 10050,
            padding: '16px'
          }}
          onClick={() => setSelectedRep(null)}
        >
          <div
            style={{
              backgroundColor: '#FFFFFF',
              borderRadius: '16px',
              width: '100%',
              maxWidth: '860px',
              maxHeight: 'calc(100vh - 48px)',
              display: 'flex',
              flexDirection: 'column',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
              border: '1px solid #E2E8F0',
              overflow: 'hidden'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Head */}
            <div style={{
              padding: '16px 20px',
              borderBottom: '1px solid #E2E8F0',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              backgroundColor: '#FFFFFF'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{
                  width: '42px',
                  height: '42px',
                  borderRadius: '10px',
                  backgroundColor: '#0E7490',
                  color: '#FFFFFF',
                  fontSize: '16px',
                  fontWeight: '800',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0
                }}>
                  {selectedRep.name ? selectedRep.name.charAt(0).toUpperCase() : 'S'}
                </div>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                    <h3 style={{ margin: 0, fontSize: '16px', fontWeight: '800', color: '#0F172A' }}>
                      {selectedRep.name}
                    </h3>
                    <span style={{
                      fontSize: '11px',
                      fontWeight: '700',
                      padding: '2px 8px',
                      borderRadius: '12px',
                      backgroundColor: '#ECFEFF',
                      color: '#0E7490',
                      border: '1px solid #A5F3FC'
                    }}>
                      {selectedRep.active_leads} Active Deals
                    </span>
                    <span style={{
                      fontSize: '11px',
                      fontWeight: '700',
                      padding: '2px 8px',
                      borderRadius: '12px',
                      backgroundColor: '#F8FAFC',
                      color: '#334155',
                      border: '1px solid #E2E8F0'
                    }}>
                      Pipeline: {formatINR(selectedRep.pipeline_value)}
                    </span>
                  </div>
                  <div style={{ fontSize: '12px', color: '#64748B', marginTop: '2px' }}>
                    {selectedRep.role || 'Sales Representative'} · User ID: <span style={{ color: '#0E7490', fontWeight: '600' }}>{selectedRep.user_id}</span>
                  </div>
                </div>
              </div>

              <button
                onClick={() => setSelectedRep(null)}
                aria-label="Close"
                style={{
                  background: '#F1F5F9',
                  border: 'none',
                  borderRadius: '50%',
                  width: '32px',
                  height: '32px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#64748B',
                  cursor: 'pointer'
                }}
              >
                <X size={16} />
              </button>
            </div>

            {/* Filter inside modal */}
            <div style={{
              padding: '10px 20px',
              backgroundColor: '#FAFBFC',
              borderBottom: '1px solid #E2E8F0',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '12px',
              flexWrap: 'wrap'
            }}>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                border: '1px solid #CBD5E1',
                borderRadius: '8px',
                padding: '0 10px',
                height: '34px',
                backgroundColor: '#FFFFFF',
                flex: '1 1 260px',
                maxWidth: '380px'
              }}>
                <Search size={14} color="#94A3B8" />
                <input
                  type="text"
                  placeholder="Search leads in this rep's pipeline..."
                  value={repLeadSearch}
                  onChange={(e) => setRepLeadSearch(e.target.value)}
                  style={{ border: 'none', outline: 'none', fontSize: '12px', width: '100%', color: '#334155' }}
                />
                {repLeadSearch && (
                  <X size={13} color="#94A3B8" style={{ cursor: 'pointer' }} onClick={() => setRepLeadSearch('')} />
                )}
              </div>
              <div style={{ fontSize: '12px', color: '#64748B' }}>
                Click any lead row to open full lead profile
              </div>
            </div>

            {/* Leads List Body */}
            <div style={{ padding: '0', overflowY: 'auto', flex: 1, maxHeight: '55vh' }}>
              {loadingRepLeads ? (
                <div style={{ padding: '16px' }}><SkeletonRows rows={5} /></div>
              ) : filteredRepLeads.length === 0 ? (
                <div style={{ padding: '36px 16px' }}>
                  <EmptyState
                    title={repLeadSearch ? 'No matching leads' : 'No active leads'}
                    text={repLeadSearch ? `No leads found matching "${repLeadSearch}".` : `${selectedRep.name} currently has no active pipeline leads.`}
                  />
                </div>
              ) : (
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12.5px', textAlign: 'left' }}>
                  <thead>
                    <tr style={{ color: '#475569', borderBottom: '1px solid #E2E8F0', backgroundColor: '#F8FAFC', fontSize: '11px', fontWeight: 'bold' }}>
                      <th style={{ padding: '10px 16px' }}>Lead / Company</th>
                      <th style={{ padding: '10px 12px' }}>Contact</th>
                      <th style={{ padding: '10px 12px' }}>Stage</th>
                      <th style={{ padding: '10px 12px' }}>Deal Value</th>
                      <th style={{ padding: '10px 12px' }}>Next Action</th>
                      <th style={{ padding: '10px 16px', textAlign: 'right' }}>Open</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredRepLeads.map(lead => {
                      const overdue = lead.next_action_due_at && isOverdue(lead.next_action_due_at);
                      return (
                        <tr
                          key={lead.id}
                          onClick={() => {
                            if (onOpenLead) onOpenLead(lead.id);
                            setSelectedRep(null);
                          }}
                          style={{
                            borderBottom: '1px solid #F1F5F9',
                            cursor: 'pointer',
                            transition: 'background-color 0.15s ease'
                          }}
                          onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#F8FAFC'; }}
                          onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; }}
                        >
                          <td style={{ padding: '12px 16px' }}>
                            <div style={{ fontWeight: '700', color: '#0F172A' }}>
                              {lead.company_name || 'Individual Lead'}
                            </div>
                            <div style={{ fontSize: '11px', color: '#64748B', display: 'flex', alignItems: 'center', gap: '6px', marginTop: '2px' }}>
                              <span style={{ color: '#0E7490', fontWeight: '600' }}>{lead.lead_number}</span>
                              {lead.source && <span>• {lead.source}</span>}
                            </div>
                          </td>

                          <td style={{ padding: '12px 12px' }}>
                            <div style={{ color: '#334155', fontWeight: '500' }}>
                              {lead.contact_person || '—'}
                            </div>
                            {lead.phone && (
                              <div style={{ fontSize: '11px', color: '#64748B', marginTop: '2px' }}>
                                {lead.phone}
                              </div>
                            )}
                          </td>

                          <td style={{ padding: '12px 12px' }}>
                            <StageBadge stage={lead.pipeline_stage} />
                          </td>

                          <td style={{ padding: '12px 12px' }}>
                            <strong style={{ color: '#0F172A' }}>
                              {lead.estimated_value ? formatINR(lead.estimated_value) : '—'}
                            </strong>
                          </td>

                          <td style={{ padding: '12px 12px' }}>
                            {lead.next_action_due_at ? (
                              overdue ? (
                                <span style={{ color: '#DC2626', fontWeight: '700', fontSize: '11px', display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
                                  <AlertTriangle size={11} /> Overdue ({formatDate(lead.next_action_due_at)})
                                </span>
                              ) : (
                                <span style={{ color: '#059669', fontSize: '11px', display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
                                  <Clock size={11} /> Due {formatDate(lead.next_action_due_at)}
                                </span>
                              )
                            ) : (
                              <span style={{ color: '#94A3B8', fontSize: '11px' }}>No action scheduled</span>
                            )}
                          </td>

                          <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                            <span style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px',
                              padding: '4px 10px',
                              borderRadius: '6px',
                              border: '1px solid #CBD5E1',
                              backgroundColor: '#FFFFFF',
                              color: '#0E7490',
                              fontSize: '11.5px',
                              fontWeight: '700'
                            }}>
                              View <ChevronRight size={12} />
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>

            {/* Modal Foot */}
            <div style={{
              padding: '12px 20px',
              borderTop: '1px solid #E2E8F0',
              backgroundColor: '#F8FAFC',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between'
            }}>
              <div style={{ fontSize: '12px', color: '#64748B' }}>
                Showing <strong>{filteredRepLeads.length}</strong> of <strong>{repLeads.length}</strong> assigned leads
              </div>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  type="button"
                  onClick={() => {
                    setFromUser(selectedRep.user_id);
                    setToUser('');
                    setSelectedRep(null);
                    setReassignModal(true);
                  }}
                  style={{
                    padding: '7px 14px',
                    borderRadius: '8px',
                    border: '1px solid #0E7490',
                    background: '#ECFEFF',
                    color: '#0E7490',
                    fontSize: '12px',
                    fontWeight: '700',
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px'
                  }}
                >
                  <ArrowRightLeft size={13} /> Reassign Deals
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedRep(null)}
                  style={{
                    padding: '7px 16px',
                    borderRadius: '8px',
                    border: '1px solid #CBD5E1',
                    background: '#FFFFFF',
                    color: '#475569',
                    fontSize: '12px',
                    fontWeight: '600',
                    cursor: 'pointer'
                  }}
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 6. Clarified Reassign Modal */}
      {reassignModal && (
        <div style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(15, 23, 42, 0.65)',
          backdropFilter: 'blur(3px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 10050,
          padding: '16px'
        }}
        onClick={(e) => {
          if (e.target === e.currentTarget && !reassigning) setReassignModal(false);
        }}>
          <div style={{
            background: '#FFFFFF',
            borderRadius: '16px',
            maxWidth: '480px',
            width: '100%',
            boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden'
          }}>
            {/* Modal Head */}
            <div style={{
              padding: '16px 20px',
              borderBottom: '1px solid #E2E8F0',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              background: '#FFFFFF'
            }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '16px', fontWeight: '800', color: '#0F172A' }}>
                  Redistribute Active Leads
                </h3>
                <p style={{ margin: '2px 0 0', fontSize: '12px', color: '#64748B' }}>
                  Reassign open pipeline deals and upcoming follow-ups
                </p>
              </div>
              <button
                onClick={() => setReassignModal(false)}
                disabled={reassigning}
                style={{
                  background: '#F1F5F9', border: 'none', borderRadius: '50%',
                  width: '32px', height: '32px', display: 'flex', alignItems: 'center',
                  justifyContent: 'center', color: '#64748B', cursor: 'pointer'
                }}
              >
                <X size={16} />
              </button>
            </div>

            {/* Modal Body */}
            <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{
                backgroundColor: '#ECFEFF',
                border: '1px solid #A5F3FC',
                borderRadius: '8px',
                padding: '10px 12px',
                fontSize: '12px',
                color: '#0E7490',
                display: 'flex',
                gap: '8px',
                alignItems: 'flex-start'
              }}>
                <Info size={16} style={{ flexShrink: 0, marginTop: '1px' }} />
                <span>
                  Only <strong>active, unclosed deals</strong> and their <strong>pending follow-ups</strong> are transferred. Closed Won / Closed Lost deals permanently remain credited to the original representative.
                </span>
              </div>

              <div>
                <label style={{ fontSize: '12px', fontWeight: '700', color: '#334155', display: 'block', marginBottom: '6px' }}>
                  Transfer Leads From (Source Rep) *
                </label>
                <select
                  value={fromUser}
                  onChange={(e) => setFromUser(e.target.value)}
                  style={{ width: '100%', height: '38px', padding: '0 10px', borderRadius: '8px', border: '1px solid #CBD5E1', fontSize: '13px' }}
                >
                  <option value="">Select source representative...</option>
                  {members.map(m => (
                    <option key={m.user_id} value={m.user_id}>
                      {m.name} ({m.active_leads} active deals · {formatINR(m.pipeline_value)})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label style={{ fontSize: '12px', fontWeight: '700', color: '#334155', display: 'block', marginBottom: '6px' }}>
                  Assign Leads To (Target Rep) *
                </label>
                <select
                  value={toUser}
                  onChange={(e) => setToUser(e.target.value)}
                  style={{ width: '100%', height: '38px', padding: '0 10px', borderRadius: '8px', border: '1px solid #CBD5E1', fontSize: '13px' }}
                >
                  <option value="">Select target representative...</option>
                  {members.filter(m => m.user_id !== fromUser).map(m => (
                    <option key={m.user_id} value={m.user_id}>
                      {m.name} (Currently has {m.active_leads} deals · {m.workload} load)
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Modal Foot */}
            <div style={{
              padding: '12px 20px',
              borderTop: '1px solid #E2E8F0',
              backgroundColor: '#F8FAFC',
              display: 'flex',
              justifyContent: 'flex-end',
              gap: '10px'
            }}>
              <button
                type="button"
                onClick={() => setReassignModal(false)}
                disabled={reassigning}
                style={{
                  padding: '8px 16px',
                  borderRadius: '8px',
                  border: '1px solid #CBD5E1',
                  background: '#FFFFFF',
                  fontSize: '13px',
                  fontWeight: '600',
                  color: '#475569',
                  cursor: 'pointer'
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleReassign}
                disabled={reassigning || !fromUser || !toUser}
                style={{
                  padding: '8px 18px',
                  borderRadius: '8px',
                  border: 'none',
                  background: '#0E7490',
                  color: '#FFFFFF',
                  fontSize: '13px',
                  fontWeight: '700',
                  cursor: reassigning || !fromUser || !toUser ? 'not-allowed' : 'pointer',
                  opacity: reassigning || !fromUser || !toUser ? 0.6 : 1
                }}
              >
                {reassigning ? 'Transferring...' : 'Confirm Transfer'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
