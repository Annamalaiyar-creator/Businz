import React, { useState, useEffect, useMemo } from 'react';
import {
  ArrowLeft, MessageSquare, Edit3, Mail, Phone, CheckCircle2,
  FileText, MoreHorizontal, ChevronDown, ChevronRight,
  Calendar, Clock, Plus, Trash2, Send, Layers,
  Zap, Sparkles, User, MapPin, Building2, Briefcase, Tag, CreditCard,
  Receipt, TrendingUp, Activity, Info, Lightbulb, Hash, Wallet, ShieldCheck
} from 'lucide-react';
import { fetchCloudStore, saveCloudStore } from '../../utils/supabaseDataSync';

// ─── Design tokens (BUSINZ design system) ───
const C = {
  teal: '#0E7490',
  tealDark: '#155E75',
  tealSoft: '#ECFEFF',
  tealBorder: '#CFFAFE',
  ink: '#0F172A',
  body: '#334155',
  muted: '#64748B',
  faint: '#94A3B8',
  line: '#E2E8F0',
  lineSoft: '#F1F5F9',
  bg: '#F8FAFC',
  purple: '#7E22CE',
  purpleSoft: '#F3E8FF',
  purpleBorder: '#E9D5FF',
  green: '#16A34A',
  greenSoft: '#F0FDF4',
  amber: '#D97706',
  amberSoft: '#FFFBEB'
};

const formatINR = (n) => {
  const num = Number(n) || 0;
  if (num >= 10000000) return `₹ ${(num / 10000000).toFixed(2)} Cr`;
  if (num >= 100000) return `₹ ${(num / 100000).toFixed(1)} L`;
  return `₹ ${Math.round(num).toLocaleString('en-IN')}`;
};

const C360_STYLES = `
  .c360-grid { display: grid; grid-template-columns: 300px minmax(0, 1fr) 320px; gap: 16px; align-items: start; }
  .c360-right { display: flex; flex-direction: column; gap: 14px; }
  .c360-kpis { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 12px; }
  .c360-details { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
  .c360-sticky { position: sticky; top: 12px; }
  .c360-btn { transition: transform 0.15s ease, box-shadow 0.15s ease, background-color 0.15s ease; }
  .c360-btn:hover { transform: translateY(-1px); }
  .c360-quick:hover { transform: translateY(-2px); box-shadow: 0 4px 10px rgba(15, 23, 42, 0.08); }
  .c360-tab:hover { color: ${C.teal} !important; background-color: ${C.tealSoft} !important; }
  .c360-row:hover { border-color: #A5F3FC !important; box-shadow: 0 2px 8px rgba(14, 116, 144, 0.06); }
  .c360-kpi:hover { border-color: #A5F3FC !important; }
  @media (max-width: 1400px) {
    .c360-grid { grid-template-columns: 290px minmax(0, 1fr); }
    .c360-right { grid-column: 1 / -1; display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); }
  }
  @media (max-width: 960px) {
    .c360-grid { grid-template-columns: 1fr; }
    .c360-kpis { grid-template-columns: repeat(2, minmax(0, 1fr)); }
    .c360-details { grid-template-columns: 1fr; }
    .c360-sticky { position: static; }
  }
`;

// ─── Small presentational helpers ───
function Card({ children, style }) {
  return (
    <div style={{ backgroundColor: '#FFFFFF', borderRadius: '14px', border: `1px solid ${C.line}`, boxShadow: '0 1px 3px rgba(15, 23, 42, 0.04)', overflow: 'hidden', ...style }}>
      {children}
    </div>
  );
}

function SourceChip({ type }) {
  const isLedger = type === 'zoho' || type === 'ledger';
  const Icon = isLedger ? Zap : Sparkles;
  return (
    <span style={{
      fontSize: '10px', fontWeight: '800', letterSpacing: '0.3px',
      padding: '2px 8px', borderRadius: '50px',
      backgroundColor: isLedger ? C.purpleSoft : C.tealSoft,
      color: isLedger ? C.purple : C.teal,
      border: `1px solid ${isLedger ? C.purpleBorder : C.tealBorder}`,
      display: 'inline-flex', alignItems: 'center', gap: '4px', whiteSpace: 'nowrap'
    }}>
      <Icon size={10} /> {isLedger ? 'CENTRAL LEDGER' : 'BUSINZ CRM'}
    </span>
  );
}

function CardHeader({ icon: Icon, title, subtitle, right, onClick, borderless }) {
  return (
    <div
      onClick={onClick}
      style={{
        padding: '13px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '10px',
        borderBottom: borderless ? 'none' : `1px solid ${C.lineSoft}`, cursor: onClick ? 'pointer' : 'default'
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
        {Icon && (
          <span style={{ width: '28px', height: '28px', borderRadius: '8px', backgroundColor: C.tealSoft, color: C.teal, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <Icon size={14} />
          </span>
        )}
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: '13px', fontWeight: '800', color: C.ink }}>{title}</div>
          {subtitle && <div style={{ fontSize: '11px', color: C.faint, marginTop: '1px' }}>{subtitle}</div>}
        </div>
      </div>
      {right}
    </div>
  );
}

function InfoRow({ icon: Icon, label, value, valueColor, mono }) {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
      <span style={{ width: '26px', height: '26px', borderRadius: '7px', backgroundColor: C.bg, border: `1px solid ${C.lineSoft}`, color: C.muted, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        <Icon size={13} />
      </span>
      <div style={{ minWidth: 0, flex: 1 }}>
        <div style={{ fontSize: '10.5px', color: C.faint, fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.4px' }}>{label}</div>
        <div style={{ fontSize: '12.5px', fontWeight: '700', color: valueColor || C.ink, marginTop: '1px', wordBreak: 'break-word', fontFamily: mono ? 'ui-monospace, SFMono-Regular, Menlo, monospace' : 'inherit' }}>
          {value}
        </div>
      </div>
    </div>
  );
}

function KeyValue({ label, value, valueColor, mono }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: '12px', padding: '7px 0', borderBottom: `1px dashed ${C.lineSoft}` }}>
      <span style={{ fontSize: '12px', color: C.muted, flexShrink: 0 }}>{label}</span>
      <span style={{ fontSize: '12px', fontWeight: '700', color: valueColor || C.ink, textAlign: 'right', wordBreak: 'break-word', fontFamily: mono ? 'ui-monospace, SFMono-Regular, Menlo, monospace' : 'inherit' }}>
        {value}
      </span>
    </div>
  );
}

function TabHeading({ title, subtitle, action }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
      <div>
        <h4 style={{ margin: 0, fontSize: '15px', fontWeight: '800', color: C.ink }}>{title}</h4>
        {subtitle && <p style={{ fontSize: '12px', color: C.muted, margin: '2px 0 0' }}>{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

function PrimaryButton({ children, onClick, icon: Icon, color = C.teal, small }) {
  return (
    <button
      type="button"
      className="c360-btn"
      onClick={onClick}
      style={{
        backgroundColor: color, color: '#FFFFFF', border: 'none',
        padding: small ? '6px 12px' : '8px 16px', borderRadius: '8px',
        fontSize: '12px', fontWeight: '800', cursor: 'pointer',
        display: 'inline-flex', alignItems: 'center', gap: '6px', whiteSpace: 'nowrap',
        boxShadow: `0 2px 6px ${color === C.green ? 'rgba(22, 163, 74, 0.25)' : 'rgba(14, 116, 144, 0.25)'}`
      }}
    >
      {Icon && <Icon size={14} />} {children}
    </button>
  );
}

function EmptyState({ icon: Icon, title, text, actionLabel, onAction }) {
  return (
    <div style={{ backgroundColor: '#FFFFFF', padding: '36px 24px', borderRadius: '12px', border: `1px dashed ${C.line}`, textAlign: 'center' }}>
      <div style={{ width: '52px', height: '52px', borderRadius: '50%', backgroundColor: C.tealSoft, color: C.teal, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px' }}>
        <Icon size={24} />
      </div>
      <div style={{ fontSize: '14px', fontWeight: '800', color: C.ink, marginBottom: '4px' }}>{title}</div>
      <p style={{ fontSize: '12.5px', color: C.muted, maxWidth: '440px', margin: '0 auto 16px', lineHeight: 1.5 }}>{text}</p>
      {actionLabel && <PrimaryButton icon={Plus} onClick={onAction}>{actionLabel}</PrimaryButton>}
    </div>
  );
}

export default function Customer360PageView({
  customer,
  onBack,
  onEditCustomer,
  onOpenWhatsAppChat,
  onNavigateTab,
  opportunities = [],
  quotations = [],
  boms = [],
  activeAccountUser = ''
}) {
  const [profileTab, setProfileTab] = useState('Timeline');
  const [isContactInfoExpanded, setIsContactInfoExpanded] = useState(true);
  const [isOverviewOpen, setIsOverviewOpen] = useState(true);
  const [isCompanyOpen, setIsCompanyOpen] = useState(true);
  const [isDealsOpen, setIsDealsOpen] = useState(true);

  const [newTaskInput, setNewTaskInput] = useState('');
  const [newTaskDueDate, setNewTaskDueDate] = useState('');
  const [newNoteInput, setNewNoteInput] = useState('');

  const custKey = customer?.customerCode || customer?.id || 'default_key';

  // Customer Tasks store in Supabase cloud database
  const [customerTasks, setCustomerTasks] = useState({});

  // Customer Notes store in Supabase cloud database
  const [customerNotes, setCustomerNotes] = useState({});

  useEffect(() => {
    let active = true;
    Promise.all([
      fetchCloudStore('crm_tasks', {}),
      fetchCloudStore('crm_notes', {})
    ]).then(([tasks, notes]) => {
      if (active) {
        if (tasks && typeof tasks === 'object' && !Array.isArray(tasks)) setCustomerTasks(tasks);
        if (notes && typeof notes === 'object' && !Array.isArray(notes)) setCustomerNotes(notes);
      }
    });
    return () => { active = false; };
  }, []);

  const handleAddCustomerTask = (id) => {
    if (!newTaskInput.trim()) return;
    const taskObj = {
      id: 'task_' + Date.now(),
      text: newTaskInput.trim(),
      dueDate: newTaskDueDate || new Date().toISOString().split('T')[0],
      completed: false,
      createdAt: new Date().toISOString()
    };
    const updated = {
      ...customerTasks,
      [id]: [taskObj, ...(customerTasks[id] || [])]
    };
    setCustomerTasks(updated);
    saveCloudStore('crm_tasks', updated);
    setNewTaskInput('');
    setNewTaskDueDate('');
  };

  const handleToggleCustomerTask = (id, taskId) => {
    const list = customerTasks[id] || [];
    const updated = {
      ...customerTasks,
      [id]: list.map(t => t.id === taskId ? { ...t, completed: !t.completed } : t)
    };
    setCustomerTasks(updated);
    saveCloudStore('crm_tasks', updated);
  };

  const handleDeleteCustomerTask = (id, taskId) => {
    const list = customerTasks[id] || [];
    const updated = {
      ...customerTasks,
      [id]: list.filter(t => t.id !== taskId)
    };
    setCustomerTasks(updated);
    saveCloudStore('crm_tasks', updated);
  };

  const handleAddCustomerNote = (id) => {
    if (!newNoteInput.trim()) return;
    const noteObj = {
      id: 'note_' + Date.now(),
      text: newNoteInput.trim(),
      author: activeAccountUser || 'Account Manager',
      date: new Date().toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }),
      createdAt: new Date().toISOString()
    };
    const updated = {
      ...customerNotes,
      [id]: [noteObj, ...(customerNotes[id] || [])]
    };
    setCustomerNotes(updated);
    saveCloudStore('crm_notes', updated);
    setNewNoteInput('');
  };

  if (!customer) {
    return (
      <div style={{ padding: '40px', textAlign: 'center' }}>
        <p>No customer selected.</p>
        <button onClick={onBack} style={{ padding: '8px 16px', backgroundColor: '#0E7490', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer' }}>
          Back to Directory
        </button>
      </div>
    );
  }

  const currentTasks = customerTasks[custKey] || [];
  const currentNotes = customerNotes[custKey] || [];

  // Resolve BOM orders from props or local fallback
  const allBoms = useMemo(() => {
    if (Array.isArray(boms) && boms.length > 0) return boms;
    try {
      const stored = localStorage.getItem('controlroom_bom_store') || localStorage.getItem('bom_orders_store');
      if (stored) return JSON.parse(stored);
    } catch (_) {}
    return [];
  }, [boms]);

  const custBoms = useMemo(() => {
    const cComp = (customer.companyName || '').toLowerCase().trim();
    const cName = (customer.customerName || '').toLowerCase().trim();
    const cCode = (customer.customerCode || '').toLowerCase().trim();
    return allBoms.filter(b => {
      const bCust = (b.customerName || b.clientName || b.companyName || b.customer || '').toLowerCase().trim();
      const bCode = (b.customerCode || '').toLowerCase().trim();
      return (cComp && bCust && (bCust === cComp || bCust.includes(cComp) || cComp.includes(bCust))) ||
             (cName && bCust && (bCust === cName || bCust.includes(cName) || cName.includes(bCust))) ||
             (cCode && bCode && bCode === cCode);
    });
  }, [allBoms, customer]);

  const custQuotations = quotations.filter(q => {
    const cComp = (customer.companyName || '').toLowerCase().trim();
    const cName = (customer.customerName || '').toLowerCase().trim();
    const qComp = (q.customerName || q.companyName || '').toLowerCase().trim();
    return (cComp && qComp && (qComp === cComp || qComp.includes(cComp) || cComp.includes(qComp))) ||
           (cName && qComp && (qComp === cName || qComp.includes(cName) || cName.includes(qComp))) ||
           (customer.customerCode && q.customerCode && q.customerCode === customer.customerCode) ||
           (customer.id && q.customerId && q.customerId === customer.id);
  });

  const custDeals = opportunities.filter(o =>
    (customer.id && o.customerId === customer.id) ||
    (customer.companyName && o.companyName && o.companyName.toLowerCase().trim() === customer.companyName.toLowerCase().trim())
  );

  // ─── Derived display values (read-only, real data only) ───
  const repName = customer.assignedSalesperson || customer.salesPerson || '';
  const contactName = customer.primaryContact?.name || customer.customerName || customer.companyName || '';
  const isLinked = customer.source === 'Zoho Books' || !!customer.zohoContactId || !!customer.customerCode;
  const quoteAmount = (q) => Number(q.totalAmount || q.amount || q.grandTotal || 0);
  const openDeals = custDeals.filter(d => d.stage !== 'Won' && d.stage !== 'Lost');
  const pipelineValue = openDeals.reduce((s, d) => s + (Number(d.dealValue) || 0), 0);
  const quotationsValue = custQuotations.reduce((s, q) => s + quoteAmount(q), 0);
  const pendingTasks = currentTasks.filter(t => !t.completed).length;
  const locationText = [customer.city, customer.state].filter(Boolean).join(', ') || '—';

  const customerCreationDate = customer.createdAt || customer.created_time || customer.createdTime || customer.date;
  const creationDateText = customerCreationDate
    ? new Date(customerCreationDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
    : null;

  const profileTabs = [
    { key: 'Timeline', icon: Activity },
    { key: 'Tasks', icon: CheckCircle2, count: pendingTasks },
    { key: 'Notes', icon: FileText, count: currentNotes.length },
    { key: 'Quotations', icon: Receipt, count: custQuotations.length },
    { key: 'WhatsApp Chat', icon: MessageSquare },
    { key: 'BOM Orders', icon: Layers, count: custBoms.length },
    { key: 'Opportunities', icon: TrendingUp, count: custDeals.length },
    { key: 'Details', icon: Info }
  ];

  const hasCreditLimit = customer.creditLimit !== undefined && customer.creditLimit !== null && customer.creditLimit !== '' && Number(customer.creditLimit) > 0;
  const kpis = [
    { label: 'Open Pipeline', value: formatINR(pipelineValue), sub: `${openDeals.length} open deal${openDeals.length === 1 ? '' : 's'}`, icon: TrendingUp, fg: C.teal, bg: C.tealSoft },
    { label: 'Quotations', value: formatINR(quotationsValue), sub: `${custQuotations.length} issued`, icon: Receipt, fg: C.green, bg: C.greenSoft },
    { label: 'Pending Tasks', value: String(pendingTasks), sub: `${currentTasks.length} total follow-ups`, icon: CheckCircle2, fg: '#A21CAF', bg: '#FDF4FF' },
    {
      label: 'Credit Limit',
      value: hasCreditLimit ? formatINR(customer.creditLimit) : 'Not Set',
      sub: customer.creditDays ? `${customer.creditDays} days credit` : (customer.paymentTerms || 'No terms set'),
      icon: Wallet,
      fg: C.amber,
      bg: C.amberSoft
    }
  ];

  const quickActions = [
    { label: 'Email', icon: Mail, fg: C.teal, bg: '#F0FDFA', border: '#CCFBF1', onClick: () => {
      const email = customer.primaryContact?.email || customer.email;
      if (email) window.open(`mailto:${email}`);
      else alert('No email address registered for this customer.');
    }},
    { label: 'Call', icon: Phone, fg: '#2563EB', bg: '#EFF6FF', border: '#DBEAFE', onClick: () => {
      const phone = customer.primaryContact?.phone || customer.phone;
      if (phone) window.open(`tel:${phone}`);
      else alert('No phone number registered for this customer.');
    }},
    { label: 'Task', icon: CheckCircle2, fg: '#A21CAF', bg: '#FDF4FF', border: '#F5D0FE', onClick: () => setProfileTab('Tasks') },
    { label: 'WhatsApp', icon: MessageSquare, fg: C.green, bg: C.greenSoft, border: '#DCFCE7', onClick: () => (onOpenWhatsAppChat ? onOpenWhatsAppChat(customer) : onNavigateTab('WhatsApp Inbox')) },
    { label: 'Notes', icon: FileText, fg: C.amber, bg: C.amberSoft, border: '#FEF3C7', onClick: () => setProfileTab('Notes') },
    { label: 'More', icon: MoreHorizontal, fg: C.muted, bg: C.bg, border: C.line, onClick: () => onEditCustomer(customer) }
  ];

  const timelineEvents = useMemo(() => {
    const events = [];

    if (creationDateText) {
      events.push({
        icon: User,
        color: C.teal,
        title: 'Customer Account Created',
        meta: creationDateText,
        body: <>Customer account registered in BUSINZ{repName ? ` assigned to ${repName}` : ''}{customer.source ? ` via ${customer.source}` : ''}.</>
      });
    }

    custQuotations.forEach(q => {
      events.push({
        icon: Receipt,
        color: C.green,
        title: `Quotation: ${q.quotationNumber || 'Issued'}`,
        meta: q.date ? new Date(q.date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }) : 'Quotation',
        body: <>Commercial quotation generated for <strong>{formatINR(quoteAmount(q))}</strong>. Status: <strong>{q.status || 'Active'}</strong>.</>
      });
    });

    custBoms.forEach(b => {
      events.push({
        icon: Layers,
        color: '#0284C7',
        title: `BOM Order: ${b.bomNumber || b.bomCode || 'Order'}`,
        meta: b.date || (b.createdAt ? new Date(b.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }) : 'BOM'),
        body: <>Bill of Materials generated{b.projectName ? ` for ${b.projectName}` : ''}{b.totalWeight ? ` • Total Weight: ${b.totalWeight} kg` : ''}. Status: <strong>{b.status || 'Active'}</strong>.</>
      });
    });

    custDeals.forEach(opp => {
      events.push({
        icon: TrendingUp,
        color: C.teal,
        title: `Opportunity: ${opp.title || 'Deal'}`,
        meta: opp.stage || 'Pipeline',
        body: <>Pipeline stage: <strong>{opp.stage || 'Active'}</strong> • Deal value: <strong>₹ {Number(opp.dealValue || 0).toLocaleString()}</strong>.</>
      });
    });

    currentNotes.forEach(n => {
      events.push({
        icon: FileText,
        color: C.amber,
        title: `Note by ${n.author || 'User'}`,
        meta: n.date || 'Note',
        body: <>{n.text}</>
      });
    });

    currentTasks.filter(t => t.completed).forEach(t => {
      events.push({
        icon: CheckCircle2,
        color: '#10B981',
        title: 'Completed Task',
        meta: t.dueDate || 'Done',
        body: <>{t.text}</>
      });
    });

    return events;
  }, [customer, custQuotations, custBoms, custDeals, currentNotes, currentTasks, repName, creationDateText]);

  const overviewItems = useMemo(() => [
    { icon: Calendar, label: 'Created At', value: creationDateText || '—' },
    { icon: User, label: 'Lead Owner', value: repName || 'Unassigned' },
    { icon: Building2, label: 'Account Type', value: customer.customerType || '—' },
    { icon: Tag, label: 'Industry', value: customer.industry || '—' },
    { icon: Receipt, label: 'Quotations', value: `${custQuotations.length} (${formatINR(quotationsValue)})` },
    { icon: Layers, label: 'BOM Orders', value: `${custBoms.length}` },
    { icon: TrendingUp, label: 'Pipeline Deals', value: `${openDeals.length} (${formatINR(pipelineValue)})` },
    { icon: CheckCircle2, label: 'Open Tasks', value: `${pendingTasks}` }
  ], [creationDateText, repName, customer, custQuotations, quotationsValue, custBoms, openDeals, pipelineValue, pendingTasks]);

  const metaChip = (Icon, text, opts = {}) => (
    <span style={{
      fontSize: '11.5px', fontWeight: '700', color: opts.fg || C.body,
      backgroundColor: opts.bg || '#FFFFFF', border: `1px solid ${opts.border || C.line}`,
      padding: '3px 10px', borderRadius: '50px', display: 'inline-flex', alignItems: 'center', gap: '5px', whiteSpace: 'nowrap'
    }}>
      <Icon size={12} style={{ color: opts.fg || C.muted }} /> {text}
    </span>
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', minWidth: 0, width: '100%', fontFamily: "'DM Sans', 'Plus Jakarta Sans', sans-serif" }}>
      <style>{C360_STYLES}</style>

      {/* ─── HERO HEADER ─── */}
      <Card style={{ background: 'linear-gradient(135deg, #ECFEFF 0%, #FFFFFF 45%, #FFFFFF 100%)', overflow: 'visible' }}>
        {/* Breadcrumb row */}
        <div style={{ padding: '14px 22px 0', display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
          <button
            type="button"
            className="c360-btn"
            onClick={onBack}
            style={{ background: '#FFFFFF', border: '1px solid #CBD5E1', color: '#475569', padding: '6px 12px', borderRadius: '8px', fontSize: '12px', fontWeight: '700', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
          >
            <ArrowLeft size={14} /> Back to Directory
          </button>
          <span style={{ fontSize: '12px', color: C.faint, display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
            Customers <ChevronRight size={12} /> <span style={{ color: C.body, fontWeight: '700' }}>Customer 360°</span>
          </span>
        </div>

        {/* Identity row */}
        <div style={{ padding: '16px 22px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px', minWidth: 0 }}>
            <div style={{
              width: '60px', height: '60px', borderRadius: '16px', flexShrink: 0,
              background: `linear-gradient(135deg, ${C.teal} 0%, ${C.tealDark} 100%)`, color: '#FFFFFF',
              display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '24px', fontWeight: '800',
              boxShadow: '0 6px 16px rgba(14, 116, 144, 0.3)'
            }}>
              {customer.companyName?.charAt(0) || 'C'}
            </div>
            <div style={{ minWidth: 0 }}>
              <h2 style={{ fontSize: '21px', fontWeight: '800', margin: 0, color: C.ink, letterSpacing: '-0.3px' }}>
                {customer.companyName}
              </h2>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap', marginTop: '8px' }}>
                {metaChip(Hash, customer.customerCode || customer.id || 'CUST')}
                {isLinked
                  ? metaChip(Zap, `Ledger Connected${customer.zohoContactId ? ` · ${customer.zohoContactId}` : customer.customerCode ? ` · ${customer.customerCode}` : ''}`, { fg: C.purple, bg: C.purpleSoft, border: C.purpleBorder })
                  : metaChip(Sparkles, 'BUSINZ Account', { fg: C.teal, bg: C.tealSoft, border: '#A5F3FC' })}
                {metaChip(User, repName || 'Unassigned')}
                {locationText !== '—' && metaChip(MapPin, locationText)}
                {customer.industry && metaChip(Building2, customer.industry)}
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
            <PrimaryButton icon={MessageSquare} color={C.green} onClick={() => (onOpenWhatsAppChat ? onOpenWhatsAppChat(customer) : onNavigateTab('WhatsApp Inbox'))}>
              WhatsApp Chat
            </PrimaryButton>
            <PrimaryButton icon={Edit3} onClick={() => onEditCustomer(customer)}>
              Edit Contact
            </PrimaryButton>
          </div>
        </div>

        {/* KPI strip */}
        <div className="c360-kpis" style={{ padding: '0 22px 18px' }}>
          {kpis.map(k => (
            <div key={k.label} className="c360-kpi" style={{ backgroundColor: '#FFFFFF', border: `1px solid ${C.line}`, borderRadius: '12px', padding: '12px 14px', display: 'flex', alignItems: 'center', gap: '12px', transition: 'border-color 0.15s ease' }}>
              <span style={{ width: '38px', height: '38px', borderRadius: '10px', backgroundColor: k.bg, color: k.fg, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <k.icon size={18} />
              </span>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: '10.5px', fontWeight: '800', color: C.muted, textTransform: 'uppercase', letterSpacing: '0.5px' }}>{k.label}</div>
                <div style={{ fontSize: '18px', fontWeight: '900', color: C.ink, lineHeight: 1.2, whiteSpace: 'nowrap' }}>{k.value}</div>
                <div style={{ fontSize: '11px', color: C.faint, fontWeight: '600' }}>{k.sub}</div>
              </div>
            </div>
          ))}
        </div>
      </Card>

      {/* ─── MAIN WORKSPACE ─── */}
      <div className="c360-grid">

        {/* LEFT: PROFILE & CONTACT */}
        <div className="c360-sticky" style={{ display: 'flex', flexDirection: 'column', gap: '14px', minWidth: 0 }}>

          {/* Primary contact + quick actions */}
          <Card>
            <div style={{ padding: '16px', display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div style={{ width: '44px', height: '44px', borderRadius: '50%', backgroundColor: C.tealSoft, color: C.teal, border: `1px solid ${C.tealBorder}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '16px', fontWeight: '800', flexShrink: 0 }}>
                {(contactName || customer.companyName || 'C').charAt(0)}
              </div>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: '14px', fontWeight: '800', color: C.ink, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{contactName || customer.companyName || '—'}</div>
                <div style={{ fontSize: '11.5px', color: C.muted, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {customer.primaryContact?.designation || customer.designation || '—'}
                </div>
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: '4px', padding: '12px 10px 14px', borderTop: `1px solid ${C.lineSoft}` }}>
              {quickActions.map(a => (
                <div key={a.label} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '5px' }}>
                  <button
                    type="button"
                    className="c360-btn c360-quick"
                    onClick={a.onClick}
                    title={a.label}
                    style={{ width: '36px', height: '36px', borderRadius: '50%', backgroundColor: a.bg, border: `1px solid ${a.border}`, color: a.fg, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
                  >
                    <a.icon size={15} />
                  </button>
                  <span style={{ fontSize: '10px', color: C.muted, fontWeight: '700' }}>{a.label}</span>
                </div>
              ))}
            </div>
          </Card>

          {/* Contact Information (Core accounting fields) */}
          <Card>
            <CardHeader
              icon={User}
              title="Contact Information"
              subtitle="Synced with Central Accounting"
              borderless={!isContactInfoExpanded}
              onClick={() => setIsContactInfoExpanded(!isContactInfoExpanded)}
              right={
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <SourceChip type="ledger" />
                  {isContactInfoExpanded ? <ChevronDown size={16} color={C.faint} /> : <ChevronRight size={16} color={C.faint} />}
                </div>
              }
            />
            {isContactInfoExpanded && (
              <div style={{ padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <InfoRow icon={User} label="Contact Name" value={customer.primaryContact?.name || customer.customerName || '—'} />
                <InfoRow icon={Building2} label="Company" value={customer.companyName || '—'} />
                <InfoRow icon={Mail} label="Email" value={customer.primaryContact?.email || customer.email || '—'} />
                <InfoRow icon={Phone} label="Phone" value={customer.primaryContact?.phone || customer.phone || '—'} />
                <InfoRow icon={Briefcase} label="Designation / Role" value={customer.primaryContact?.designation || customer.designation || '—'} />
                <InfoRow icon={MapPin} label="Location" value={locationText} />
                <InfoRow icon={Zap} label="Lead Source" value={customer.source || '—'} />
              </div>
            )}
          </Card>

          {/* Account profile (BUSINZ CRM fields) */}
          <Card>
            <CardHeader icon={Sparkles} title="Account Profile" subtitle="BUSINZ CRM intelligence" right={<SourceChip type="businz" />} />
            <div style={{ padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <InfoRow icon={User} label="Lead Owner" value={repName || 'Unassigned'} valueColor={repName ? C.teal : C.muted} />
              <InfoRow
                icon={Tag}
                label="Tags & Industry"
                value={
                  <span style={{ display: 'inline-flex', gap: '4px', flexWrap: 'wrap', marginTop: '2px' }}>
                    {[customer.customerType, customer.industry].filter(Boolean).map(t => (
                      <span key={t} style={{ backgroundColor: C.lineSoft, color: '#475569', padding: '2px 8px', borderRadius: '50px', fontSize: '11px', fontWeight: '700' }}>{t}</span>
                    ))}
                    {!customer.customerType && !customer.industry && '—'}
                  </span>
                }
              />
              <InfoRow
                icon={CreditCard}
                label="Credit Limit & Terms"
                value={
                  hasCreditLimit
                    ? `₹ ${Number(customer.creditLimit).toLocaleString()}${customer.creditDays ? ` • ${customer.creditDays} Days` : (customer.paymentTerms ? ` • ${customer.paymentTerms}` : '')}`
                    : (customer.paymentTerms ? `${customer.paymentTerms}${customer.creditDays ? ` • ${customer.creditDays} Days` : ''}` : (customer.creditDays ? `${customer.creditDays} Days` : '—'))
                }
                valueColor={hasCreditLimit ? '#059669' : C.body}
              />
            </div>
          </Card>
        </div>

        {/* CENTER: TABS & WORKSPACE */}
        <Card style={{ display: 'flex', flexDirection: 'column', minWidth: 0, minHeight: '560px' }}>
          {/* Pill tab strip */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px', borderBottom: `1px solid ${C.line}`, overflowX: 'auto', padding: '10px 12px' }}>
            {profileTabs.map(tab => {
              const isActive = profileTab === tab.key;
              const TabIcon = tab.icon;
              return (
                <button
                  key={tab.key}
                  type="button"
                  className={isActive ? undefined : 'c360-tab'}
                  onClick={() => setProfileTab(tab.key)}
                  style={{
                    padding: '7px 12px', border: 'none', borderRadius: '8px',
                    backgroundColor: isActive ? C.teal : 'transparent',
                    color: isActive ? '#FFFFFF' : C.muted,
                    fontWeight: isActive ? '800' : '700', fontSize: '12.5px',
                    cursor: 'pointer', whiteSpace: 'nowrap', display: 'inline-flex', alignItems: 'center', gap: '6px',
                    transition: 'background-color 0.15s ease, color 0.15s ease',
                    boxShadow: isActive ? '0 2px 6px rgba(14, 116, 144, 0.25)' : 'none'
                  }}
                >
                  <TabIcon size={14} />
                  {tab.key}
                  {tab.count > 0 && (
                    <span style={{
                      fontSize: '10px', fontWeight: '800', padding: '0 6px', borderRadius: '10px', lineHeight: '16px',
                      backgroundColor: isActive ? 'rgba(255,255,255,0.25)' : C.lineSoft,
                      color: isActive ? '#FFFFFF' : C.body
                    }}>
                      {tab.count}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {/* Tab body */}
          <div style={{ padding: '20px', flex: 1, backgroundColor: '#FCFDFE' }}>

            {/* 1. TIMELINE */}
            {profileTab === 'Timeline' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
                <TabHeading title="Activity & Touchpoint Timeline" subtitle="Audit stream synchronized with BUSINZ ERP" />
                {timelineEvents.length === 0 ? (
                  <EmptyState
                    icon={Activity}
                    title="No timeline events"
                    text={`No activity recorded for ${customer.companyName} yet. Interactions, quotations, deals, and follow-ups will appear here as they are created.`}
                  />
                ) : (
                  <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', gap: '14px' }}>
                    <div style={{ position: 'absolute', left: '17px', top: '18px', bottom: '18px', width: '2px', backgroundColor: C.line }} />
                    {timelineEvents.map((ev, i) => (
                      <div key={i} style={{ display: 'flex', gap: '14px', position: 'relative' }}>
                        <span style={{ width: '36px', height: '36px', borderRadius: '50%', backgroundColor: '#FFFFFF', border: `2px solid ${ev.color}`, color: ev.color, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, zIndex: 1 }}>
                          <ev.icon size={15} />
                        </span>
                        <div className="c360-row" style={{ backgroundColor: '#FFFFFF', padding: '12px 16px', borderRadius: '10px', border: `1px solid ${C.line}`, flex: 1, transition: 'all 0.15s ease' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '10px', marginBottom: '4px' }}>
                            <strong style={{ fontSize: '13px', color: C.ink }}>{ev.title}</strong>
                            <span style={{ fontSize: '10.5px', color: C.muted, backgroundColor: C.lineSoft, padding: '2px 8px', borderRadius: '50px', fontWeight: '700', whiteSpace: 'nowrap' }}>{ev.meta}</span>
                          </div>
                          <p style={{ fontSize: '12.5px', color: '#475569', margin: 0, lineHeight: 1.5 }}>{ev.body}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* 2. TASKS */}
            {profileTab === 'Tasks' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <TabHeading
                  title="Customer Follow-ups & Tasks"
                  subtitle={`${pendingTasks} pending · ${currentTasks.length - pendingTasks} completed`}
                />

                <div style={{ backgroundColor: '#FFFFFF', padding: '12px', borderRadius: '10px', border: `1px solid ${C.line}`, display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
                  <input
                    type="text"
                    placeholder="What task needs to be completed for this customer?"
                    value={newTaskInput}
                    onChange={(e) => setNewTaskInput(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleAddCustomerTask(custKey)}
                    style={{ flex: 1, minWidth: '200px', border: '1px solid #CBD5E1', borderRadius: '8px', padding: '9px 12px', fontSize: '13px', outline: 'none' }}
                  />
                  <input
                    type="date"
                    value={newTaskDueDate}
                    onChange={(e) => setNewTaskDueDate(e.target.value)}
                    style={{ border: '1px solid #CBD5E1', borderRadius: '8px', padding: '8px 10px', fontSize: '12px', outline: 'none' }}
                  />
                  <PrimaryButton icon={Plus} onClick={() => handleAddCustomerTask(custKey)}>Add Task</PrimaryButton>
                </div>

                {currentTasks.length === 0 ? (
                  <EmptyState
                    icon={CheckCircle2}
                    title="No follow-up tasks"
                    text={`No tasks scheduled for ${customer.companyName}. Add a task above to schedule follow-ups.`}
                  />
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {currentTasks.map(task => (
                      <div
                        key={task.id}
                        className="c360-row"
                        style={{
                          backgroundColor: task.completed ? C.bg : '#FFFFFF', padding: '12px 14px', borderRadius: '10px',
                          border: `1px solid ${C.line}`, borderLeft: `4px solid ${task.completed ? '#CBD5E1' : C.teal}`,
                          display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', transition: 'all 0.15s ease'
                        }}
                      >
                        <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', minWidth: 0 }}>
                          <input
                            type="checkbox"
                            checked={task.completed}
                            onChange={() => handleToggleCustomerTask(custKey, task.id)}
                            style={{ accentColor: C.teal, cursor: 'pointer', width: '16px', height: '16px', flexShrink: 0 }}
                          />
                          <span style={{ fontSize: '13px', fontWeight: task.completed ? '500' : '700', color: task.completed ? C.muted : C.ink, textDecoration: task.completed ? 'line-through' : 'none' }}>
                            {task.text}
                          </span>
                        </label>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
                          <span style={{ fontSize: '11px', color: C.muted, backgroundColor: C.lineSoft, padding: '3px 8px', borderRadius: '50px', fontWeight: '700', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                            <Calendar size={11} /> {task.dueDate}
                          </span>
                          <button
                            type="button"
                            onClick={() => handleDeleteCustomerTask(custKey, task.id)}
                            title="Delete task"
                            style={{ background: 'none', border: 'none', color: C.faint, cursor: 'pointer', padding: '4px', display: 'flex', borderRadius: '6px' }}
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* 3. NOTES */}
            {profileTab === 'Notes' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <TabHeading title="Internal CRM Account Notes" subtitle="Shared with sales & engineering reps" />

                <div style={{ backgroundColor: '#FFFFFF', padding: '14px', borderRadius: '10px', border: `1px solid ${C.line}`, display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  <textarea
                    rows={3}
                    placeholder="Write an internal note, meeting minutes, or project update for this customer..."
                    value={newNoteInput}
                    onChange={(e) => setNewNoteInput(e.target.value)}
                    style={{ width: '100%', border: '1px solid #CBD5E1', borderRadius: '8px', padding: '10px 12px', fontSize: '13px', outline: 'none', resize: 'vertical', boxSizing: 'border-box', fontFamily: 'inherit' }}
                  />
                  <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                    <PrimaryButton icon={Send} onClick={() => handleAddCustomerNote(custKey)}>Post Note</PrimaryButton>
                  </div>
                </div>

                {currentNotes.length === 0 ? (
                  <EmptyState
                    icon={FileText}
                    title="No account notes"
                    text={`No internal notes added for ${customer.companyName} yet. Use the field above to record updates.`}
                  />
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    {currentNotes.map(note => (
                      <div key={note.id} className="c360-row" style={{ backgroundColor: '#FFFFFF', padding: '14px 16px', borderRadius: '10px', border: `1px solid ${C.line}`, display: 'flex', gap: '12px', transition: 'all 0.15s ease' }}>
                        <span style={{ width: '32px', height: '32px', borderRadius: '50%', backgroundColor: C.tealSoft, color: C.teal, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: '13px', fontWeight: '800', flexShrink: 0 }}>
                          {(note.author || 'N').charAt(0)}
                        </span>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '10px', marginBottom: '4px' }}>
                            <span style={{ fontSize: '12.5px', fontWeight: '800', color: C.ink }}>{note.author}</span>
                            <span style={{ fontSize: '11px', color: C.faint, whiteSpace: 'nowrap' }}>{note.date}</span>
                          </div>
                          <p style={{ fontSize: '13px', color: C.body, margin: 0, lineHeight: 1.55 }}>{note.text}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* 4. QUOTATIONS */}
            {profileTab === 'Quotations' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <TabHeading
                  title="Commercial Quotations"
                  subtitle={custQuotations.length > 0 ? `${custQuotations.length} quotation(s) · ${formatINR(quotationsValue)} total` : undefined}
                  action={<PrimaryButton small icon={Plus} onClick={() => onNavigateTab('Quotations')}>New Quotation</PrimaryButton>}
                />

                {custQuotations.length === 0 ? (
                  <EmptyState
                    icon={Receipt}
                    title="No quotations yet"
                    text={`No commercial quotations have been generated for ${customer.companyName} yet.`}
                    actionLabel="Generate Solar Structure Quotation"
                    onAction={() => onNavigateTab('Quotations')}
                  />
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {custQuotations.map((q, idx) => (
                      <div key={q.id || idx} className="c360-row" style={{ backgroundColor: '#FFFFFF', padding: '12px 14px', borderRadius: '10px', border: `1px solid ${C.line}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', flexWrap: 'wrap', transition: 'all 0.15s ease' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                          <span style={{ width: '34px', height: '34px', borderRadius: '9px', backgroundColor: C.greenSoft, color: C.green, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
                            <Receipt size={16} />
                          </span>
                          <div>
                            <div style={{ fontWeight: '800', color: C.ink, fontSize: '13px' }}>{q.quotationNumber || `QUOTE-${idx + 1}`}</div>
                            <div style={{ fontSize: '11.5px', color: C.muted }}>
                              Date: {q.date || '—'}{q.validUntil ? ` • Valid until: ${q.validUntil}` : ''}
                            </div>
                          </div>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                          <span style={{ fontSize: '14px', fontWeight: '900', color: C.ink }}>₹ {quoteAmount(q).toLocaleString()}</span>
                          <span style={{ fontSize: '11px', backgroundColor: '#DCFCE7', color: C.green, padding: '2px 10px', borderRadius: '50px', fontWeight: '800' }}>{q.status || 'Active'}</span>
                          <button
                            type="button"
                            className="c360-btn"
                            onClick={() => onNavigateTab('Quotations')}
                            style={{ padding: '5px 12px', backgroundColor: '#FFFFFF', border: '1px solid #CBD5E1', color: C.body, borderRadius: '8px', fontSize: '11.5px', fontWeight: '700', cursor: 'pointer' }}
                          >
                            View
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* 5. WHATSAPP */}
            {profileTab === 'WhatsApp Chat' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <TabHeading
                  title="WhatsApp Business Messenger"
                  action={
                    (customer.primaryContact?.whatsapp || customer.primaryContact?.phone || customer.phone) ? (
                      <span style={{ fontSize: '11.5px', color: C.green, fontWeight: '800', display: 'inline-flex', alignItems: 'center', gap: '6px', backgroundColor: C.greenSoft, border: '1px solid #BBF7D0', padding: '3px 10px', borderRadius: '50px' }}>
                        <span style={{ width: '7px', height: '7px', borderRadius: '50%', backgroundColor: C.green }} /> Registered Number
                      </span>
                    ) : (
                      <span style={{ fontSize: '11.5px', color: C.muted, fontWeight: '700', display: 'inline-flex', alignItems: 'center', gap: '6px', backgroundColor: C.lineSoft, padding: '3px 10px', borderRadius: '50px' }}>
                        No Number
                      </span>
                    )
                  }
                />
                <div style={{ backgroundColor: '#FFFFFF', padding: '20px', borderRadius: '12px', border: `1px solid ${C.line}`, display: 'flex', flexDirection: 'column', gap: '14px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div style={{ width: '44px', height: '44px', borderRadius: '50%', backgroundColor: '#DCFCE7', color: C.green, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <MessageSquare size={20} />
                    </div>
                    <div>
                      <div style={{ fontWeight: '800', color: C.ink, fontSize: '14px' }}>{customer.primaryContact?.name || customer.customerName || customer.companyName}</div>
                      <div style={{ fontSize: '12px', color: C.muted }}>WhatsApp: {customer.primaryContact?.whatsapp || customer.primaryContact?.phone || customer.phone || 'Not Registered'}</div>
                    </div>
                  </div>
                  {(customer.primaryContact?.whatsapp || customer.primaryContact?.phone || customer.phone) ? (
                    <button
                      type="button"
                      className="c360-btn"
                      onClick={() => (onOpenWhatsAppChat ? onOpenWhatsAppChat(customer) : onNavigateTab('WhatsApp Inbox'))}
                      style={{ backgroundColor: C.green, color: '#FFFFFF', border: 'none', padding: '12px', borderRadius: '10px', fontSize: '13px', fontWeight: '800', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', boxShadow: '0 4px 10px rgba(22, 163, 74, 0.25)' }}
                    >
                      <MessageSquare size={16} /> Open in WhatsApp Inbox
                    </button>
                  ) : (
                    <div style={{ color: C.muted, fontSize: '12.5px', padding: '8px 0' }}>
                      No contact number registered for this customer. Please update customer profile with a mobile or WhatsApp number.
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* 6. BOM ORDERS */}
            {profileTab === 'BOM Orders' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <TabHeading
                  title="Linked Bills of Materials (BOM)"
                  subtitle={custBoms.length > 0 ? `${custBoms.length} BOM order(s) generated for ${customer.companyName}` : undefined}
                  action={<PrimaryButton small icon={Plus} onClick={() => onNavigateTab('Sales BOM')}>Create Sales BOM</PrimaryButton>}
                />
                {custBoms.length === 0 ? (
                  <EmptyState
                    icon={Layers}
                    title="No BOM Orders Found"
                    text={`No Bill of Materials (BOM) orders have been generated for ${customer.companyName} yet.`}
                    actionLabel="Create Sales BOM"
                    onAction={() => onNavigateTab('Sales BOM')}
                  />
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {custBoms.map((bom, idx) => (
                      <div key={bom.id || idx} className="c360-row" style={{ backgroundColor: '#FFFFFF', padding: '12px 14px', borderRadius: '10px', border: `1px solid ${C.line}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', flexWrap: 'wrap', transition: 'all 0.15s ease' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                          <span style={{ width: '34px', height: '34px', borderRadius: '9px', backgroundColor: '#F0F9FF', color: '#0284C7', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
                            <Layers size={16} />
                          </span>
                          <div>
                            <div style={{ fontWeight: '800', color: C.ink, fontSize: '13px' }}>{bom.bomNumber || bom.bomCode || `BOM-${idx + 1}`}</div>
                            <div style={{ fontSize: '11.5px', color: C.muted }}>
                              {bom.projectName ? `Project: ${bom.projectName} • ` : ''}
                              Date: {bom.date || (bom.createdAt ? new Date(bom.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }) : 'Recent')}
                              {bom.totalWeight ? ` • ${bom.totalWeight} kg` : ''}
                            </div>
                          </div>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                          <span style={{ fontSize: '11px', backgroundColor: '#E0F2FE', color: '#0369A1', padding: '2px 10px', borderRadius: '50px', fontWeight: '800' }}>{bom.status || 'Active'}</span>
                          <button
                            type="button"
                            className="c360-btn"
                            onClick={() => onNavigateTab('Sales BOM')}
                            style={{ padding: '5px 12px', backgroundColor: '#FFFFFF', border: '1px solid #CBD5E1', color: C.body, borderRadius: '8px', fontSize: '11.5px', fontWeight: '700', cursor: 'pointer' }}
                          >
                            Open BOM
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* 7. OPPORTUNITIES */}
            {profileTab === 'Opportunities' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <TabHeading
                  title="Sales Deals & Pipelines"
                  subtitle={custDeals.length > 0 ? `${openDeals.length} open · ${formatINR(pipelineValue)} in pipeline` : undefined}
                  action={<PrimaryButton small icon={Plus} onClick={() => onNavigateTab('Opportunities')}>New Opportunity</PrimaryButton>}
                />

                {custDeals.length === 0 ? (
                  <EmptyState
                    icon={TrendingUp}
                    title="No opportunities yet"
                    text="No active opportunities recorded for this customer."
                    actionLabel="Add Opportunity to Sales Pipeline"
                    onAction={() => onNavigateTab('Opportunities')}
                  />
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {custDeals.map(opp => (
                      <div key={opp.id} className="c360-row" style={{ backgroundColor: '#FFFFFF', padding: '12px 14px', borderRadius: '10px', border: `1px solid ${C.line}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', flexWrap: 'wrap', transition: 'all 0.15s ease' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                          <span style={{ width: '34px', height: '34px', borderRadius: '9px', backgroundColor: C.tealSoft, color: C.teal, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
                            <TrendingUp size={16} />
                          </span>
                          <div>
                            <div style={{ fontWeight: '800', color: C.ink, fontSize: '13px' }}>{opp.title}</div>
                            <span style={{ fontSize: '11px', fontWeight: '800', color: C.teal, backgroundColor: C.tealSoft, border: `1px solid ${C.tealBorder}`, padding: '1px 8px', borderRadius: '50px', display: 'inline-block', marginTop: '3px' }}>
                              {opp.stage}
                            </span>
                          </div>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                          <span style={{ fontSize: '14px', fontWeight: '900', color: C.ink }}>₹ {Number(opp.dealValue || 0).toLocaleString()}</span>
                          <PrimaryButton small onClick={() => onNavigateTab('Opportunities')}>View Pipeline</PrimaryButton>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* 8. DETAILS: CORE ACCOUNTING VS BUSINZ ADD-ONS */}
            {profileTab === 'Details' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <TabHeading
                  title="Field-by-Field Breakdown: Core Accounting vs BUSINZ Add-ons"
                  subtitle="Distinguishes accounting data from engineering intelligence in BUSINZ."
                  action={<PrimaryButton icon={Edit3} onClick={() => onEditCustomer(customer)}>Modify Contact</PrimaryButton>}
                />

                <div className="c360-details">
                  <div style={{ backgroundColor: '#FFFFFF', borderRadius: '12px', border: `1px solid ${C.purpleBorder}`, overflow: 'hidden' }}>
                    <div style={{ padding: '12px 16px', backgroundColor: '#FAF5FF', borderBottom: `1px solid ${C.purpleSoft}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px' }}>
                      <h5 style={{ margin: 0, fontSize: '13px', fontWeight: '800', color: C.purple, display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <Zap size={14} /> Core Accounting (Synced)
                      </h5>
                      <span style={{ fontSize: '10px', backgroundColor: C.purpleSoft, color: C.purple, padding: '2px 8px', borderRadius: '50px', fontWeight: '800' }}>Required for Invoicing</span>
                    </div>
                    <div style={{ padding: '6px 16px 12px' }}>
                      <KeyValue label="Company Name" value={customer.companyName || '—'} />
                      <KeyValue label="Primary Contact" value={customer.primaryContact?.name || customer.customerName || '—'} />
                      <KeyValue label="Phone" value={customer.primaryContact?.phone || customer.phone || '—'} />
                      <KeyValue label="Email" value={customer.primaryContact?.email || customer.email || '—'} />
                      <KeyValue label="Billing Address" value={customer.address || '—'} />
                      <KeyValue label="City & State" value={[customer.city, customer.state].filter(Boolean).join(', ') + (customer.pincode ? ` - ${customer.pincode}` : '') || '—'} />
                      <KeyValue label="Dispatch Address" value={customer.dispatchAddress || (customer.address ? 'Same as billing address' : '—')} />
                      <KeyValue label="GSTIN" value={customer.gstNumber || '—'} mono />
                      <KeyValue label="PAN" value={customer.panNumber || '—'} mono />
                      <KeyValue label="Payment Terms" value={customer.paymentTerms || '—'} />
                      <KeyValue label="Contact ID" value={customer.zohoContactId || customer.customerCode || '—'} mono />
                    </div>
                  </div>

                  <div style={{ backgroundColor: '#FFFFFF', borderRadius: '12px', border: `1px solid ${C.tealBorder}`, overflow: 'hidden' }}>
                    <div style={{ padding: '12px 16px', backgroundColor: '#F0FDFF', borderBottom: `1px solid ${C.tealSoft}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px' }}>
                      <h5 style={{ margin: 0, fontSize: '13px', fontWeight: '800', color: C.teal, display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <Sparkles size={14} /> BUSINZ CRM Add-ons
                      </h5>
                      <span style={{ fontSize: '10px', backgroundColor: C.tealSoft, color: C.teal, padding: '2px 8px', borderRadius: '50px', fontWeight: '800' }}>Engineering & Sales CRM</span>
                    </div>
                    <div style={{ padding: '6px 16px 12px' }}>
                      <KeyValue label="Assigned Rep / Owner" value={repName || 'Unassigned'} valueColor={repName ? C.teal : C.muted} />
                      <KeyValue label="Customer Type" value={customer.customerType || '—'} />
                      <KeyValue label="Industry Domain" value={customer.industry || '—'} />
                      <KeyValue label="Credit Limit" value={hasCreditLimit ? `₹ ${Number(customer.creditLimit).toLocaleString()}` : '—'} valueColor={hasCreditLimit ? "#059669" : C.body} />
                      <KeyValue label="Credit Days Granted" value={customer.creditDays ? `${customer.creditDays} Days` : '—'} />
                      <KeyValue label="Preferred Channel" value={customer.preferredChannel || '—'} />
                      <KeyValue label="Internal Account Notes" value={customer.notes || '—'} />
                    </div>
                  </div>
                </div>
              </div>
            )}

          </div>
        </Card>

        {/* RIGHT: OVERVIEW, COMPANY, DEALS */}
        <div className="c360-right c360-sticky" style={{ minWidth: 0 }}>

          {/* Overview */}
          <Card>
            <CardHeader
              icon={Clock}
              title="Engagement Overview"
              borderless={!isOverviewOpen}
              onClick={() => setIsOverviewOpen(!isOverviewOpen)}
              right={isOverviewOpen ? <ChevronDown size={16} color={C.faint} /> : <ChevronRight size={16} color={C.faint} />}
            />
            {isOverviewOpen && (
              <div style={{ padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {overviewItems.map(item => (
                  <InfoRow key={item.label} icon={item.icon} label={item.label} value={item.value} />
                ))}
              </div>
            )}
          </Card>

          {/* Company & Accounting */}
          <Card>
            <CardHeader
              icon={Building2}
              title="Company & Accounting"
              borderless={!isCompanyOpen}
              onClick={() => setIsCompanyOpen(!isCompanyOpen)}
              right={
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <SourceChip type="ledger" />
                  {isCompanyOpen ? <ChevronDown size={16} color={C.faint} /> : <ChevronRight size={16} color={C.faint} />}
                </div>
              }
            />
            {isCompanyOpen && (
              <div style={{ padding: '6px 16px 14px' }}>
                <KeyValue
                  label="Ledger Status"
                  value={isLinked ? <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}><Zap size={11} /> Connected</span> : 'Not Synced'}
                  valueColor={isLinked ? C.purple : C.muted}
                />
                <KeyValue label="Contact ID" value={customer.zohoContactId || customer.customerCode || '—'} mono />
                <KeyValue label="GSTIN" value={customer.gstNumber || '—'} mono />
                <KeyValue label="PAN" value={customer.panNumber || '—'} mono />
                <KeyValue label="Payment Terms" value={customer.paymentTerms || '—'} valueColor={customer.paymentTerms ? "#B45309" : C.muted} />
                <KeyValue label="Credit Days" value={customer.creditDays ? `${customer.creditDays} Days` : '—'} />
                <KeyValue label="Credit Limit" value={hasCreditLimit ? `₹ ${Number(customer.creditLimit).toLocaleString()}` : '—'} valueColor={hasCreditLimit ? "#059669" : C.body} />
                <div style={{ paddingTop: '10px' }}>
                  <div style={{ fontSize: '10.5px', color: C.faint, fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.4px' }}>Billing Address</div>
                  <div style={{ fontSize: '12px', color: customer.address ? C.ink : C.muted, fontWeight: '600', marginTop: '3px', lineHeight: 1.45 }}>
                    {customer.address || '—'}
                  </div>
                </div>
              </div>
            )}
          </Card>

          {/* Open Deals */}
          <Card>
            <CardHeader
              icon={TrendingUp}
              title={`Open Deals (${custDeals.length})`}
              borderless={!isDealsOpen}
              onClick={() => setIsDealsOpen(!isDealsOpen)}
              right={isDealsOpen ? <ChevronDown size={16} color={C.faint} /> : <ChevronRight size={16} color={C.faint} />}
            />
            {isDealsOpen && (
              <div style={{ padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {custDeals.length === 0 ? (
                  <div style={{ color: C.muted, fontSize: '12px', textAlign: 'center', padding: '8px 0' }}>
                    <div>No open deals recorded.</div>
                  </div>
                ) : (
                  custDeals.map(deal => (
                    <div key={deal.id} className="c360-row" style={{ padding: '10px 12px', backgroundColor: C.bg, borderRadius: '10px', border: `1px solid ${C.line}`, transition: 'all 0.15s ease' }}>
                      <div style={{ fontWeight: '800', color: C.ink, fontSize: '12.5px' }}>{deal.title}</div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '6px' }}>
                        <span style={{ fontSize: '10.5px', fontWeight: '800', color: C.teal, backgroundColor: C.tealSoft, padding: '1px 8px', borderRadius: '50px' }}>{deal.stage}</span>
                        <span style={{ fontWeight: '900', color: C.ink, fontSize: '12.5px' }}>₹ {Number(deal.dealValue).toLocaleString()}</span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
