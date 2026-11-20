import React, { useEffect, useState } from 'react';
import {
  Users, TrendingUp, AlertTriangle, CheckCircle2, UserCheck,
  RefreshCw, ArrowRightLeft, CalendarClock, Briefcase, ChevronRight
} from 'lucide-react';
import { slApi, formatINR } from './smartLeadsApi';
import { SkeletonRows, BusinzKpiGrid, BusinzKpiCard } from './SlShared';

export default function TeamView({ meta, onNavigate, onOpenLead, toast }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [reassignModal, setReassignModal] = useState(false);
  const [fromUser, setFromUser] = useState('');
  const [toUser, setToUser] = useState('');
  const [reassigning, setReassigning] = useState(false);

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
        <SkeletonRows rows={6} />
      </div>
    );
  }

  const { members = [], totals = {} } = data;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '22px' }}>
      {/* Top Banner & Quick Controls */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h2 style={{ fontSize: '18px', fontWeight: '800', color: '#0F172A', margin: 0 }}>
            Sales Team Workload & Allocation
          </h2>
          <p style={{ fontSize: '13px', color: '#64748B', margin: '4px 0 0 0' }}>
            Monitor sales team capacity, active pipeline value, and redistribute workloads.
          </p>
        </div>
        <div style={{ display: 'flex', gap: '10px' }}>
          <button
            onClick={() => setReassignModal(true)}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: '8px',
              padding: '8px 16px', borderRadius: '8px', border: 'none',
              background: '#0E7490', color: '#FFFFFF', fontSize: '13px',
              fontWeight: '600', cursor: 'pointer', boxShadow: '0 1px 2px rgba(0,0,0,0.05)'
            }}
          >
            <ArrowRightLeft size={15} />
            Reassign Leads
          </button>
          <button
            onClick={load}
            title="Refresh Data"
            style={{
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              width: '36px', height: '36px', borderRadius: '8px', border: '1px solid #CBD5E1',
              background: '#FFFFFF', color: '#475569', cursor: 'pointer'
            }}
          >
            <RefreshCw size={15} />
          </button>
        </div>
      </div>

      {/* Signature BUSINZ Team KPI Cards */}
      <BusinzKpiGrid minWidth="220px">
        <BusinzKpiCard
          title="ACTIVE SALES STAFF"
          value={String(totals.teamCount || members.length)}
          valColor="#0E7490"
          icon={Users}
          iconColor="#0E7490"
          iconBg="#ECFEFF"
          trend="Active"
          trendNeutral={true}
          bottomPrefix="Sales roster capacity"
          bottomHighlight={`${totals.teamCount || members.length} Reps`}
          bottomHighlightColor="#0E7490"
        />

        <BusinzKpiCard
          title="OPEN LEADS ASSIGNED"
          value={String(totals.totalActiveLeads || 0)}
          valColor="#1E293B"
          icon={Briefcase}
          iconColor="#2563EB"
          iconBg="#EFF6FF"
          trend="In Pipeline"
          trendNeutral={true}
          bottomPrefix="Active workload"
          bottomHighlight={`${totals.totalActiveLeads || 0} Total Deals`}
          bottomHighlightColor="#2563EB"
        />

        <BusinzKpiCard
          title="MANAGED PIPELINE"
          value={formatINR(totals.totalPipelineValue || 0)}
          valColor="#16A34A"
          icon={TrendingUp}
          iconColor="#16A34A"
          iconBg="#F0FDF4"
          trend="Pipeline Value"
          trendUp={true}
          bottomPrefix="Managed opportunity value"
          bottomHighlight={formatINR(totals.totalPipelineValue || 0)}
          bottomHighlightColor="#16A34A"
        />

        <BusinzKpiCard
          title="OVERDUE SLA FOLLOW-UPS"
          value={String(totals.totalOverdueFollowups || 0)}
          valColor={totals.totalOverdueFollowups > 0 ? '#DC2626' : '#16A34A'}
          icon={AlertTriangle}
          iconColor={totals.totalOverdueFollowups > 0 ? '#DC2626' : '#16A34A'}
          iconBg={totals.totalOverdueFollowups > 0 ? '#FEF2F2' : '#F0FDF4'}
          trend={totals.totalOverdueFollowups > 0 ? 'Urgent SLA' : 'SLA Met'}
          trendUp={totals.totalOverdueFollowups === 0}
          trendNeutral={false}
          bottomPrefix="Pending client touches"
          bottomHighlight={`${totals.totalOverdueFollowups || 0} Overdue`}
          bottomHighlightColor={totals.totalOverdueFollowups > 0 ? '#DC2626' : '#16A34A'}
          highlightCard={totals.totalOverdueFollowups > 0}
        />
      </BusinzKpiGrid>

      {/* Team Roster Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '16px' }}>
        {members.map(member => {
          const workloadColor = member.workload === 'High' ? '#DC2626' : (member.workload === 'Balanced' ? '#0E7490' : '#64748B');
          const workloadBg = member.workload === 'High' ? '#FEF2F2' : (member.workload === 'Balanced' ? '#ECFEFF' : '#F1F5F9');

          return (
            <div
              key={member.user_id}
              style={{
                background: '#FFFFFF', borderRadius: '14px', border: '1px solid #E2E8F0',
                padding: '20px', display: 'flex', flexDirection: 'column', gap: '14px',
                boxShadow: '0 1px 3px rgba(0,0,0,0.03)'
              }}
            >
              {/* Member Header */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <div style={{
                    width: '42px', height: '42px', borderRadius: '10px',
                    background: '#0E7490', color: '#FFFFFF', display: 'flex',
                    alignItems: 'center', justifyContent: 'center', fontWeight: '800', fontSize: '16px'
                  }}>
                    {member.name ? member.name.charAt(0).toUpperCase() : 'U'}
                  </div>
                  <div>
                    <div style={{ fontWeight: '700', fontSize: '15px', color: '#0F172A' }}>{member.name}</div>
                    <div style={{ fontSize: '12px', color: '#64748B' }}>{member.role || 'Sales'} · {member.user_id}</div>
                  </div>
                </div>
                <span style={{
                  padding: '3px 8px', borderRadius: '12px', fontSize: '11px', fontWeight: '700',
                  background: workloadBg, color: workloadColor
                }}>
                  {member.workload} Load
                </span>
              </div>

              {/* Metrics Row */}
              <div style={{
                display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px',
                background: '#F8FAFC', padding: '12px', borderRadius: '10px'
              }}>
                <div>
                  <div style={{ fontSize: '11px', color: '#64748B' }}>Active Leads</div>
                  <div style={{ fontSize: '17px', fontWeight: '800', color: '#0F172A' }}>{member.active_leads}</div>
                </div>
                <div>
                  <div style={{ fontSize: '11px', color: '#64748B' }}>Pipeline Value</div>
                  <div style={{ fontSize: '15px', fontWeight: '700', color: '#0E7490' }}>{formatINR(member.pipeline_value)}</div>
                </div>
                <div>
                  <div style={{ fontSize: '11px', color: '#64748B' }}>Won Deals</div>
                  <div style={{ fontSize: '14px', fontWeight: '700', color: '#16A34A' }}>
                    {member.won_leads} <span style={{ fontSize: '11px', color: '#64748B' }}>({member.win_rate}%)</span>
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: '11px', color: '#64748B' }}>Overdue Touches</div>
                  <div style={{ fontSize: '14px', fontWeight: '700', color: member.overdue_followups > 0 ? '#DC2626' : '#16A34A' }}>
                    {member.overdue_followups} overdue
                  </div>
                </div>
              </div>

              {/* Bottom Actions */}
              <div style={{ display: 'flex', gap: '8px', marginTop: 'auto', paddingTop: '6px' }}>
                <button
                  onClick={() => onNavigate('leads')}
                  style={{
                    flex: 1, padding: '7px 12px', borderRadius: '6px',
                    border: '1px solid #CBD5E1', background: '#FFFFFF',
                    fontSize: '12px', fontWeight: '600', color: '#334155',
                    cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px'
                  }}
                >
                  View Pipeline <ChevronRight size={13} />
                </button>
                <button
                  onClick={() => {
                    setFromUser(member.user_id);
                    setReassignModal(true);
                  }}
                  style={{
                    padding: '7px 12px', borderRadius: '6px',
                    border: '1px solid #CBD5E1', background: '#F8FAFC',
                    fontSize: '12px', fontWeight: '600', color: '#0E7490',
                    cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px'
                  }}
                >
                  <ArrowRightLeft size={13} /> Reassign
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Reassign Modal */}
      {reassignModal && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(15, 23, 42, 0.4)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: '16px'
        }}>
          <div style={{
            background: '#FFFFFF', borderRadius: '16px', maxWidth: '440px', width: '100%',
            padding: '24px', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)', display: 'flex', flexDirection: 'column', gap: '18px'
          }}>
            <div>
              <h3 style={{ fontSize: '17px', fontWeight: '800', color: '#0F172A', margin: 0 }}>
                Bulk Reassign Active Leads
              </h3>
              <p style={{ fontSize: '13px', color: '#64748B', margin: '4px 0 0 0' }}>
                Transfer all active leads and pending follow-ups from one representative to another.
              </p>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div>
                <label style={{ fontSize: '12px', fontWeight: '700', color: '#475569', display: 'block', marginBottom: '4px' }}>
                  Transfer From
                </label>
                <select
                  value={fromUser}
                  onChange={(e) => setFromUser(e.target.value)}
                  style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', border: '1px solid #CBD5E1', fontSize: '13px' }}
                >
                  <option value="">Select source representative...</option>
                  {members.map(m => (
                    <option key={m.user_id} value={m.user_id}>
                      {m.name} ({m.active_leads} active leads)
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label style={{ fontSize: '12px', fontWeight: '700', color: '#475569', display: 'block', marginBottom: '4px' }}>
                  Transfer To
                </label>
                <select
                  value={toUser}
                  onChange={(e) => setToUser(e.target.value)}
                  style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', border: '1px solid #CBD5E1', fontSize: '13px' }}
                >
                  <option value="">Select target representative...</option>
                  {members.filter(m => m.user_id !== fromUser).map(m => (
                    <option key={m.user_id} value={m.user_id}>
                      {m.name} ({m.active_leads} leads currently)
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button
                onClick={() => setReassignModal(false)}
                disabled={reassigning}
                style={{
                  padding: '9px 16px', borderRadius: '8px', border: '1px solid #CBD5E1',
                  background: '#FFFFFF', fontSize: '13px', fontWeight: '600', color: '#475569', cursor: 'pointer'
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleReassign}
                disabled={reassigning || !fromUser || !toUser}
                style={{
                  padding: '9px 18px', borderRadius: '8px', border: 'none',
                  background: '#0E7490', color: '#FFFFFF', fontSize: '13px', fontWeight: '600',
                  cursor: reassigning ? 'not-allowed' : 'pointer', opacity: reassigning ? 0.7 : 1
                }}
              >
                {reassigning ? 'Reassigning...' : 'Confirm Transfer'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
