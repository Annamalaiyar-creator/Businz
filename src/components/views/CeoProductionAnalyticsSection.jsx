import React, { useMemo } from 'react';
import CeoKpiGrid from '../ceoDashboard/CeoKpiGrid';
import { triggerCeoDrilldown } from '../../utils/ceoDrilldownFilter';

const parseNum = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

const parseDateMs = (raw) => {
  if (!raw) return NaN;
  if (typeof raw === 'number' && Number.isFinite(raw)) return raw < 1e12 ? raw * 1000 : raw;
  const s = String(raw).trim();
  if (!s || s === '—' || s === '-') return NaN;
  const parsed = Date.parse(s);
  if (!Number.isNaN(parsed)) return parsed;
  const m = s.match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{2,4})/);
  if (m) {
    const day = Number(m[1]);
    const mon = Number(m[2]) - 1;
    const yr = Number(m[3]) < 100 ? 2000 + Number(m[3]) : Number(m[3]);
    return new Date(yr, mon, day).getTime();
  }
  return NaN;
};

const startOfDayMs = (ts) => {
  const d = new Date(ts);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
};

const BusinzSectionCard = ({ title, subtitle, bodyPadding = '0', children }) => (
  <div style={{
    backgroundColor: '#FFFFFF',
    border: '1px solid #EAEFEF',
    borderRadius: '14px',
    overflow: 'hidden',
    boxShadow: '0 1px 3px rgba(15, 23, 42, 0.03)'
  }}>
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px',
      padding: '11px 16px', backgroundColor: '#F8FAFC', borderBottom: '1px solid #EAEFEF'
    }}>
      <h3 style={{ margin: 0, fontSize: '13px', fontWeight: '800', color: '#0F172A', textTransform: 'uppercase', letterSpacing: '0.3px' }}>{title}</h3>
      {subtitle && (
        <span style={{ fontSize: '11px', fontWeight: '600', color: '#64748B' }}>{subtitle}</span>
      )}
    </div>
    <div style={{ padding: bodyPadding }}>{children}</div>
  </div>
);

const thStyle = {
  padding: '8px 10px',
  fontSize: '11px',
  fontWeight: '700',
  color: '#64748B',
  borderBottom: '1px solid #E2E8F0',
  backgroundColor: '#F8FAFC',
  whiteSpace: 'nowrap'
};

const tdStyle = {
  padding: '9px 10px',
  fontSize: '12px',
  borderBottom: '1px solid #F1F5F9',
  verticalAlign: 'middle'
};

export default function CeoProductionAnalyticsSection({
  workOrdersList = [],
  allWorkOrdersList = [],
  selectedPeriod = 'Today',
  onNavigateTab
}) {
  const analytics = useMemo(() => {
    const now = Date.now();
    const nowDate = new Date(now);
    const todayStart = startOfDayMs(now);
    const todayEnd = todayStart + 86400000 - 1;
    const monthStart = new Date(nowDate.getFullYear(), nowDate.getMonth(), 1).getTime();
    const prevMonthStart = new Date(nowDate.getFullYear(), nowDate.getMonth() - 1, 1).getTime();
    const prevMonthEnd = monthStart - 1;

    const todayLabel = nowDate.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }).toUpperCase();
    const monthShort = nowDate.toLocaleDateString('en-US', { month: 'short' }).toUpperCase();
    const curMonthLabel = nowDate.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
    const prevMonthLabel = new Date(nowDate.getFullYear(), nowDate.getMonth() - 1, 1).toLocaleDateString('en-US', { month: 'short', year: 'numeric' });

    const allWos = (allWorkOrdersList && allWorkOrdersList.length > 0 ? allWorkOrdersList : workOrdersList)
      .filter((w) => w && !w.cancelled && !String(w.status || '').toLowerCase().includes('cancel'));

    let dailyPlan = 0;
    let dailyActual = 0;
    let mtdPlan = 0;
    let mtdActual = 0;
    let completedCount = 0;
    let delayedCount = 0;
    let rejectedPcs = 0;

    let totalDowntimeHrs = 0;
    let breakdownHrs = 0;

    const profileMap = new Map();
    const operatorMap = new Map();
    const shiftMap = new Map([
      ['Shift 1 · 06:00–14:00', { shift: 'Shift 1 · 06:00–14:00', plan: 0, actual: 0 }],
      ['Shift 2 · 14:00–22:00', { shift: 'Shift 2 · 14:00–22:00', plan: 0, actual: 0 }]
    ]);
    const downtimeMap = new Map([
      ['Machine Breakdown', 0],
      ['Material Not Ready', 0],
      ['Tool Change / Setup', 0],
      ['Power Failure', 0],
      ['Other Reasons', 0]
    ]);

    let prevMonthActual = 0;

    allWos.forEach((wo) => {
      const st = String(wo.status || '').toLowerCase();
      const isDone = st.includes('complete') || st.includes('closed');
      const plan = parseNum(wo.plannedQty ?? wo.targetQty ?? wo.qty ?? wo.quantity ?? 0);
      const actual = parseNum(wo.completedQty ?? wo.producedQty ?? wo.actualQty ?? (isDone ? plan : 0));
      const rej = parseNum(wo.rejectedQty ?? wo.rejectQty ?? wo.scrapQty ?? 0);
      const dtHrs = parseNum(wo.downtimeHours ?? wo.downtimeHrs ?? wo.downtime ?? 0);

      const woDateMs = parseDateMs(wo.date || wo.scheduledDate || wo.createdAt || wo.created_at);
      const dueMs = parseDateMs(wo.dueDate || wo.targetDate || wo.expectedDate);
      const isToday = Number.isFinite(woDateMs) && woDateMs >= todayStart && woDateMs <= todayEnd;
      const isMtd = !Number.isFinite(woDateMs) || woDateMs >= monthStart;
      const isPrevMonth = Number.isFinite(woDateMs) && woDateMs >= prevMonthStart && woDateMs <= prevMonthEnd;

      if (isToday) {
        dailyPlan += plan;
        dailyActual += actual;
      }
      if (isPrevMonth) {
        prevMonthActual += actual;
      }
      if (isMtd) {
        mtdPlan += plan;
        mtdActual += actual;
        if (isDone) completedCount += 1;
        if (!isDone && Number.isFinite(dueMs) && startOfDayMs(dueMs) < todayStart) delayedCount += 1;
        rejectedPcs += rej;

        // Profile breakdown
        const profile = String(wo.productName || wo.profile || wo.itemName || wo.materialName || wo.subject || 'Other Profiles').trim();
        const pEntry = profileMap.get(profile) || { profile, dPlan: 0, dActual: 0, mPlan: 0, mActual: 0 };
        if (isToday) {
          pEntry.dPlan += plan;
          pEntry.dActual += actual;
        }
        pEntry.mPlan += plan;
        pEntry.mActual += actual;
        profileMap.set(profile, pEntry);

        // Operator breakdown
        const operator = String(wo.operatorName || wo.operator || wo.assignedToName || wo.assignedTo || 'Unassigned').trim();
        const machine = String(wo.machine || wo.process || wo.workCenter || wo.department || 'Production Line').trim();
        const opKey = `${operator}::${machine}`;
        const opEntry = operatorMap.get(opKey) || { operator, machine, plan: 0, actual: 0, downtime: 0 };
        opEntry.plan += plan;
        opEntry.actual += actual;
        opEntry.downtime += dtHrs;
        operatorMap.set(opKey, opEntry);

        // Shift breakdown
        const rawShift = String(wo.shift || '').toLowerCase();
        const shiftKey = rawShift.includes('2') || rawShift.includes('evening') || rawShift.includes('night')
          ? 'Shift 2 · 14:00–22:00'
          : 'Shift 1 · 06:00–14:00';
        const sEntry = shiftMap.get(shiftKey);
        sEntry.plan += plan;
        sEntry.actual += actual;

        // Downtime breakdown
        if (dtHrs > 0) {
          totalDowntimeHrs += dtHrs;
          const rStr = String(wo.downtimeReason || wo.delayReason || 'Other Reasons').toLowerCase();
          let reasonKey = 'Other Reasons';
          if (rStr.includes('break') || rStr.includes('machine')) {
            reasonKey = 'Machine Breakdown';
            breakdownHrs += dtHrs;
          } else if (rStr.includes('material') || rStr.includes('stock')) {
            reasonKey = 'Material Not Ready';
          } else if (rStr.includes('tool') || rStr.includes('setup')) {
            reasonKey = 'Tool Change / Setup';
          } else if (rStr.includes('power')) {
            reasonKey = 'Power Failure';
          }
          downtimeMap.set(reasonKey, (downtimeMap.get(reasonKey) || 0) + dtHrs);
        }
      }
    });

    const dailyPct = dailyPlan > 0 ? ((dailyActual / dailyPlan) * 100).toFixed(1) : '0.0';
    const mtdPct = mtdPlan > 0 ? ((mtdActual / mtdPlan) * 100).toFixed(1) : '0.0';
    const momGrowth = prevMonthActual > 0 ? (((mtdActual - prevMonthActual) / prevMonthActual) * 100).toFixed(1) : null;

    const profileRows = Array.from(profileMap.values())
      .map((p) => ({
        ...p,
        dAchv: p.dPlan > 0 ? `${((p.dActual / p.dPlan) * 100).toFixed(1)}%` : '—',
        mAchv: p.mPlan > 0 ? `${((p.mActual / p.mPlan) * 100).toFixed(1)}%` : '—',
        share: mtdActual > 0 ? `${((p.mActual / mtdActual) * 100).toFixed(1)}%` : '0.0%'
      }))
      .sort((a, b) => b.mPlan - a.mPlan)
      .slice(0, 8);

    const operatorRows = Array.from(operatorMap.values())
      .map((o) => ({
        ...o,
        eff: o.plan > 0 ? `${((o.actual / o.plan) * 100).toFixed(1)}%` : '—',
        gap: Math.max(0, o.plan - o.actual)
      }))
      .sort((a, b) => b.plan - a.plan)
      .slice(0, 8);

    const shiftRows = Array.from(shiftMap.values()).map((s) => ({
      ...s,
      achv: s.plan > 0 ? `${((s.actual / s.plan) * 100).toFixed(1)}%` : '—'
    }));

    const downtimeRows = Array.from(downtimeMap.entries()).map(([reason, hrs]) => ({
      reason,
      hrs,
      pct: totalDowntimeHrs > 0 ? ((hrs / totalDowntimeHrs) * 100).toFixed(1) : '0.0'
    }));

    return {
      todayLabel,
      monthShort,
      curMonthLabel,
      prevMonthLabel,
      totalWorkOrders: allWos.length,
      dailyPlan,
      dailyActual,
      dailyGap: Math.max(0, dailyPlan - dailyActual),
      dailyPct,
      mtdPlan,
      mtdActual,
      mtdGap: Math.max(0, mtdPlan - mtdActual),
      mtdPct,
      completedCount,
      delayedCount,
      rejectedPcs,
      totalDowntimeHrs,
      breakdownHrs,
      prevMonthActual,
      momGrowth,
      profileRows,
      operatorRows,
      shiftRows,
      downtimeRows,
      dailyWoKeys: allWos.filter(w => {
        const ms = parseDateMs(w.date || w.scheduledDate || w.createdAt || w.created_at);
        return Number.isFinite(ms) && ms >= todayStart && ms <= todayEnd;
      }).map(w => w.workOrderNo || w.id),
      mtdWoKeys: allWos.filter(w => {
        const ms = parseDateMs(w.date || w.scheduledDate || w.createdAt || w.created_at);
        return !Number.isFinite(ms) || ms >= monthStart;
      }).map(w => w.workOrderNo || w.id),
      downtimeWoKeys: allWos.filter(w => parseNum(w.downtimeHours ?? w.downtimeHrs ?? w.downtime ?? 0) > 0).map(w => w.workOrderNo || w.id)
    };
  }, [workOrdersList, allWorkOrdersList]);

  const drillToWorkOrders = (label, keys) => triggerCeoDrilldown({
    storageKey: 'controlroom_wo_initial_filter',
    eventName: 'controlroom_wo_filter',
    targetKeys: keys,
    periodLabel: label,
    sourceLabel: 'Production',
    navigateTab: 'Work Orders',
    onNavigateTab
  });

  const kpis = [
    {
      title: `DAILY · ${analytics.todayLabel.slice(0, 6)}`,
      value: `${analytics.dailyActual.toLocaleString('en-IN')} / ${analytics.dailyPlan.toLocaleString('en-IN')}`,
      valColor: '#0F172A',
      hideTrendIcon: true,
      bottomPrefix: 'Actual / Plan · ',
      bottomHighlight: `${analytics.dailyGap.toLocaleString('en-IN')} pcs short`,
      onClick: () => drillToWorkOrders('Daily Work Orders', analytics.dailyWoKeys)
    },
    {
      title: 'DAILY ACHIEVEMENT',
      value: `${analytics.dailyPct}%`,
      valColor: '#059669',
      hideTrendIcon: true,
      bottomPrefix: 'Of daily plan',
      bottomHighlight: '',
      onClick: () => drillToWorkOrders('Daily Achievement', analytics.dailyWoKeys)
    },
    {
      title: 'MONTH TO DATE',
      value: `${analytics.mtdActual.toLocaleString('en-IN')} / ${analytics.mtdPlan.toLocaleString('en-IN')}`,
      valColor: '#0F172A',
      hideTrendIcon: true,
      bottomPrefix: 'Actual / Plan · ',
      bottomHighlight: `${analytics.mtdGap.toLocaleString('en-IN')} pcs short`,
      onClick: () => drillToWorkOrders('MTD Work Orders', analytics.mtdWoKeys)
    },
    {
      title: 'MTD ACHIEVEMENT',
      value: `${analytics.mtdPct}%`,
      valColor: '#059669',
      hideTrendIcon: true,
      bottomPrefix: 'Of month-to-date plan',
      bottomHighlight: '',
      onClick: () => drillToWorkOrders('MTD Achievement', analytics.mtdWoKeys)
    },
    {
      title: 'MTD DOWNTIME',
      value: `${analytics.totalDowntimeHrs.toFixed(1)} hrs`,
      valColor: analytics.totalDowntimeHrs > 0 ? '#B45309' : '#0F172A',
      hideTrendIcon: true,
      bottomPrefix: 'Breakdown ',
      bottomHighlight: `${analytics.breakdownHrs.toFixed(1)} hrs`,
      onClick: () => drillToWorkOrders('MTD Downtime Work Orders', analytics.downtimeWoKeys)
    }
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
      <style>{`
        .ceo-prod-main-grid {
          display: grid;
          grid-template-columns: minmax(0, 1.55fr) minmax(0, 1fr);
          gap: 14px;
          align-items: start;
        }
        @media (max-width: 1120px) {
          .ceo-prod-main-grid {
            grid-template-columns: minmax(0, 1fr);
          }
        }
      `}</style>

      {/* Top Snapshot Bar */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '14px',
        padding: '10px 16px', backgroundColor: '#FFFFFF', border: '1px solid #EAEFEF', borderRadius: '12px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '11.5px', fontWeight: '800', color: '#0F172A', textTransform: 'uppercase' }}>CRM Production Snapshot</span>
          <span style={{ fontSize: '10.5px', fontWeight: '700', color: '#0E7490', backgroundColor: '#ECFEFF', border: '1px solid #A5F3FC', padding: '2px 8px', borderRadius: '999px' }}>
            {analytics.todayLabel}
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '20px' }}>
          {[
            { label: 'Daily plan', val: `${analytics.dailyPlan} pcs` },
            { label: 'Daily actual', val: `${analytics.dailyActual} pcs` },
            { label: 'Work orders', val: analytics.totalWorkOrders },
            { label: 'Completed', val: analytics.completedCount },
            { label: 'Delayed', val: analytics.delayedCount },
            { label: 'Rejected', val: `${analytics.rejectedPcs} pcs` }
          ].map((s) => (
            <div key={s.label} style={{ display: 'flex', flexDirection: 'column' }}>
              <span style={{ fontSize: '10.5px', color: '#64748B', fontWeight: '600' }}>{s.label}</span>
              <strong style={{ fontSize: '13px', color: '#0F172A' }}>{s.val}</strong>
            </div>
          ))}
        </div>
      </div>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px' }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: '10px' }}>
          <h2 style={{ margin: 0, fontSize: '17px', fontWeight: '800', color: '#0F172A' }}>Production Dashboard</h2>
          <span style={{ fontSize: '11px', fontWeight: '700', color: '#0E7490', textTransform: 'uppercase' }}>Period: {selectedPeriod}</span>
        </div>
        <span style={{ fontSize: '11.5px', color: '#64748B' }}>Daily and month-to-date view</span>
      </div>

      {/* 5 KPI Cards */}
      <CeoKpiGrid kpis={kpis} />

      {/* Main 2-Column Layout */}
      <div className="ceo-prod-main-grid">
        {/* Left Column */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', minWidth: 0 }}>
          {/* Production by Profile */}
          <BusinzSectionCard title="Production by Profile" subtitle="Actual includes rejects · units in pcs">
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontVariantNumeric: 'tabular-nums' }}>
                <thead>
                  <tr>
                    <th rowSpan={2} style={{ ...thStyle, textAlign: 'left', paddingLeft: '14px' }}>Product / Profile</th>
                    <th colSpan={3} style={{ ...thStyle, textAlign: 'center', borderBottom: '1px solid #F1F5F9', color: '#0E7490' }}>DAILY · {analytics.todayLabel.slice(0, 6)}</th>
                    <th colSpan={4} style={{ ...thStyle, textAlign: 'center', borderBottom: '1px solid #F1F5F9', color: '#0E7490', paddingRight: '14px' }}>MONTH TO DATE · {analytics.monthShort}</th>
                  </tr>
                  <tr>
                    <th style={{ ...thStyle, textAlign: 'right' }}>Plan</th>
                    <th style={{ ...thStyle, textAlign: 'right' }}>Actual</th>
                    <th style={{ ...thStyle, textAlign: 'right' }}>Achv.</th>
                    <th style={{ ...thStyle, textAlign: 'right' }}>Plan</th>
                    <th style={{ ...thStyle, textAlign: 'right' }}>Actual</th>
                    <th style={{ ...thStyle, textAlign: 'right' }}>Achv.</th>
                    <th style={{ ...thStyle, textAlign: 'right', paddingRight: '14px' }}>Output share</th>
                  </tr>
                </thead>
                <tbody>
                  {analytics.profileRows.length === 0 ? (
                    <tr><td colSpan={8} style={{ padding: '20px', textAlign: 'center', color: '#94A3B8', fontSize: '12px' }}>No work orders recorded for this period.</td></tr>
                  ) : (
                    <>
                      {analytics.profileRows.map((row) => (
                        <tr key={row.profile}>
                          <td style={{ ...tdStyle, paddingLeft: '14px', fontWeight: '700', color: '#0F172A' }}>{row.profile}</td>
                          <td style={{ ...tdStyle, textAlign: 'right', color: '#64748B' }}>{row.dPlan > 0 ? row.dPlan.toLocaleString('en-IN') : '—'}</td>
                          <td style={{ ...tdStyle, textAlign: 'right', color: '#0F172A' }}>{row.dActual > 0 ? row.dActual.toLocaleString('en-IN') : '—'}</td>
                          <td style={{ ...tdStyle, textAlign: 'right', color: '#059669', fontWeight: '700' }}>{row.dAchv}</td>
                          <td style={{ ...tdStyle, textAlign: 'right', color: '#475569' }}>{row.mPlan.toLocaleString('en-IN')}</td>
                          <td style={{ ...tdStyle, textAlign: 'right', color: '#0F172A', fontWeight: '600' }}>{row.mActual.toLocaleString('en-IN')}</td>
                          <td style={{ ...tdStyle, textAlign: 'right', color: '#059669', fontWeight: '700' }}>{row.mAchv}</td>
                          <td style={{ ...tdStyle, paddingRight: '14px', textAlign: 'right', color: '#475569' }}>{row.share}</td>
                        </tr>
                      ))}
                      <tr style={{ backgroundColor: '#F8FAFC', fontWeight: '800', color: '#0F172A' }}>
                        <td style={{ ...tdStyle, paddingLeft: '14px', borderBottom: 'none' }}>Total</td>
                        <td style={{ ...tdStyle, textAlign: 'right', borderBottom: 'none' }}>{analytics.dailyPlan.toLocaleString('en-IN')}</td>
                        <td style={{ ...tdStyle, textAlign: 'right', borderBottom: 'none' }}>{analytics.dailyActual.toLocaleString('en-IN')}</td>
                        <td style={{ ...tdStyle, textAlign: 'right', color: '#059669', borderBottom: 'none' }}>{analytics.dailyPct}%</td>
                        <td style={{ ...tdStyle, textAlign: 'right', borderBottom: 'none' }}>{analytics.mtdPlan.toLocaleString('en-IN')}</td>
                        <td style={{ ...tdStyle, textAlign: 'right', borderBottom: 'none' }}>{analytics.mtdActual.toLocaleString('en-IN')}</td>
                        <td style={{ ...tdStyle, textAlign: 'right', color: '#059669', borderBottom: 'none' }}>{analytics.mtdPct}%</td>
                        <td style={{ ...tdStyle, paddingRight: '14px', textAlign: 'right', borderBottom: 'none' }}>100.0%</td>
                      </tr>
                    </>
                  )}
                </tbody>
              </table>
            </div>
            <div style={{ padding: '8px 14px', fontSize: '11px', color: '#64748B', backgroundColor: '#F8FAFC', borderTop: '1px solid #F1F5F9' }}>
              Output share = profile actual ÷ total MTD actual.
            </div>
          </BusinzSectionCard>

          {/* Operator Performance */}
          <BusinzSectionCard title="Operator Performance" subtitle="Month to date · operators">
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontVariantNumeric: 'tabular-nums' }}>
                <thead>
                  <tr>
                    <th style={{ ...thStyle, textAlign: 'left', paddingLeft: '14px' }}>Operator</th>
                    <th style={{ ...thStyle, textAlign: 'left' }}>Process / Machine</th>
                    <th style={{ ...thStyle, textAlign: 'right' }}>Plan (pcs)</th>
                    <th style={{ ...thStyle, textAlign: 'right' }}>Actual (pcs)</th>
                    <th style={{ ...thStyle, textAlign: 'right' }}>Efficiency</th>
                    <th style={{ ...thStyle, textAlign: 'right' }}>Gap (pcs)</th>
                    <th style={{ ...thStyle, textAlign: 'right', paddingRight: '14px' }}>Downtime (hrs)</th>
                  </tr>
                </thead>
                <tbody>
                  {analytics.operatorRows.length === 0 ? (
                    <tr><td colSpan={7} style={{ padding: '20px', textAlign: 'center', color: '#94A3B8', fontSize: '12px' }}>No operator logs recorded yet.</td></tr>
                  ) : analytics.operatorRows.map((o) => (
                    <tr key={`${o.operator}-${o.machine}`}>
                      <td style={{ ...tdStyle, paddingLeft: '14px', fontWeight: '700', color: '#0F172A' }}>{o.operator}</td>
                      <td style={{ ...tdStyle, color: '#475569' }}>{o.machine}</td>
                      <td style={{ ...tdStyle, textAlign: 'right', color: '#475569' }}>{o.plan.toLocaleString('en-IN')}</td>
                      <td style={{ ...tdStyle, textAlign: 'right', fontWeight: '600', color: '#0F172A' }}>{o.actual.toLocaleString('en-IN')}</td>
                      <td style={{ ...tdStyle, textAlign: 'right', fontWeight: '700', color: '#059669' }}>{o.eff}</td>
                      <td style={{ ...tdStyle, textAlign: 'right', color: '#64748B' }}>{o.gap.toLocaleString('en-IN')}</td>
                      <td style={{ ...tdStyle, paddingRight: '14px', textAlign: 'right', color: '#64748B' }}>{o.downtime > 0 ? o.downtime.toFixed(1) : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </BusinzSectionCard>
        </div>

        {/* Right Column */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', minWidth: 0 }}>
          {/* Shift-wise Production */}
          <BusinzSectionCard title="Shift-wise Production" subtitle="Month to date · pcs">
            <table style={{ width: '100%', borderCollapse: 'collapse', fontVariantNumeric: 'tabular-nums' }}>
              <thead>
                <tr>
                  <th style={{ ...thStyle, textAlign: 'left', paddingLeft: '14px' }}>Shift</th>
                  <th style={{ ...thStyle, textAlign: 'right' }}>Plan</th>
                  <th style={{ ...thStyle, textAlign: 'right' }}>Actual</th>
                  <th style={{ ...thStyle, textAlign: 'right', paddingRight: '14px' }}>Achievement</th>
                </tr>
              </thead>
              <tbody>
                {analytics.shiftRows.map((s) => (
                  <tr key={s.shift}>
                    <td style={{ ...tdStyle, paddingLeft: '14px', fontWeight: '700', color: '#0F172A' }}>{s.shift}</td>
                    <td style={{ ...tdStyle, textAlign: 'right', color: '#475569' }}>{s.plan.toLocaleString('en-IN')}</td>
                    <td style={{ ...tdStyle, textAlign: 'right', fontWeight: '600', color: '#0F172A' }}>{s.actual.toLocaleString('en-IN')}</td>
                    <td style={{ ...tdStyle, paddingRight: '14px', textAlign: 'right', fontWeight: '700', color: '#059669' }}>{s.achv}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </BusinzSectionCard>

          {/* Production Trend */}
          <BusinzSectionCard title="Production Trend" subtitle="Month-on-month · actual pcs">
            <table style={{ width: '100%', borderCollapse: 'collapse', fontVariantNumeric: 'tabular-nums' }}>
              <thead>
                <tr>
                  <th style={{ ...thStyle, textAlign: 'left', paddingLeft: '14px' }}>Month</th>
                  <th style={{ ...thStyle, textAlign: 'right' }}>Actual output</th>
                  <th style={{ ...thStyle, textAlign: 'right', paddingRight: '14px' }}>MoM growth</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td style={{ ...tdStyle, paddingLeft: '14px', fontWeight: '700', color: '#0F172A' }}>{analytics.prevMonthLabel} <span style={{ fontWeight: '500', color: '#64748B' }}>· prior month</span></td>
                  <td style={{ ...tdStyle, textAlign: 'right', color: '#64748B' }}>{analytics.prevMonthActual > 0 ? analytics.prevMonthActual.toLocaleString('en-IN') : '—'}</td>
                  <td style={{ ...tdStyle, paddingRight: '14px', textAlign: 'right', color: '#64748B' }}>—</td>
                </tr>
                <tr>
                  <td style={{ ...tdStyle, paddingLeft: '14px', fontWeight: '700', color: '#0F172A', borderBottom: 'none' }}>{analytics.curMonthLabel} <span style={{ fontWeight: '500', color: '#64748B' }}>· month to date</span></td>
                  <td style={{ ...tdStyle, textAlign: 'right', fontWeight: '700', color: '#0F172A', borderBottom: 'none' }}>{analytics.mtdActual.toLocaleString('en-IN')}</td>
                  <td style={{ ...tdStyle, paddingRight: '14px', textAlign: 'right', fontWeight: '700', color: analytics.momGrowth !== null && Number(analytics.momGrowth) >= 0 ? '#059669' : '#B45309', borderBottom: 'none' }}>
                    {analytics.momGrowth !== null ? `${Number(analytics.momGrowth) >= 0 ? '+' : ''}${analytics.momGrowth}%` : '—'}
                  </td>
                </tr>
              </tbody>
            </table>
          </BusinzSectionCard>

          {/* Downtime by Reason */}
          <BusinzSectionCard title="Downtime by Reason" subtitle="Month to date · hours logged" bodyPadding="14px 16px">
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {analytics.downtimeRows.map((d) => {
                const barColor = d.reason === 'Machine Breakdown' || d.reason === 'Material Not Ready' ? '#B45309' : '#0E7490';
                return (
                  <div key={d.reason}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', marginBottom: '4px' }}>
                      <strong style={{ color: '#0F172A' }}>{d.reason}</strong>
                      <span style={{ fontWeight: '700', color: '#334155' }}>{d.hrs.toFixed(1)} hrs · {d.pct}%</span>
                    </div>
                    <div style={{ height: '7px', backgroundColor: '#F1F5F9', borderRadius: '999px', overflow: 'hidden' }}>
                      <div style={{ width: `${Math.min(100, Number(d.pct))}%`, height: '100%', backgroundColor: barColor, borderRadius: '999px' }} />
                    </div>
                  </div>
                );
              })}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid #EAEFEF', paddingTop: '10px', marginTop: '4px' }}>
                <div>
                  <div style={{ fontSize: '12.5px', fontWeight: '800', color: '#0F172A' }}>Total Downtime</div>
                  <div style={{ fontSize: '10.5px', color: '#64748B' }}>Downtime reasons are plant-wide for the period shown.</div>
                </div>
                <strong style={{ fontSize: '13.5px', color: analytics.totalDowntimeHrs > 0 ? '#B45309' : '#0F172A' }}>
                  {analytics.totalDowntimeHrs.toFixed(1)} hrs
                </strong>
              </div>
            </div>
          </BusinzSectionCard>
        </div>
      </div>
    </div>
  );
}
