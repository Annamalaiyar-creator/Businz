import React, { useState, useEffect } from 'react';
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
  zoho: '#7E22CE',
  zohoSoft: '#F3E8FF',
  zohoBorder: '#E9D5FF',
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
  const isZoho = type === 'zoho';
  const Icon = isZoho ? Zap : Sparkles;
  return (
    <span style={{
      fontSize: '10px', fontWeight: '800', letterSpacing: '0.3px',
      padding: '2px 8px', borderRadius: '50px',
      backgroundColor: isZoho ? C.zohoSoft : C.tealSoft,
      color: isZoho ? C.zoho : C.teal,
      border: `1px solid ${isZoho ? C.zohoBorder : C.tealBorder}`,
      display: 'inline-flex', alignItems: 'center', gap: '4px', whiteSpace: 'nowrap'
    }}>
      <Icon size={10} /> {isZoho ? 'ZOHO BOOKS' : 'BUSINZ CRM'}
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

  const currentTasks = customerTasks[custKey] || [
    { id: 'def_1', text: 'Verify GSTIN & billing address with finance team', dueDate: 'Today', completed: true },
    { id: 'def_2', text: `Schedule Solar structure proposal review with ${customer.primaryContact?.name || customer.companyName}`, dueDate: 'Tomorrow', completed: false },
    { id: 'def_3', text: 'Share technical BOM specifications & preliminary GA drawing', dueDate: '12 Sep', completed: false }
  ];

  const currentNotes = customerNotes[custKey] || [
    { id: 'def_n1', author: customer.assignedSalesperson || customer.salesPerson || activeAccountUser, date: '08 Sep, 2026 01:15 PM', text: `Initial customer onboarding completed. Commercial terms set to ${customer.paymentTerms || '50% Advance + 50% Dispatch'}. Ready for sales BOM generation.` },
    { id: 'def_n2', author: 'System Sync', date: '08 Sep, 2026 12:59 PM', text: customer.source === 'Zoho Books' ? 'Contact details imported and verified via Zoho Books API v2.' : 'Direct customer registration initialized in BUSINZ.' }
  ];

  const custQuotations = quotations.filter(q =>
    (q.customerName && q.customerName.toLowerCase() === customer.companyName.toLowerCase()) ||
    (q.companyName && q.companyName.toLowerCase() === customer.companyName.toLowerCase()) ||
    (customer.customerCode && q.customerCode === customer.customerCode)
  );

  const custDeals = opportunities.filter(o =>
    o.customerId === customer.id ||
    o.companyName === customer.companyName
  );

  // ─── Derived display values (read-only, no business logic changes) ───
  const repName = customer.assignedSalesperson || customer.salesPerson || activeAccountUser;
  const contactName = customer.primaryContact?.name || customer.customerName || customer.companyName;
  const isZohoLinked = customer.source === 'Zoho Books' || !!customer.zohoContactId;
  const quoteAmount = (q) => Number(q.totalAmount || q.amount || 1500000);
  const openDeals = custDeals.filter(d => d.stage !== 'Won' && d.stage !== 'Lost');
  const pipelineValue = openDeals.reduce((s, d) => s + (Number(d.dealValue) || 0), 0);
  const quotationsValue = custQuotations.reduce((s, q) => s + quoteAmount(q), 0);
  const pendingTasks = currentTasks.filter(t => !t.completed).length;
  const locationText = [customer.city, customer.state].filter(Boolean).join(', ') || '—';

  const profileTabs = [
    { key: 'Timeline', icon: Activity },
    { key: 'Tasks', icon: CheckCircle2, count: pendingTasks },
    { key: 'Notes', icon: FileText, count: currentNotes.length },
    { key: 'Quotations', icon: Receipt, count: custQuotations.length },
    { key: 'WhatsApp Chat', icon: MessageSquare },
    { key: 'BOM Orders', icon: Layers },
    { key: 'Opportunities', icon: TrendingUp, count: custDeals.length },
    { key: 'Details', icon: Info }
  ];

  const kpis = [
    { label: 'Open Pipeline', value: formatINR(pipelineValue), sub: `${openDeals.length} open deal${openDeals.length === 1 ? '' : 's'}`, icon: TrendingUp, fg: C.teal, bg: C.tealSoft },
    { label: 'Quotations', value: formatINR(quotationsValue), sub: `${custQuotations.length} issued`, icon: Receipt, fg: C.green, bg: C.greenSoft },
    { label: 'Pending Tasks', value: String(pendingTasks), sub: `${currentTasks.length} total follow-ups`, icon: CheckCircle2, fg: '#A21CAF', bg: '#FDF4FF' },
    { label: 'Credit Limit', value: formatINR(customer.creditLimit || 2500000), sub: `${customer.creditDays || 30} days credit`, icon: Wallet, fg: C.amber, bg: C.amberSoft }
  ];

  const quickActions = [
    { label: 'Email', icon: Mail, fg: C.teal, bg: '#F0FDFA', border: '#CCFBF1', onClick: () => window.open(`mailto:${customer.primaryContact?.email || ''}`) },
    { label: 'Call', icon: Phone, fg: '#2563EB', bg: '#EFF6FF', border: '#DBEAFE', onClick: () => window.open(`tel:${customer.primaryContact?.phone || ''}`) },
    { label: 'Task', icon: CheckCircle2, fg: '#A21CAF', bg: '#FDF4FF', border: '#F5D0FE', onClick: () => setProfileTab('Tasks') },
    { label: 'WhatsApp', icon: MessageSquare, fg: C.green, bg: C.greenSoft, border: '#DCFCE7', onClick: () => (onOpenWhatsAppChat ? onOpenWhatsAppChat(customer) : onNavigateTab('WhatsApp Inbox')) },
    { label: 'Notes', icon: FileText, fg: C.amber, bg: C.amberSoft, border: '#FEF3C7', onClick: () => setProfileTab('Notes') },
    { label: 'More', icon: MoreHorizontal, fg: C.muted, bg: C.bg, border: C.line, onClick: () => onEditCustomer(customer) }
  ];

  const timelineEvents = [
    {
      icon: User, color: C.teal, title: 'Account Active in BUSINZ', meta: 'Today',
      body: <>Assigned to Lead Owner <strong>{repName}</strong>. Commercial terms configured for B2B solar structure dispatch.</>
    },
    {
      icon: Zap, color: C.zoho, title: 'Zoho Books Integration Link', meta: 'Zoho API v2',
      body: <>Contact synchronized with Zoho Books Contact ID: <strong>{customer.zohoContactId || 'ZOHO_AUTO_LINKED'}</strong>. Accounting ledgers and invoices connected.</>
    },
    {
      icon: ShieldCheck, color: '#10B981', title: 'Payment & Commercial Terms Verified', meta: 'Finance Checked',
      body: <>Payment Terms: <strong>{customer.paymentTerms || '50% Advance + 50% Dispatch'}</strong> • Credit Days: <strong>{customer.creditDays || 30} Days</strong>.</>
    },
    {
      icon: MapPin, color: '#F59E0B', title: 'Dispatch & KYC Location Confirmed', meta: 'Dispatch Gate',
      body: <>GSTIN: <strong>{customer.gstNumber || 'Unregistered'}</strong> • Address: {customer.address || 'Standard Plant Dispatch'}</>
    }
  ];

  const overviewItems = [
    { icon: Calendar, label: 'Created At', value: customer.createdAt ? new Date(customer.createdAt).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '08 Sep, 2026 12:59 PM' },
    { icon: Clock, label: 'Last Communication', value: 'Today, 11:30 AM' },
    { icon: Mail, label: 'Last Email Sent', value: '08 Sep, 2026' },
    { icon: Phone, label: 'Last Call Done', value: 'Yesterday, 04:15 PM' },
    { icon: CheckCircle2, label: 'Last Touchpoint', value: 'WhatsApp Quotation Follow-up' },
    { icon: MessageSquare, label: 'Preferred Channel', value: 'WhatsApp Business' },
    { icon: Clock, label: 'Best Time to Call', value: '02:30 PM - 05:00 PM' }
  ];

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
                {metaChip(Hash, customer.customerCode || customer.id)}
                {isZohoLinked
                  ? metaChip(Zap, `Zoho Connected${customer.zohoContactId ? ` · ${customer.zohoContactId}` : ''}`, { fg: C.zoho, bg: C.zohoSoft, border: C.zohoBorder })
                  : metaChip(Sparkles, 'BUSINZ Account', { fg: C.teal, bg: C.tealSoft, border: '#A5F3FC' })}
                {metaChip(User, repName)}
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
              Edit & Sync to Zoho
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
                {contactName?.charAt(0) || 'C'}
              </div>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: '14px', fontWeight: '800', color: C.ink, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{contactName}</div>
                <div style={{ fontSize: '11.5px', color: C.muted, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {customer.primaryContact?.designation || 'Purchase / Commercial Head'}
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

          {/* Contact Information (Zoho core fields) */}
          <Card>
            <CardHeader
              icon={User}
              title="Contact Information"
              subtitle="Synced with Zoho Books"
              borderless={!isContactInfoExpanded}
              onClick={() => setIsContactInfoExpanded(!isContactInfoExpanded)}
              right={
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <SourceChip type="zoho" />
                  {isContactInfoExpanded ? <ChevronDown size={16} color={C.faint} /> : <ChevronRight size={16} color={C.faint} />}
                </div>
              }
            />
            {isContactInfoExpanded && (
              <div style={{ padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <InfoRow icon={User} label="Contact Name" value={customer.primaryContact?.name || customer.customerName || '—'} />
                <InfoRow icon={Building2} label="Company" value={customer.companyName} />
                <InfoRow icon={Mail} label="Email" value={customer.primaryContact?.email || '—'} />
                <InfoRow icon={Phone} label="Phone" value={customer.primaryContact?.phone || '—'} />
                <InfoRow icon={Briefcase} label="Designation / Role" value={customer.primaryContact?.designation || 'Purchase / Commercial Head'} />
                <InfoRow icon={MapPin} label="Location" value={locationText} />
                <InfoRow icon={Zap} label="Lead Source" value={customer.source || 'Zoho Books'} />
              </div>
            )}
          </Card>

          {/* Account profile (BUSINZ CRM fields) */}
          <Card>
            <CardHeader icon={Sparkles} title="Account Profile" subtitle="BUSINZ CRM intelligence" right={<SourceChip type="businz" />} />
            <div style={{ padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <InfoRow icon={User} label="Lead Owner" value={repName} valueColor={C.teal} />
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
              <InfoRow icon={CreditCard} label="Credit Limit & Terms" value={`₹ ${Number(customer.creditLimit || 2500000).toLocaleString()} • ${customer.creditDays || 30} Days`} valueColor="#059669" />
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
                            <div style={{ fontSize: '11.5px', color: C.muted }}>Date: {q.date || 'Recent'} • Valid for 15 Days</div>
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
                    <span style={{ fontSize: '11.5px', color: C.green, fontWeight: '800', display: 'inline-flex', alignItems: 'center', gap: '6px', backgroundColor: C.greenSoft, border: '1px solid #BBF7D0', padding: '3px 10px', borderRadius: '50px' }}>
                      <span style={{ width: '7px', height: '7px', borderRadius: '50%', backgroundColor: C.green }} /> Connected Number
                    </span>
                  }
                />
                <div style={{ backgroundColor: '#FFFFFF', padding: '20px', borderRadius: '12px', border: `1px solid ${C.line}`, display: 'flex', flexDirection: 'column', gap: '14px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div style={{ width: '44px', height: '44px', borderRadius: '50%', backgroundColor: '#DCFCE7', color: C.green, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <MessageSquare size={20} />
                    </div>
                    <div>
                      <div style={{ fontWeight: '800', color: C.ink, fontSize: '14px' }}>{customer.primaryContact?.name || customer.companyName}</div>
                      <div style={{ fontSize: '12px', color: C.muted }}>WhatsApp: {customer.primaryContact?.whatsapp || customer.primaryContact?.phone || 'Not Registered'}</div>
                    </div>
                  </div>
                  <div style={{ backgroundColor: C.greenSoft, border: '1px solid #BBF7D0', padding: '12px', borderRadius: '10px', fontSize: '12.5px', color: '#166534', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Lightbulb size={15} style={{ flexShrink: 0 }} />
                    You can launch direct WhatsApp conversations, share quotation PDFs, and dispatch notifications with 1-click.
                  </div>
                  <button
                    type="button"
                    className="c360-btn"
                    onClick={() => (onOpenWhatsAppChat ? onOpenWhatsAppChat(customer) : onNavigateTab('WhatsApp Inbox'))}
                    style={{ backgroundColor: C.green, color: '#FFFFFF', border: 'none', padding: '12px', borderRadius: '10px', fontSize: '13px', fontWeight: '800', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', boxShadow: '0 4px 10px rgba(22, 163, 74, 0.25)' }}
                  >
                    <MessageSquare size={16} /> Open in WhatsApp Inbox
                  </button>
                </div>
              </div>
            )}

            {/* 6. BOM ORDERS */}
            {profileTab === 'BOM Orders' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <TabHeading
                  title="Linked Bills of Materials (BOM)"
                  action={<PrimaryButton small icon={Plus} onClick={() => onNavigateTab('Sales BOM')}>Create Sales BOM</PrimaryButton>}
                />
                <EmptyState
                  icon={Layers}
                  title={`Engineered Solar Structures for ${customer.companyName}`}
                  text="Access technical BOM configurations, module presets, cold-formed section weights, and production orders generated for this client."
                  actionLabel="Open BOM Orders Center"
                  onAction={() => onNavigateTab('Sales BOM')}
                />
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

            {/* 8. DETAILS: ZOHO CORE VS BUSINZ ADD-ONS */}
            {profileTab === 'Details' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <TabHeading
                  title="Field-by-Field Breakdown: Zoho Books vs BUSINZ Add-ons"
                  subtitle="Distinguishes accounting data synchronized with Zoho Books from engineering intelligence in BUSINZ."
                  action={<PrimaryButton icon={Edit3} onClick={() => onEditCustomer(customer)}>Modify & Sync</PrimaryButton>}
                />

                <div className="c360-details">
                  <div style={{ backgroundColor: '#FFFFFF', borderRadius: '12px', border: `1px solid ${C.zohoBorder}`, overflow: 'hidden' }}>
                    <div style={{ padding: '12px 16px', backgroundColor: '#FAF5FF', borderBottom: `1px solid ${C.zohoSoft}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px' }}>
                      <h5 style={{ margin: 0, fontSize: '13px', fontWeight: '800', color: C.zoho, display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <Zap size={14} /> Zoho Books Core (Synced)
                      </h5>
                      <span style={{ fontSize: '10px', backgroundColor: C.zohoSoft, color: C.zoho, padding: '2px 8px', borderRadius: '50px', fontWeight: '800' }}>Required for Invoicing</span>
                    </div>
                    <div style={{ padding: '6px 16px 12px' }}>
                      <KeyValue label="Company Name" value={customer.companyName} />
                      <KeyValue label="Primary Contact" value={customer.primaryContact?.name || customer.customerName || '—'} />
                      <KeyValue label="Phone" value={customer.primaryContact?.phone || '—'} />
                      <KeyValue label="Email" value={customer.primaryContact?.email || '—'} />
                      <KeyValue label="Billing Address" value={customer.address || '—'} />
                      <KeyValue label="City & State" value={`${customer.city || '—'}, ${customer.state || ''} - ${customer.pincode || ''}`} />
                      <KeyValue label="Dispatch Address" value={customer.dispatchAddress || customer.address || 'Same as billing'} />
                      <KeyValue label="GSTIN" value={customer.gstNumber || 'Not Registered'} mono />
                      <KeyValue label="PAN" value={customer.panNumber || '—'} mono />
                      <KeyValue label="Payment Terms" value={customer.paymentTerms || '50% Advance + 50% Dispatch'} />
                      <KeyValue label="Zoho Contact ID" value={customer.zohoContactId || 'Auto-generated on Sync'} mono />
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
                      <KeyValue label="Assigned Rep / Owner" value={repName} valueColor={C.teal} />
                      <KeyValue label="Customer Type" value={customer.customerType || '—'} />
                      <KeyValue label="Industry Domain" value={customer.industry || '—'} />
                      <KeyValue label="Credit Limit" value={`₹ ${Number(customer.creditLimit || 2500000).toLocaleString()}`} valueColor="#059669" />
                      <KeyValue label="Credit Days Granted" value={`${customer.creditDays || 30} Days`} />
                      <KeyValue label="Preferred Channel" value="WhatsApp & Direct Call" />
                      <KeyValue label="Best Time to Call" value="10:00 AM - 1:00 PM" />
                      <KeyValue label="Engineering BOMs Linked" value="Active Solar Structural Orders" />
                      <KeyValue label="Internal Account Notes" value={customer.notes || 'B2B Client account.'} />
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
                  <SourceChip type="zoho" />
                  {isCompanyOpen ? <ChevronDown size={16} color={C.faint} /> : <ChevronRight size={16} color={C.faint} />}
                </div>
              }
            />
            {isCompanyOpen && (
              <div style={{ padding: '6px 16px 14px' }}>
                <KeyValue
                  label="Zoho Status"
                  value={<span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}><Zap size={11} /> Connected</span>}
                  valueColor={C.zoho}
                />
                <KeyValue label="Zoho Contact ID" value={customer.zohoContactId || 'AUTO_SYNCED'} mono />
                <KeyValue label="GSTIN" value={customer.gstNumber || 'Not Registered'} mono />
                <KeyValue label="PAN" value={customer.panNumber || '—'} mono />
                <KeyValue label="Payment Terms" value={customer.paymentTerms || '50% Advance'} valueColor="#B45309" />
                <KeyValue label="Credit Days" value={`${customer.creditDays || 30} Days`} />
                <KeyValue label="Credit Limit" value={`₹ ${Number(customer.creditLimit || 2500000).toLocaleString()}`} valueColor="#059669" />
                <div style={{ paddingTop: '10px' }}>
                  <div style={{ fontSize: '10.5px', color: C.faint, fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.4px' }}>Billing Address</div>
                  <div style={{ fontSize: '12px', color: C.ink, fontWeight: '600', marginTop: '3px', lineHeight: 1.45 }}>
                    {customer.address || 'Standard Registered Address'}
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
                    <div>No open deals currently recorded.</div>
                    <button
                      type="button"
                      className="c360-btn"
                      onClick={() => onNavigateTab('Opportunities')}
                      style={{ margin: '10px auto 0', padding: '5px 12px', backgroundColor: '#F0FDFA', border: '1px solid #CCFBF1', color: C.teal, borderRadius: '8px', fontSize: '11.5px', fontWeight: '800', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                    >
                      <Plus size={12} /> Create Deal
                    </button>
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
