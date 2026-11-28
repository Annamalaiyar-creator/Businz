import React, { useMemo } from 'react';

const parseAmount = (val) => {
  if (typeof val === 'number') return Number.isFinite(val) ? val : 0;
  const cleaned = String(val ?? '0').replace(/[^0-9.-]/g, '');
  const n = parseFloat(cleaned);
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

const formatCompactINR = (val) => {
  const n = Number(val) || 0;
  if (n >= 10000000) return `₹${(n / 10000000).toFixed(2)} Cr`;
  if (n >= 100000) return `₹${(n / 100000).toFixed(2)} L`;
  return `₹${Math.round(n).toLocaleString('en-IN')}`;
};

const getNetTaxInvoiceVal = (inv) => {
  const exGst = parseAmount(inv?.subTotal ?? inv?.subtotal ?? inv?.taxableValue ?? inv?.taxableAmount ?? inv?.baseAmount);
  if (exGst > 0) return exGst;
  const gross = parseAmount(inv?.grandTotal ?? inv?.grand_total ?? inv?.totalAmount ?? inv?.invoiceAmount ?? inv?.amount);
  return gross > 0 ? gross / 1.18 : 0;
};

export default function CeoCompanyOverviewSection({
  invList = [],
  allInvList = [],
  allBomList = [],
  allPoList = [],
  allGrnList = [],
  inventoryList = [],
  allWorkOrdersList = [],
  allPaymentsList = [],
  companyTarget = 18000000,
  selectedPeriod = 'Today',
  onSelectSubTab
}) {
  const overview = useMemo(() => {
    const now = Date.now();
    const todayStart = startOfDayMs(now);
    const todayEnd = todayStart + 86400000 - 1;
    const timestampLabel = new Date(now).toLocaleString('en-IN', {
      day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true
    });

    // 1. SALES (strictly confirmed Tax Invoices, excluding cancelled/draft/mock)
    const validPeriodInvoices = (invList || []).filter((inv) => {
      if (!inv || inv.cancelled) return false;
      const st = String(inv.status || '').toLowerCase();
      if (st.includes('cancel') || st === 'draft' || st === 'on hold') return false;
      const code = String(inv.taxInvoiceNo || inv.invNo || inv.invoiceNo || inv.code || inv.id || '').trim();
      return Boolean(code && !/^PI[-/]/i.test(code) && !/^INV-(POST|STAGING|USER|MOCK)/i.test(code));
    });
    const salesAchieved = validPeriodInvoices.reduce((s, i) => s + getNetTaxInvoiceVal(i), 0);
    const salesTarget = Number(companyTarget) || 18000000;
    const salesPct = salesTarget > 0 ? Math.round((salesAchieved / salesTarget) * 100) : 0;
    const salesBalance = Math.max(0, salesTarget - salesAchieved);

    // 2. DISPATCH
    const activeBoms = (allBomList || []).filter((b) => b && !b.cancelled && !String(b.status || '').toLowerCase().includes('cancel'));
    let overdueOrders = [];
    let pendingTodayCount = 0;
    let dispatchedTodayCount = 0;

    activeBoms.forEach((b) => {
      const st = String(b.status || '').toLowerCase();
      const isDispatched = Boolean(b.dispatchedAt || b.vehicleLoading?.loadedAt || b.fullyCompleted || st === 'dispatched' || st === 'closed' || st === 'completed');
      const promisedMs = parseDateMs(b.deliveryDate || b.promisedDispatchDate || b.expectedDeliveryDate || b.date || b.createdAt);
      const promisedDay = Number.isFinite(promisedMs) ? startOfDayMs(promisedMs) : null;
      const actualMs = isDispatched ? parseDateMs(b.dispatchedAt || b.vehicleLoading?.loadedAt || b.updatedAt) : NaN;

      if (isDispatched && Number.isFinite(actualMs) && actualMs >= todayStart && actualMs <= todayEnd) {
        dispatchedTodayCount += 1;
      }
      if (!isDispatched && promisedDay !== null) {
        if (promisedDay < todayStart) {
          const delayDays = Math.max(1, Math.round((todayStart - promisedDay) / 86400000));
          overdueOrders.push({
            code: b.bomCode || b.code || b.id,
            customer: b.companyName || b.customerName || 'Customer',
            delayDays
          });
        } else if (promisedDay === todayStart) {
          pendingTodayCount += 1;
        }
      }
    });
    overdueOrders.sort((a, b) => b.delayDays - a.delayDays);

    // 3. PROCUREMENT
    const activePos = (allPoList || []).filter((p) => p && !p.cancelled && !String(p.status || '').toLowerCase().includes('cancel'));
    const pendingMdPos = activePos.filter((p) => {
      const st = String(p.status || '').toLowerCase();
      return !p.mdApproved && (st.includes('pending md') || st.includes('awaiting md') || st === 'draft' || st === 'pending approval' || !st);
    });
    const overduePoDeliveries = activePos.filter((p) => {
      const st = String(p.status || '').toLowerCase();
      if (st.includes('received') || st.includes('closed') || st.includes('completed')) return false;
      const expMs = parseDateMs(p.expectedDeliveryDate || p.deliveryDate || p.dueDate);
      return Number.isFinite(expMs) && startOfDayMs(expMs) < todayStart;
    });
    const grnPoRefs = new Set((allGrnList || []).map((g) => String(g.poNumber || g.poNo || g.poId || '').trim().toLowerCase()).filter(Boolean));
    const grnsPendingCount = activePos.filter((p) => {
      const st = String(p.status || '').toLowerCase();
      const ref = String(p.poNumber || p.poNo || p.id || '').trim().toLowerCase();
      return (st.includes('material received') || st.includes('paid') || st.includes('proceed')) && ref && !grnPoRefs.has(ref);
    }).length;

    // 4. INVENTORY
    let stockValue = 0;
    let outOfStockItems = [];
    let lowStockCount = 0;
    (inventoryList || []).forEach((it) => {
      const qty = parseAmount(it.stock ?? it.qty ?? it.quantity ?? it.currentStock ?? it.availableQty ?? 0);
      const rate = parseAmount(it.rate ?? it.unitPrice ?? it.price ?? it.cost ?? 0);
      const minLvl = parseAmount(it.minStock ?? it.reorderLevel ?? it.minLevel ?? 0);
      if (qty > 0 && rate > 0) stockValue += qty * rate;
      if (qty <= 0) {
        outOfStockItems.push({
          name: it.itemName || it.name || it.description || it.sku || 'SKU',
          shortage: minLvl > 0 ? minLvl : 0,
          unit: it.uom || it.unit || 'Nos'
        });
      } else if (minLvl > 0 && qty <= minLvl) {
        lowStockCount += 1;
      }
    });

    // 5. PRODUCTION
    let plannedQty = 0;
    let actualQty = 0;
    let activeWoCount = 0;
    let delayedWoList = [];
    (allWorkOrdersList || []).forEach((wo) => {
      if (!wo || wo.cancelled) return;
      const st = String(wo.status || '').toLowerCase();
      const target = parseAmount(wo.plannedQty ?? wo.targetQty ?? wo.qty ?? wo.quantity ?? 1);
      const done = parseAmount(wo.completedQty ?? wo.producedQty ?? wo.actualQty ?? (st.includes('complete') ? target : 0));
      plannedQty += target;
      actualQty += done;
      if (!st.includes('complete') && !st.includes('closed')) {
        activeWoCount += 1;
        const dueMs = parseDateMs(wo.dueDate || wo.targetDate || wo.expectedDate);
        if (Number.isFinite(dueMs) && startOfDayMs(dueMs) < todayStart) {
          delayedWoList.push(wo);
        }
      }
    });
    const prodPct = plannedQty > 0 ? ((actualQty / plannedQty) * 100).toFixed(1) : '0.0';

    // 6. ACCOUNTS & FINANCE
    const validAllInvoices = (allInvList || []).filter((inv) => {
      if (!inv || inv.cancelled) return false;
      const st = String(inv.status || '').toLowerCase();
      if (st.includes('cancel') || st === 'draft') return false;
      const code = String(inv.taxInvoiceNo || inv.invNo || inv.invoiceNo || inv.code || inv.id || '').trim();
      return Boolean(code && !/^PI[-/]/i.test(code) && !/^INV-(POST|STAGING|USER|MOCK)/i.test(code));
    });
    const totalCollections = (allPaymentsList || []).reduce((s, p) => s + parseAmount(p.amount ?? p.paidAmount ?? p.receivedAmount), 0);
    let overdueReceivables = 0;
    validAllInvoices.forEach((inv) => {
      const total = parseAmount(inv.grandTotal ?? inv.totalAmount ?? inv.invoiceAmount ?? inv.amount);
      const paid = parseAmount(inv.paidAmount ?? inv.amountPaid ?? inv.receivedAmount);
      const outstanding = Math.max(0, total - paid);
      const dueMs = parseDateMs(inv.dueDate || inv.paymentDueDate || inv.date);
      if (outstanding > 0 && Number.isFinite(dueMs) && (now - dueMs) > Number(inv.creditDays || 30) * 86400000) {
        overdueReceivables += outstanding;
      }
    });
    const dueToSuppliers = activePos
      .filter((p) => {
        const st = String(p.status || '').toLowerCase();
        return !p.paid && !st.includes('paid') && !st.includes('closed');
      })
      .reduce((s, p) => s + parseAmount(p.grandTotal ?? p.totalAmount ?? p.amount), 0);

    // PRIORITY ACTIONS
    const priorityActions = [];
    if (pendingMdPos.length > 0) {
      priorityActions.push({
        dept: 'Procurement',
        tab: 'procurement',
        impact: `${pendingMdPos.length} purchase order${pendingMdPos.length > 1 ? 's' : ''} awaiting approval`,
        nextAction: 'Review and approve pending POs',
        owner: 'MD',
        due: 'Today',
        urgent: true
      });
    }
    if (overdueOrders.length > 0) {
      const top = overdueOrders[0];
      priorityActions.push({
        dept: 'Dispatch',
        tab: 'bom',
        impact: `Order ${top.code} overdue by ${top.delayDays} day${top.delayDays > 1 ? 's' : ''}`,
        nextAction: `Confirm supply and revised dispatch ETA (${top.customer})`,
        owner: 'Dispatch',
        due: 'Today',
        urgent: true
      });
    }
    if (outOfStockItems.length > 0) {
      const topItem = outOfStockItems[0];
      priorityActions.push({
        dept: 'Inventory',
        tab: 'inventory-dashboard',
        impact: `${topItem.name} out of stock${outOfStockItems.length > 1 ? ` (+${outOfStockItems.length - 1} more SKUs)` : ''}`,
        nextAction: 'Confirm incoming PO ETA or raise reorder',
        owner: 'Stores',
        due: 'Today',
        urgent: true
      });
    }
    if (overdueReceivables > 0) {
      priorityActions.push({
        dept: 'Finance',
        tab: 'accounts',
        impact: `${formatCompactINR(overdueReceivables)} overdue receivables`,
        nextAction: 'Review overdue accounts and collection commitments',
        owner: 'Accounts',
        due: 'Today',
        urgent: true
      });
    }
    if (delayedWoList.length > 0) {
      priorityActions.push({
        dept: 'Production',
        tab: 'production',
        impact: `${delayedWoList.length} work order${delayedWoList.length > 1 ? 's' : ''} past due date`,
        nextAction: 'Review bottleneck and confirm completion schedule',
        owner: 'Production',
        due: 'Today',
        urgent: false
      });
    }

    return {
      timestampLabel,
      salesAchieved,
      salesTarget,
      salesPct,
      salesBalance,
      overdueCount: overdueOrders.length,
      pendingTodayCount,
      dispatchedTodayCount,
      pendingMdCount: pendingMdPos.length,
      overdueDeliveriesCount: overduePoDeliveries.length,
      grnsPendingCount,
      stockValue,
      outOfStockCount: outOfStockItems.length,
      lowStockCount,
      actualQty,
      plannedQty,
      prodPct,
      activeWoCount,
      delayedWoCount: delayedWoList.length,
      totalCollections,
      overdueReceivables,
      dueToSuppliers,
      priorityActions
    };
  }, [
    invList, allInvList, allBomList, allPoList, allGrnList,
    inventoryList, allWorkOrdersList, allPaymentsList, companyTarget
  ]);

  const cards = [
    {
      dept: 'SALES',
      tab: 'crm-dashboard',
      value: formatCompactINR(overview.salesAchieved),
      valColor: overview.salesPct >= 100 ? '#059669' : '#B45309',
      sub: `Invoiced (${selectedPeriod}) · ${overview.salesPct}% of ${formatCompactINR(overview.salesTarget)} target`,
      footer: overview.salesBalance > 0 ? `${formatCompactINR(overview.salesBalance)} balance to target` : 'Monthly target achieved'
    },
    {
      dept: 'DISPATCH',
      tab: 'bom',
      value: `${overview.overdueCount} overdue orders`,
      valColor: overview.overdueCount > 0 ? '#DC2626' : '#059669',
      sub: 'Open past the promised dispatch date',
      footer: `${overview.pendingTodayCount} pending today · ${overview.dispatchedTodayCount} dispatched today`
    },
    {
      dept: 'PROCUREMENT',
      tab: 'procurement',
      value: `${overview.pendingMdCount} POs to approve`,
      valColor: overview.pendingMdCount > 0 ? '#B45309' : '#059669',
      sub: 'Awaiting MD approval',
      footer: `${overview.overdueDeliveriesCount} deliveries overdue · ${overview.grnsPendingCount} GRNs pending`
    },
    {
      dept: 'INVENTORY',
      tab: 'inventory-dashboard',
      value: formatCompactINR(overview.stockValue),
      valColor: '#B45309',
      sub: `On-hand stock value (${inventoryList.length} SKUs)`,
      footer: `${overview.outOfStockCount} SKUs out of stock · ${overview.lowStockCount} low stock`
    },
    {
      dept: 'PRODUCTION',
      tab: 'production',
      value: `${Math.round(overview.actualQty)} / ${Math.round(overview.plannedQty)} pcs`,
      valColor: '#0E7490',
      sub: `Actual / plan · ${overview.prodPct}% achieved`,
      footer: `${overview.activeWoCount} active work orders · ${overview.delayedWoCount} overdue`
    },
    {
      dept: 'ACCOUNTS & FINANCE',
      tab: 'accounts',
      value: formatCompactINR(overview.totalCollections),
      valColor: overview.overdueReceivables > 0 ? '#DC2626' : '#059669',
      sub: `Collections recorded (${allPaymentsList.length} entries)`,
      footer: `${formatCompactINR(overview.overdueReceivables)} overdue receivables · ${formatCompactINR(overview.dueToSuppliers)} due to suppliers`
    }
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
      <style>{`
        .ceo-overview-grid {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 12px;
        }
        @media (max-width: 1024px) {
          .ceo-overview-grid {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }
        }
        @media (max-width: 640px) {
          .ceo-overview-grid {
            grid-template-columns: minmax(0, 1fr);
          }
        }
      `}</style>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px' }}>
        <h2 style={{ margin: 0, fontSize: '18px', fontWeight: '800', color: '#0F172A', letterSpacing: '-0.3px' }}>
          Company Overview
        </h2>
        <span style={{ fontSize: '12px', color: '#64748B', fontWeight: '600' }}>
          {overview.timestampLabel} · Period: {selectedPeriod}
        </span>
      </div>

      {/* 6 Department Summary Cards */}
      <div className="ceo-overview-grid">
        {cards.map((c) => (
          <div
            key={c.dept}
            onClick={() => onSelectSubTab && onSelectSubTab(c.tab)}
            style={{
              backgroundColor: '#FFFFFF',
              border: '1px solid #EAEFEF',
              borderRadius: '14px',
              overflow: 'hidden',
              cursor: 'pointer',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              boxShadow: '0 1px 3px rgba(15, 23, 42, 0.03)'
            }}
          >
            <div style={{ padding: '14px 16px 12px' }}>
              <div style={{ fontSize: '10.5px', fontWeight: '800', color: '#64748B', letterSpacing: '0.5px', textTransform: 'uppercase' }}>
                {c.dept}
              </div>
              <div style={{ fontSize: '22px', fontWeight: '800', color: c.valColor, marginTop: '6px', letterSpacing: '-0.4px' }}>
                {c.value}
              </div>
              <div style={{ fontSize: '11.5px', color: '#475569', marginTop: '4px', fontWeight: '500' }}>
                {c.sub}
              </div>
            </div>
            <div style={{
              padding: '8px 16px',
              backgroundColor: '#F8FAFC',
              borderTop: '1px solid #F1F5F9',
              fontSize: '11px',
              fontWeight: '600',
              color: '#64748B'
            }}>
              {c.footer}
            </div>
          </div>
        ))}
      </div>

      {/* Priority Actions Card */}
      <div style={{
        backgroundColor: '#FFFFFF',
        border: '1px solid #EAEFEF',
        borderRadius: '14px',
        overflow: 'hidden',
        boxShadow: '0 1px 3px rgba(15, 23, 42, 0.03)'
      }}>
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px',
          padding: '12px 18px', backgroundColor: '#F8FAFC', borderBottom: '1px solid #EAEFEF'
        }}>
          <h3 style={{ margin: 0, fontSize: '14px', fontWeight: '800', color: '#0F172A' }}>Priority Actions</h3>
          <span style={{ fontSize: '11px', fontWeight: '600', color: '#64748B' }}>
            Items requiring a decision or follow-up
          </span>
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12.5px' }}>
            <thead>
              <tr style={{ backgroundColor: '#F8FAFC', borderBottom: '1px solid #EAEFEF', color: '#64748B', fontSize: '10.5px', textTransform: 'uppercase', letterSpacing: '0.4px', textAlign: 'left' }}>
                <th style={{ padding: '9px 16px' }}>Department</th>
                <th style={{ padding: '9px 14px' }}>Exception / Impact</th>
                <th style={{ padding: '9px 14px' }}>Next Action</th>
                <th style={{ padding: '9px 14px' }}>Owner</th>
                <th style={{ padding: '9px 16px', textAlign: 'right' }}>Due</th>
              </tr>
            </thead>
            <tbody>
              {overview.priorityActions.length === 0 ? (
                <tr>
                  <td colSpan={5} style={{ padding: '22px', textAlign: 'center', color: '#64748B' }}>
                    All departments are on track — no urgent exceptions pending.
                  </td>
                </tr>
              ) : overview.priorityActions.map((row) => (
                <tr
                  key={`${row.dept}-${row.impact}`}
                  onClick={() => onSelectSubTab && onSelectSubTab(row.tab)}
                  style={{ borderBottom: '1px solid #F1F5F9', cursor: 'pointer' }}
                >
                  <td style={{ padding: '11px 16px', fontWeight: '700', color: '#0E7490', whiteSpace: 'nowrap' }}>{row.dept}</td>
                  <td style={{ padding: '11px 14px', fontWeight: '700', color: '#0F172A' }}>{row.impact}</td>
                  <td style={{ padding: '11px 14px', color: '#475569' }}>{row.nextAction}</td>
                  <td style={{ padding: '11px 14px', color: '#334155', fontWeight: '600', whiteSpace: 'nowrap' }}>{row.owner}</td>
                  <td style={{ padding: '11px 16px', textAlign: 'right', whiteSpace: 'nowrap' }}>
                    <span style={{
                      display: 'inline-block',
                      padding: '3px 10px',
                      borderRadius: '999px',
                      fontSize: '11px',
                      fontWeight: '700',
                      backgroundColor: row.urgent ? '#FEF2F2' : '#EFF6FF',
                      color: row.urgent ? '#DC2626' : '#1D4ED8',
                      border: `1px solid ${row.urgent ? '#FECACA' : '#BFDBFE'}`
                    }}>
                      {row.due}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Footer Note */}
      <div style={{ fontSize: '11px', color: '#64748B' }}>
        Live figures shown at one common reporting cut-off. Department tabs carry the detailed records.
      </div>
    </div>
  );
}
