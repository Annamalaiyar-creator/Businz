import React, { useState, useEffect, useMemo } from 'react';
import {
  ArrowLeft, MessageSquare, Edit3, Mail, Phone, CheckCircle2,
  FileText, MoreHorizontal, ChevronDown, ChevronRight,
  Calendar, Clock, Plus, Trash2, Send, Layers,
  Zap, Sparkles, User, MapPin, Building2, Briefcase, Tag,
  Receipt, TrendingUp, Activity, Info, Hash,
  ShieldCheck, PhoneCall, AlertTriangle, UserCheck, Flame,
  Compass, FileCheck2, RotateCcw, Check, FileCheck, ExternalLink, UserPlus, Lock
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
  amberSoft: '#FFFBEB',
  rose: '#E11D48',
  roseSoft: '#FFE4E6'
};

const parseCurrency = (val) => {
  if (typeof val === 'number') {
    return Number.isFinite(val) ? val : 0;
  }
  if (!val) return 0;
  const cleaned = String(val).replace(/[^0-9.-]/g, '');
  const n = parseFloat(cleaned);
  return Number.isFinite(n) ? n : 0;
};

const formatCurrency = (val) => {
  const num = parseCurrency(val);
  return `₹ ${num.toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
};

const formatINR = (n) => {
  const num = parseCurrency(n);
  if (num >= 10000000) return `₹ ${(num / 10000000).toFixed(2)} Cr`;
  if (num >= 100000) return `₹ ${(num / 100000).toFixed(1)} L`;
  return `₹ ${Math.round(num).toLocaleString('en-IN')}`;
};

const L360_STYLES = `
  .l360-details { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
  .l360-btn { transition: transform 0.15s ease, box-shadow 0.15s ease, background-color 0.15s ease; }
  .l360-btn:hover { transform: translateY(-1px); }
  .l360-tab:hover { color: ${C.teal} !important; background-color: ${C.tealSoft} !important; }
  .l360-row:hover { border-color: #A5F3FC !important; box-shadow: 0 2px 8px rgba(14, 116, 144, 0.06); }
  .l360-kpi:hover { border-color: #A5F3FC !important; }
  .stage-step { cursor: pointer; transition: all 0.2s ease; }
  .stage-step:hover { filter: brightness(0.96); transform: translateY(-1px); }
  @media (max-width: 960px) {
    .l360-kpis { grid-template-columns: repeat(2, minmax(0, 1fr)) !important; }
    .l360-details { grid-template-columns: 1fr; }
  }
`;

function Card({ children, style }) {
  return (
    <div style={{ backgroundColor: '#FFFFFF', borderRadius: '14px', border: `1px solid ${C.line}`, boxShadow: '0 1px 3px rgba(15, 23, 42, 0.04)', overflow: 'hidden', ...style }}>
      {children}
    </div>
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
          <h4 style={{ margin: 0, fontSize: '13.5px', fontWeight: '800', color: C.ink, letterSpacing: '-0.2px' }}>{title}</h4>
          {subtitle && <div style={{ fontSize: '11px', color: C.muted, marginTop: '2px' }}>{subtitle}</div>}
        </div>
      </div>
      {right}
    </div>
  );
}

function KeyValue({ label, value, mono, valueColor }) {
  return (
    <div style={{ padding: '8px 0', borderBottom: `1px solid ${C.lineSoft}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px' }}>
      <span style={{ fontSize: '11.5px', color: C.muted, fontWeight: '600' }}>{label}</span>
      <span style={{
        fontSize: '12.5px', fontWeight: '700', color: valueColor || C.ink, textAlign: 'right',
        fontFamily: mono ? "'JetBrains Mono', 'Fira Code', monospace" : 'inherit',
        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '65%'
      }}>
        {value || '—'}
      </span>
    </div>
  );
}

function InfoRow({ icon: Icon, label, value }) {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
      <span style={{ color: C.faint, marginTop: '2px', flexShrink: 0 }}><Icon size={14} /></span>
      <div style={{ minWidth: 0, flex: 1 }}>
        <div style={{ fontSize: '11px', color: C.muted, fontWeight: '600' }}>{label}</div>
        <div style={{ fontSize: '12.5px', color: C.ink, fontWeight: '700', marginTop: '1px', wordBreak: 'break-word' }}>{value || '—'}</div>
      </div>
    </div>
  );
}

function TabHeading({ title, subtitle, action }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', flexWrap: 'wrap', marginBottom: '4px' }}>
      <div>
        <h3 style={{ margin: 0, fontSize: '15px', fontWeight: '800', color: C.ink, letterSpacing: '-0.2px' }}>{title}</h3>
        {subtitle && <div style={{ fontSize: '12px', color: C.muted, marginTop: '2px' }}>{subtitle}</div>}
      </div>
      {action}
    </div>
  );
}

function PrimaryButton({ children, onClick, icon: Icon, color = C.teal, small }) {
  return (
    <button
      type="button"
      className="l360-btn"
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

export const LEAD_STAGES = [
  'New',
  'Assigned',
  'Contacted',
  'In Progress',
  'Opportunity',
  'Proposal Sent',
  'Converted',
  'Dropped'
];

export const STAGE_RANKS = {
  'new': 1,
  'assigned': 2,
  'contacted': 3,
  'in progress': 4,
  'process': 4,
  'opportunity': 5,
  'qualified': 5,
  'proposal sent': 6,
  'converted': 7,
  'won': 7,
  'dropped': 8,
  'lost': 8,
  'disqualified': 8
};

export function getStageRank(stage) {
  if (!stage) return 1;
  const key = String(stage).toLowerCase().trim();
  return STAGE_RANKS[key] || 1;
}

export function canTransitionStage(currentStage, nextStage) {
  return getStageRank(nextStage) >= getStageRank(currentStage);
}

export default function Lead360PageView({
  lead,
  onBack,
  onEditLead,
  onConvertToCustomer,
  onOpenWhatsAppChat,
  onNavigateTab,
  quotations = [],
  opportunities = [],
  boms = [],
  customers = [],
  activeAccountUser = '',
  userRole = 'Sales Executive',
  onUpdateStatus,
  onLogActivity,
  onAssign,
  onRefreshLead
}) {
  const effectiveRole = (userRole || (typeof window !== 'undefined' ? localStorage.getItem('controlroom_user_role') : '') || '').toLowerCase();
  const isCeo = ['ceo', 'md', 'managing director'].some(r => effectiveRole.includes(r));
  const isTechSupport = ['tech support', 'technical support', 'tech_support'].some(r => effectiveRole.includes(r));

  const [profileTab, setProfileTab] = useState('Timeline');

  // Proforma Invoices & Tax Invoices live store
  const [dbPis, setDbPis] = useState([]);
  const [dbInvoices, setDbInvoices] = useState([]);

  // Interactive Tasks & Notes inputs
  const [newTaskInput, setNewTaskInput] = useState('');
  const [newTaskDueDate, setNewTaskDueDate] = useState('');
  const [newNoteInput, setNewNoteInput] = useState('');

  // Quick Inline Call Log input state
  const [callSummary, setCallSummary] = useState('');
  const [callResponse, setCallResponse] = useState('');
  const [callDuration, setCallDuration] = useState('180');
  const [isSubmittingCall, setIsSubmittingCall] = useState(false);

  const leadKey = lead?.lead_number || lead?.id || 'lead_default_key';

  // Resolved Converted Customer ID & Status
  const resolvedCustCode = useMemo(() => {
    return lead?.converted_customer_code || lead?.convertedCustomerCode || lead?.converted_customer_id || (
      customers?.find(c => 
        (c.leadId && (c.leadId === lead?.id || c.leadId === lead?.lead_number)) ||
        (c.leadNumber && (c.leadNumber === lead?.lead_number || c.leadNumber === lead?.id)) ||
        (lead?.phone && c.phone === lead?.phone && (lead?.status === 'Converted' || c.companyName === lead?.company_name))
      )?.customerCode
    );
  }, [lead, customers]);

  const isConverted = Boolean(
    lead?.status === 'Converted' ||
    lead?.status === 'Won' ||
    lead?.is_converted ||
    lead?.converted_customer_code ||
    lead?.convertedCustomerCode ||
    lead?.converted_customer_id ||
    resolvedCustCode
  );

  const handleNavigateCustomer = (code) => {
    if (!code) return;
    if (typeof onNavigateTab === 'function') {
      onNavigateTab('Customers', { searchCustomer: code, targetCustomer: code });
    }
    window.dispatchEvent(new CustomEvent('controlroom_navigate_tab', {
      detail: { tab: 'Customers', searchCustomer: code, targetCustomer: code }
    }));
  };

  // Lead Tasks & Notes store
  const [leadTasks, setLeadTasks] = useState({});
  const [leadNotes, setLeadNotes] = useState({});

  useEffect(() => {
    let active = true;
    Promise.all([
      fetchCloudStore('crm_lead_tasks', {}),
      fetchCloudStore('crm_lead_notes', {})
    ]).then(([tasks, notes]) => {
      if (active) {
        if (tasks && typeof tasks === 'object' && !Array.isArray(tasks)) setLeadTasks(tasks);
        if (notes && typeof notes === 'object' && !Array.isArray(notes)) setLeadNotes(notes);
      }
    });

    // Load Proforma Invoices
    fetch('/api/proforma-invoices')
      .then(r => r.json())
      .then(json => {
        if (!active) return;
        if (json?.success && Array.isArray(json.data)) {
          setDbPis(json.data);
        } else {
          try {
            const raw = localStorage.getItem('controlroom_sales_pi_store') || localStorage.getItem('sales_pi_store') || localStorage.getItem('proforma_invoice_store');
            if (raw) setDbPis(JSON.parse(raw));
          } catch (_) {}
        }
      })
      .catch(() => {
        if (!active) return;
        try {
          const raw = localStorage.getItem('controlroom_sales_pi_store') || localStorage.getItem('sales_pi_store') || localStorage.getItem('proforma_invoice_store');
          if (raw) setDbPis(JSON.parse(raw));
        } catch (_) {}
      });

    // Load Tax Invoices
    fetchCloudStore('invoice_store', []).then(invs => {
      if (!active) return;
      if (Array.isArray(invs) && invs.length > 0) {
        setDbInvoices(invs);
      } else {
        try {
          const raw = localStorage.getItem('controlroom_invoice_store') || localStorage.getItem('invoice_store');
          if (raw) setDbInvoices(JSON.parse(raw));
        } catch (_) {}
      }
    }).catch(() => {
      if (!active) return;
      try {
        const raw = localStorage.getItem('controlroom_invoice_store') || localStorage.getItem('invoice_store');
        if (raw) setDbInvoices(JSON.parse(raw));
      } catch (_) {}
    });

    return () => { active = false; };
  }, []);

  const handleAddLeadTask = (id) => {
    if (!newTaskInput.trim()) return;
    const taskObj = {
      id: 'task_' + Date.now(),
      text: newTaskInput.trim(),
      dueDate: newTaskDueDate || new Date().toISOString().split('T')[0],
      completed: false,
      createdAt: new Date().toISOString()
    };
    const updated = {
      ...leadTasks,
      [id]: [taskObj, ...(leadTasks[id] || [])]
    };
    setLeadTasks(updated);
    saveCloudStore('crm_lead_tasks', updated);
    setNewTaskInput('');
    setNewTaskDueDate('');
  };

  const handleToggleLeadTask = (id, taskId) => {
    const list = leadTasks[id] || [];
    const updated = {
      ...leadTasks,
      [id]: list.map(t => t.id === taskId ? { ...t, completed: !t.completed } : t)
    };
    setLeadTasks(updated);
    saveCloudStore('crm_lead_tasks', updated);
  };

  const handleDeleteLeadTask = (id, taskId) => {
    const list = leadTasks[id] || [];
    const updated = {
      ...leadTasks,
      [id]: list.filter(t => t.id !== taskId)
    };
    setLeadTasks(updated);
    saveCloudStore('crm_lead_tasks', updated);
  };

  const handleAddLeadNote = (id) => {
    if (!newNoteInput.trim()) return;
    const noteObj = {
      id: 'note_' + Date.now(),
      text: newNoteInput.trim(),
      author: activeAccountUser || 'Sales Executive',
      date: new Date().toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }),
      createdAt: new Date().toISOString()
    };
    const updated = {
      ...leadNotes,
      [id]: [noteObj, ...(leadNotes[id] || [])]
    };
    setLeadNotes(updated);
    saveCloudStore('crm_lead_notes', updated);
    setNewNoteInput('');
  };

  const handleSubmitInlineCall = async (e) => {
    e.preventDefault();
    if (!callSummary.trim()) return;
    setIsSubmittingCall(true);
    try {
      const headers = {
        'Content-Type': 'application/json',
        'x-user-role': userRole,
        'x-user-emp-id': localStorage.getItem('controlroom_logged_emp_id') || '',
        'x-user-name': activeAccountUser || 'Sales Representative'
      };

      const res = await fetch(`/api/crm/leads/${lead.id}/activity`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          activityType: 'CALL',
          summary: callSummary.trim(),
          customerResponse: callResponse.trim(),
          callDurationSeconds: Number(callDuration) || 0
        })
      });
      const data = await res.json();
      if (data?.success) {
        setCallSummary('');
        setCallResponse('');
        if (onRefreshLead) await onRefreshLead();
      } else {
        alert(data.error || 'Failed to record call');
      }
    } catch (err) {
      alert(err.message);
    } finally {
      setIsSubmittingCall(false);
    }
  };

  // Combined Lead Tasks (Supabase store + database followups)
  const currentTasks = useMemo(() => {
    const local = leadTasks[leadKey] || [];
    const dbFollowups = (lead.followups || []).map(f => ({
      id: f.id,
      text: f.notes || 'Scheduled Follow-up',
      dueDate: f.scheduled_at ? new Date(f.scheduled_at).toISOString().split('T')[0] : '—',
      completed: f.status === 'Completed',
      createdAt: f.created_at
    }));
    return [...local, ...dbFollowups];
  }, [leadTasks, leadKey, lead.followups]);

  const currentNotes = leadNotes[leadKey] || [];

  // Match Linked Quotations (from database detail or passed props)
  const linkedQuotes = useMemo(() => {
    if (Array.isArray(lead.quotations) && lead.quotations.length > 0) {
      return lead.quotations;
    }
    const lComp = (lead.company_name || lead.companyName || '').toLowerCase().trim();
    const lNum = (lead.lead_number || lead.id || '').toLowerCase().trim();
    return quotations.filter(q => {
      const qLead = (q.lead_id || q.leadId || q.lead_number || '').toLowerCase().trim();
      const qComp = (q.customerName || q.companyName || '').toLowerCase().trim();
      return (lNum && qLead && (qLead === lNum || qLead === String(lead.id))) ||
             (lComp && qComp && (qComp === lComp || qComp.includes(lComp) || lComp.includes(qComp)));
    });
  }, [lead, quotations]);

  // Match Linked Proforma Invoices (PI)
  const linkedPis = useMemo(() => {
    if (Array.isArray(lead.proforma_invoices) && lead.proforma_invoices.length > 0) {
      return lead.proforma_invoices;
    }
    const lComp = (lead.company_name || lead.companyName || '').toLowerCase().trim();
    const lNum = (lead.lead_number || lead.id || '').toLowerCase().trim();
    const lPhone = (lead.phone || '').trim();

    return dbPis.filter(pi => {
      const piComp = (pi.buyer_name || pi.customer_name || pi.customerName || pi.companyName || pi.vendor || '').toLowerCase().trim();
      const piLead = (pi.lead_number || pi.lead_id || pi.leadId || '').toLowerCase().trim();
      const piPhone = (pi.buyer_phone || pi.phone || '').trim();

      if (lNum && piLead && (piLead === lNum || piLead === String(lead.id))) return true;
      if (lPhone && piPhone && lPhone === piPhone) return true;
      if (lComp && piComp && (lComp === piComp || lComp.includes(piComp) || piComp.includes(lComp))) return true;
      return false;
    });
  }, [lead, dbPis]);

  // Match Linked Tax Invoices
  const linkedInvoices = useMemo(() => {
    if (Array.isArray(lead.invoices) && lead.invoices.length > 0) {
      return lead.invoices;
    }
    const lComp = (lead.company_name || lead.companyName || '').toLowerCase().trim();
    const lNum = (lead.lead_number || lead.id || '').toLowerCase().trim();

    return dbInvoices.filter(inv => {
      const invComp = (inv.customer_name || inv.customerName || inv.companyName || inv.buyer_name || '').toLowerCase().trim();
      const invLead = (inv.lead_number || inv.lead_id || inv.leadId || '').toLowerCase().trim();

      if (lNum && invLead && (invLead === lNum || invLead === String(lead.id))) return true;
      if (lComp && invComp && (lComp === invComp || lComp.includes(invComp) || invComp.includes(lComp))) return true;
      return false;
    });
  }, [lead, dbInvoices]);

  // Calculations
  const repName = lead.assigned_to_name || lead.assignedToName || 'Unassigned';
  const contactName = lead.contact_person || lead.contactPerson || lead.company_name || 'Prospect';
  const sumDocItems = (doc) => {
    const items = doc?.items || doc?.line_items || doc?.lineItems || [];
    if (!Array.isArray(items) || items.length === 0) return 0;
    return items.reduce((sum, it) => {
      const qty = parseCurrency(it.quantity ?? it.qty ?? 1);
      const rate = parseCurrency(it.rate ?? it.unit_price ?? it.price ?? it.unitPrice ?? 0);
      const lineTotal = parseCurrency(it.total ?? it.amount ?? (qty * rate));
      return sum + lineTotal;
    }, 0);
  };

  const quoteAmount = (q) => {
    if (!q) return 0;
    const direct = parseCurrency(
      q.grand_total ?? q.grandTotal ?? q.totalAmount ?? q.total_amount ?? q.total ?? q.dealValue ?? q.amount
    );
    if (direct > 0) return direct;
    return sumDocItems(q);
  };
  const totalQuoteAmount = linkedQuotes.reduce((sum, q) => sum + quoteAmount(q), 0);

  const piAmount = (p) => {
    if (!p) return 0;
    const direct = parseCurrency(
      p.grand_total ?? p.grandTotal ?? p.total_amount ?? p.totalAmount ?? p.total ?? p.amount ?? p.rawTotal
    );
    if (direct > 0) return direct;
    return sumDocItems(p);
  };
  const totalPiAmount = linkedPis.reduce((sum, p) => sum + piAmount(p), 0);

  const invoiceAmount = (inv) => {
    if (!inv) return 0;
    const direct = parseCurrency(
      inv.invAmt ?? inv.total ?? inv.rawTotal ?? inv.grand_total ?? inv.grandTotal ?? inv.total_amount ?? inv.totalAmount ?? inv.invoiceAmount ?? inv.amount
    );
    if (direct > 0) return direct;
    return sumDocItems(inv);
  };
  const totalInvoiceAmount = linkedInvoices.reduce((sum, inv) => sum + invoiceAmount(inv), 0);

  const pendingTasks = currentTasks.filter(t => !t.completed).length;
  const leadLocation = lead.location || [lead.city, lead.state].filter(Boolean).join(', ') || '—';

  const leadCreationDate = lead.created_at || lead.createdAt;
  const creationDateText = leadCreationDate
    ? new Date(leadCreationDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
    : 'Recent';

  const leadPriority = (lead.priority || 'MEDIUM').toUpperCase();
  const priorityColor = leadPriority === 'URGENT' ? C.rose : leadPriority === 'HIGH' ? C.amber : C.teal;
  const priorityBg = leadPriority === 'URGENT' ? C.roseSoft : leadPriority === 'HIGH' ? C.amberSoft : C.tealSoft;

  // Status Styling
  const getStatusBadge = (st) => {
    const s = String(st || '').toLowerCase().trim();
    if (s === 'new') return { color: '#B45309', bg: '#FEF3C7', border: '#FDE68A' };
    if (s === 'assigned') return { color: '#1D4ED8', bg: '#EFF6FF', border: '#DBEAFE' };
    if (s === 'contacted' || s === 'in progress' || s === 'process') return { color: '#0369A1', bg: '#E0F2FE', border: '#BAE6FD' };
    if (s === 'opportunity' || s === 'qualified') return { color: '#7E22CE', bg: '#F3E8FF', border: '#E9D5FF' };
    if (s === 'proposal sent') return { color: '#9333EA', bg: '#FAF5FF', border: '#F3E8FF' };
    if (s === 'converted' || s === 'won') return { color: '#15803D', bg: '#DCFCE7', border: '#BBF7D0' };
    if (['dropped', 'lost', 'disqualified'].includes(s)) return { color: '#B91C1C', bg: '#FEE2E2', border: '#FECACA' };
    return { color: '#0E7490', bg: '#ECFEFF', border: '#CFFAFE' };
  };

  const statusBadge = getStatusBadge(lead.status || 'New');


  // Unified Timeline Builder
  const timelineEvents = useMemo(() => {
    const events = [];

    // Lead Creation Event
    events.push({
      icon: User,
      color: C.teal,
      title: `Lead Registered: ${lead.lead_number || 'New Lead'}`,
      meta: creationDateText,
      body: <>Inbound lead received via <strong>{lead.source || 'Direct Inbound'}</strong> for <strong>{lead.company_name || 'Client'}</strong>.{repName !== 'Unassigned' ? ` Assigned to ${repName}.` : ''}</>
    });

    // Activities (Calls & Discussions)
    (lead.activities || []).forEach(act => {
      events.push({
        icon: PhoneCall,
        color: '#059669',
        title: `${act.activity_type || 'Call Logged'} ${act.call_duration_seconds > 0 ? `(${Math.floor(act.call_duration_seconds / 60)}m ${act.call_duration_seconds % 60}s)` : ''}`,
        meta: act.created_at ? new Date(act.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }) : 'Activity',
        body: (
          <>
            <div>{act.summary}</div>
            {act.customer_response && (
              <div style={{ marginTop: '4px', fontSize: '12px', color: '#475569', fontStyle: 'italic' }}>
                Customer Response: "{act.customer_response}"
              </div>
            )}
            <div style={{ marginTop: '2px', fontSize: '11px', color: C.faint }}>
              By {act.conducted_by_name || 'Representative'} ({act.conducted_by_role || ''})
            </div>
          </>
        )
      });
    });

    // Assignments
    (lead.assignmentHistory || []).forEach(ah => {
      events.push({
        icon: UserCheck,
        color: '#2563EB',
        title: `Reassigned to ${ah.assigned_to_name}`,
        meta: ah.created_at ? new Date(ah.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }) : 'Assignment',
        body: <>Assigned by <strong>{ah.assigned_by_name}</strong> ({ah.assigned_by_role}). Reason: <em>"{ah.assignment_reason}"</em></>
      });
    });

    // Status Transitions
    (lead.statusHistory || []).forEach(sh => {
      events.push({
        icon: RotateCcw,
        color: C.purple,
        title: `Status Changed to "${sh.new_status}"`,
        meta: sh.created_at ? new Date(sh.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }) : 'Status',
        body: <>Transition from {sh.previous_status || 'New'} → <strong>{sh.new_status}</strong>{sh.remarks ? ` • Note: ${sh.remarks}` : ''}.</>
      });
    });

    // Linked Quotations
    linkedQuotes.forEach(q => {
      events.push({
        icon: Receipt,
        color: C.green,
        title: `Quotation: ${q.quote_number || q.quotationNumber || 'Offer Sent'}`,
        meta: q.created_at || q.date ? new Date(q.created_at || q.date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }) : 'Quotation',
        body: <>Commercial quotation generated for <strong>{formatINR(quoteAmount(q))}</strong>. Status: <strong>{q.status || 'Active'}</strong>.</>
      });
    });

    // Linked Proforma Invoices
    linkedPis.forEach(p => {
      events.push({
        icon: Receipt,
        color: C.purple,
        title: `Proforma Invoice: ${p.pi_number || p.piNo || 'PI Sent'}`,
        meta: p.created_at || p.pi_date ? new Date(p.created_at || p.pi_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }) : 'PI',
        body: <>Proforma Invoice confirmed for <strong>{formatINR(piAmount(p))}</strong>. Status: <strong>{p.status || 'Confirmed'}</strong>.</>
      });
    });

    // Linked Tax Invoices
    linkedInvoices.forEach(inv => {
      events.push({
        icon: FileCheck,
        color: C.teal,
        title: `Tax Invoice: ${inv.invoice_no || inv.invoiceNumber || 'Invoice Billed'}`,
        meta: inv.invoice_date || inv.created_at ? new Date(inv.invoice_date || inv.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }) : 'Invoice',
        body: <>Tax Invoice issued for <strong>{formatINR(invoiceAmount(inv))}</strong>. Status: <strong>{inv.status || inv.dispatch_status || 'Generated'}</strong>.</>
      });
    });

    // Notes
    currentNotes.forEach(n => {
      events.push({
        icon: FileText,
        color: C.amber,
        title: `Note by ${n.author || 'User'}`,
        meta: n.date || 'Note',
        body: <>{n.text}</>
      });
    });

    // Completed Tasks
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
  }, [lead, creationDateText, repName, linkedQuotes, linkedPis, linkedInvoices, currentNotes, currentTasks]);

  const metaChip = (Icon, text, opts = {}) => (
    <span style={{
      fontSize: '11.5px', fontWeight: '700', color: opts.fg || C.body,
      backgroundColor: opts.bg || '#FFFFFF', border: `1px solid ${opts.border || C.line}`,
      padding: '3px 10px', borderRadius: '50px', display: 'inline-flex', alignItems: 'center', gap: '5px', whiteSpace: 'nowrap'
    }}>
      <Icon size={12} style={{ color: opts.fg || C.muted }} /> {text}
    </span>
  );

  const profileTabs = [
    { key: 'Timeline', icon: Activity },
    { key: 'Notes', icon: MessageSquare, count: currentNotes.length },
    { key: 'Quotations', icon: FileText, count: linkedQuotes.length },
    { key: 'Proforma Invoices', icon: Receipt, count: linkedPis.length },
    { key: 'Tax Invoices', icon: FileCheck, count: linkedInvoices.length },
    { key: 'Engagement Overview', icon: Clock },
    { key: 'Assignment Audit', icon: UserCheck, count: (lead.assignmentHistory || []).length },
    { key: 'Details', icon: Info }
  ];

  if (!lead) {
    return (
      <div style={{ padding: '40px', textAlign: 'center' }}>
        <p>No lead selected.</p>
        <button onClick={onBack} style={{ padding: '8px 16px', backgroundColor: '#0E7490', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer' }}>
          Back to Directory
        </button>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', minWidth: 0, width: '100%', fontFamily: "'DM Sans', 'Plus Jakarta Sans', sans-serif" }}>
      <style>{L360_STYLES}</style>

      {/* ─── HERO HEADER ─── */}
      <Card style={{ overflow: 'visible' }}>
        {/* Gradient cover band with breadcrumb */}
        <div style={{
          background: `linear-gradient(120deg, ${C.tealDark} 0%, ${C.teal} 55%, #0891B2 100%)`,
          padding: '12px 22px', borderRadius: '14px 14px 0 0',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px', flexWrap: 'wrap'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
            <button
              type="button"
              className="l360-btn"
              onClick={onBack}
              style={{ background: 'rgba(255,255,255,0.16)', border: '1px solid rgba(255,255,255,0.3)', color: '#FFFFFF', padding: '5px 12px', borderRadius: '8px', fontSize: '12px', fontWeight: '700', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
            >
              <ArrowLeft size={14} /> Back to Leads
            </button>
            <span style={{ fontSize: '12px', color: 'rgba(255,255,255,0.75)', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
              Leads <ChevronRight size={12} /> <span style={{ color: '#FFFFFF', fontWeight: '700' }}>Lead 360° View</span>
            </span>
          </div>
          <span style={{ fontSize: '11px', fontWeight: '800', color: '#FFFFFF', backgroundColor: 'rgba(255,255,255,0.16)', border: '1px solid rgba(255,255,255,0.3)', padding: '3px 12px', borderRadius: '50px', letterSpacing: '0.4px', fontFamily: "'JetBrains Mono', monospace" }}>
            {lead.lead_number || lead.id || 'LEAD'}
          </span>
        </div>

        {/* Identity + actions */}
        <div style={{ padding: '18px 22px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '18px', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px', minWidth: 0, flex: '1 1 380px' }}>
            <div style={{
              width: '64px', height: '64px', borderRadius: '18px', flexShrink: 0,
              background: `linear-gradient(135deg, ${C.teal} 0%, ${C.tealDark} 100%)`, color: '#FFFFFF',
              display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '26px', fontWeight: '800',
              boxShadow: '0 8px 18px rgba(14, 116, 144, 0.28)', border: '3px solid #FFFFFF', outline: `1px solid ${C.tealBorder}`
            }}>
              {(lead.company_name || lead.contact_person || 'L').charAt(0).toUpperCase()}
            </div>
            <div style={{ minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                <h2 style={{ fontSize: '22px', fontWeight: '800', margin: 0, color: C.ink, letterSpacing: '-0.4px' }}>
                  {lead.company_name || 'Independent Client'}
                </h2>
                <span style={{ fontSize: '11px', fontWeight: '800', padding: '3px 10px', borderRadius: '50px', backgroundColor: statusBadge.bg, color: statusBadge.color, border: `1px solid ${statusBadge.border}`, display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
                  <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: statusBadge.color }} />
                  {isConverted ? 'Converted to Customer' : (lead.status || 'New')}
                </span>
                <span style={{ fontSize: '11px', fontWeight: '800', padding: '3px 10px', borderRadius: '50px', backgroundColor: priorityBg, color: priorityColor, border: `1px solid ${priorityColor}33`, display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                  <Flame size={12} /> {leadPriority}
                </span>
              </div>
              <div style={{ fontSize: '12.5px', color: C.muted, marginTop: '5px', display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', color: C.body, fontWeight: '600' }}><User size={13} /> {lead.contact_person || 'No Contact'}</span>
                {leadLocation !== '—' && <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px' }}><MapPin size={13} /> {leadLocation}</span>}
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px' }}><Calendar size={13} /> Created {creationDateText}</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap', marginTop: '10px' }}>
                {metaChip(Compass, lead.source || 'Direct Inbound', { fg: C.teal, bg: C.tealSoft, border: '#A5F3FC' })}
                {metaChip(Briefcase, `Owner: ${repName}`)}
                {lead.estimated_kw && metaChip(Zap, `${lead.estimated_kw} kW`)}
                {isConverted && metaChip(UserCheck, `Customer: ${resolvedCustCode}`, { fg: '#065F46', bg: '#ECFDF5', border: '#A7F3D0' })}
              </div>
            </div>
          </div>

          {/* Action buttons */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', alignItems: 'flex-end' }}>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
              {lead.phone && (
                <a href={`tel:${lead.phone}`} className="l360-btn" title={`Call ${lead.phone}`} style={{ textDecoration: 'none', width: '36px', height: '36px', borderRadius: '10px', border: `1px solid ${C.line}`, backgroundColor: '#FFFFFF', color: C.teal, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Phone size={15} />
                </a>
              )}
              {lead.email && (
                <a href={`mailto:${lead.email}`} className="l360-btn" title={`Email ${lead.email}`} style={{ textDecoration: 'none', width: '36px', height: '36px', borderRadius: '10px', border: `1px solid ${C.line}`, backgroundColor: '#FFFFFF', color: C.teal, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Mail size={15} />
                </a>
              )}
              {onOpenWhatsAppChat && (
                <button type="button" className="l360-btn" title="WhatsApp" onClick={() => onOpenWhatsAppChat(lead)} style={{ width: '36px', height: '36px', borderRadius: '10px', border: '1px solid #BBF7D0', backgroundColor: '#F0FDF4', color: C.green, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
                  <MessageSquare size={15} />
                </button>
              )}
              {isConverted ? (
                <span
                  title="Lead converted to Customer. Profile details are permanently locked in read-only mode."
                  style={{ backgroundColor: '#F8FAFC', color: '#64748B', border: '1px solid #CBD5E1', padding: '0 12px', height: '36px', borderRadius: '10px', fontSize: '12px', fontWeight: '700', display: 'inline-flex', alignItems: 'center', gap: '6px', userSelect: 'none' }}
                >
                  <Lock size={13} color="#64748B" /> Converted (Read-Only)
                </span>
              ) : onEditLead && (
                <button
                  type="button"
                  className="l360-btn"
                  onClick={() => onEditLead(lead)}
                  style={{ backgroundColor: '#FFFFFF', color: '#1E293B', border: '1px solid #CBD5E1', padding: '0 14px', height: '36px', borderRadius: '10px', fontSize: '12px', fontWeight: '700', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                >
                  <Edit3 size={14} /> Edit Lead
                </button>
              )}
              {!isCeo && !isTechSupport && (
                isConverted ? (
                  <button
                    type="button"
                    className="l360-btn"
                    onClick={() => handleNavigateCustomer(resolvedCustCode)}
                    style={{ backgroundColor: C.teal, color: '#FFFFFF', border: 'none', padding: '0 16px', height: '36px', borderRadius: '10px', fontSize: '12px', fontWeight: '800', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '6px', boxShadow: '0 4px 10px rgba(14, 116, 144, 0.3)' }}
                  >
                    <UserCheck size={14} /> View Customer ↗
                  </button>
                ) : onConvertToCustomer && (
                  <button
                    type="button"
                    className="l360-btn"
                    onClick={() => onConvertToCustomer(lead)}
                    style={{ backgroundColor: C.teal, color: '#FFFFFF', border: 'none', padding: '0 16px', height: '36px', borderRadius: '10px', fontSize: '12px', fontWeight: '800', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '6px', boxShadow: '0 4px 10px rgba(14, 116, 144, 0.3)' }}
                  >
                    <UserPlus size={14} /> Convert to Customer
                  </button>
                )
              )}
            </div>
          </div>
        </div>

        {/* Pipeline stage stepper */}
        <div style={{ padding: '0 22px 18px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px', fontSize: '10.5px', fontWeight: '800', color: C.muted, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            <TrendingUp size={13} style={{ color: C.teal }} /> Pipeline Stage
          </div>
          <div className="l360-stepper" style={{ display: 'flex', gap: '6px', overflowX: 'auto', paddingBottom: '2px' }}>
            {LEAD_STAGES.filter(s => s !== 'Dropped').map((s) => {
              const currentRank = getStageRank(lead.status);
              const rank = getStageRank(s);
              const isCurrent = rank === currentRank;
              const isDone = rank < currentRank && currentRank !== 8;
              const isLocked = rank < currentRank;
              return (
                <button
                  key={s}
                  type="button"
                  className={isConverted ? '' : 'stage-step'}
                  disabled={isConverted}
                  title={isConverted ? 'Lead converted to Customer (Stages locked)' : isLocked ? 'Completed stage (locked)' : `Move lead to ${s}`}
                  onClick={() => {
                    if (isConverted) return;
                    if (isCurrent) return;
                    if (!canTransitionStage(lead.status, s)) {
                      alert(`Stage cannot be reversed. Lead stage can only progress forward from "${lead.status}".`);
                      return;
                    }
                    if (onUpdateStatus) onUpdateStatus(s, `Stage advanced to ${s}`);
                  }}
                  style={{
                    flex: '1 1 0', minWidth: '104px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
                    padding: '9px 12px', borderRadius: '10px', fontSize: '12px', fontWeight: '800', whiteSpace: 'nowrap',
                    border: `1px solid ${isCurrent ? C.teal : isDone ? '#A7F3D0' : C.line}`,
                    backgroundColor: isCurrent ? C.teal : isDone ? '#ECFDF5' : '#FFFFFF',
                    color: isCurrent ? '#FFFFFF' : isDone ? '#047857' : C.muted,
                    boxShadow: isCurrent ? '0 4px 10px rgba(14,116,144,0.28)' : 'none',
                    cursor: isConverted ? 'default' : 'pointer',
                    opacity: isConverted && !isCurrent && !isDone ? 0.65 : 1
                  }}
                >
                  {isDone ? <Check size={13} /> : isCurrent ? <Zap size={13} /> : null}
                  {s}
                </button>
              );
            })}
            {getStageRank(lead.status) === 8 && (
              <span style={{ flex: '1 1 0', minWidth: '104px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '6px', padding: '9px 12px', borderRadius: '10px', fontSize: '12px', fontWeight: '800', backgroundColor: '#FEE2E2', color: '#B91C1C', border: '1px solid #FECACA' }}>
                <AlertTriangle size={13} /> {lead.status}
              </span>
            )}
          </div>
        </div>

        {/* KPI strip */}
        <div className="l360-kpis" style={{ display: 'grid', gridTemplateColumns: 'repeat(5, minmax(0, 1fr))', borderTop: `1px solid ${C.lineSoft}`, backgroundColor: C.bg, borderRadius: '0 0 14px 14px' }}>
          {[
            { icon: Receipt, label: 'Quotations', value: linkedQuotes.length, sub: formatINR(totalQuoteAmount), color: C.green },
            { icon: FileText, label: 'Proforma Invoices', value: linkedPis.length, sub: formatINR(totalPiAmount), color: C.purple },
            { icon: FileCheck, label: 'Tax Invoices', value: linkedInvoices.length, sub: formatINR(totalInvoiceAmount), color: C.teal },
            { icon: Clock, label: 'Open Tasks', value: pendingTasks, sub: `${currentTasks.length} total`, color: C.amber },
            { icon: Activity, label: 'Activities', value: (lead.activities || []).length, sub: 'Calls & touchpoints', color: '#2563EB' }
          ].map((k, i) => (
            <div key={k.label} className="l360-kpi" style={{ padding: '14px 18px', display: 'flex', alignItems: 'center', gap: '12px', borderLeft: i === 0 ? 'none' : `1px solid ${C.lineSoft}` }}>
              <span style={{ width: '34px', height: '34px', borderRadius: '10px', backgroundColor: `${k.color}14`, color: k.color, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <k.icon size={16} />
              </span>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: '10.5px', fontWeight: '700', color: C.muted, textTransform: 'uppercase', letterSpacing: '0.3px' }}>{k.label}</div>
                <div style={{ fontSize: '17px', fontWeight: '800', color: C.ink, lineHeight: 1.2 }}>{k.value}</div>
                <div style={{ fontSize: '10.5px', color: C.faint, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{k.sub}</div>
              </div>
            </div>
          ))}
        </div>
      </Card>

      {/* Converted ribbon */}
      {isConverted && (
        <div style={{
          background: 'linear-gradient(90deg, #ECFDF5 0%, #F0FDFA 100%)',
          border: '1px solid #A7F3D0', borderLeft: '4px solid #059669', borderRadius: '12px',
          padding: '12px 18px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <span style={{ width: '34px', height: '34px', borderRadius: '10px', backgroundColor: '#059669', color: '#FFFFFF', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
              <CheckCircle2 size={18} />
            </span>
            <div>
              <div style={{ fontSize: '13.5px', fontWeight: '800', color: '#065F46' }}>Lead successfully converted to a customer</div>
              <div style={{ fontSize: '12px', color: '#047857', marginTop: '2px' }}>
                Customer ID <strong style={{ fontFamily: 'monospace', backgroundColor: '#D1FAE5', padding: '1px 8px', borderRadius: '4px', border: '1px solid #A7F3D0' }}>{resolvedCustCode}</strong>
              </div>
            </div>
          </div>
          <button
            type="button"
            className="l360-btn"
            onClick={() => handleNavigateCustomer(resolvedCustCode)}
            style={{ backgroundColor: '#FFFFFF', color: '#047857', border: '1px solid #6EE7B7', borderRadius: '8px', padding: '7px 14px', fontWeight: '800', fontSize: '12px', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
          >
            Open Customer Profile <ChevronRight size={14} />
          </button>
        </div>
      )}

      {/* ─── MAIN WORKSPACE: INTERACTIVE TABS ─── */}
      <Card style={{ display: 'flex', flexDirection: 'column', minWidth: 0, minHeight: '650px' }}>
        {/* Tab Navigation header */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          borderBottom: `1px solid ${C.line}`,
          backgroundColor: '#FFFFFF',
          padding: '0 16px',
          overflowX: 'auto',
          scrollbarWidth: 'thin',
          flexShrink: 0
        }}>
          {profileTabs.map(tab => {
            const TabIcon = tab.icon;
            const isActive = profileTab === tab.key;
            return (
              <button
                key={tab.key}
                type="button"
                className="l360-tab"
                onClick={() => setProfileTab(tab.key)}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '14px 16px',
                  fontSize: '13px',
                  fontWeight: '700',
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                  border: 'none',
                  background: 'none',
                  color: isActive ? C.teal : '#64748B',
                  borderBottom: isActive ? `3px solid ${C.teal}` : '3px solid transparent',
                  transition: 'all 0.15s ease'
                }}
              >
                <TabIcon size={15} style={{ color: isActive ? C.teal : '#94A3B8' }} />
                {tab.key}
                {tab.count > 0 && (
                  <span style={{
                    fontSize: '10.5px',
                    fontWeight: '800',
                    padding: '2px 8px',
                    borderRadius: '50px',
                    backgroundColor: isActive ? C.tealSoft : C.lineSoft,
                    color: isActive ? C.teal : C.body
                  }}>
                    {tab.count}
                  </span>
                )}
              </button>
            );
          })}
        </div>

          {/* Tab Content Body */}
          <div style={{ padding: '24px', flex: 1, backgroundColor: '#FCFDFE', minWidth: 0 }}>
            {/* 1. TIMELINE */}
            {profileTab === 'Timeline' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
                <TabHeading title="Lead Activity & Audit Timeline" subtitle="Full chronological log of communications, status transitions, and touchpoints" />
                {timelineEvents.length === 0 ? (
                  <EmptyState
                    icon={Activity}
                    title="No timeline events"
                    text={`No activity recorded for ${lead.company_name || 'this lead'} yet.`}
                  />
                ) : (
                  <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', gap: '14px' }}>
                    <div style={{ position: 'absolute', left: '17px', top: '18px', bottom: '18px', width: '2px', backgroundColor: C.line }} />
                    {timelineEvents.map((ev, i) => (
                      <div key={i} style={{ display: 'flex', gap: '14px', position: 'relative' }}>
                        <span style={{ width: '36px', height: '36px', borderRadius: '50%', backgroundColor: '#FFFFFF', border: `2px solid ${ev.color}`, color: ev.color, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, zIndex: 1 }}>
                          <ev.icon size={15} />
                        </span>
                        <div className="l360-row" style={{ backgroundColor: '#FFFFFF', padding: '12px 16px', borderRadius: '10px', border: `1px solid ${C.line}`, flex: 1, transition: 'all 0.15s ease' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '10px', marginBottom: '4px' }}>
                            <strong style={{ fontSize: '13px', color: C.ink }}>{ev.title}</strong>
                            <span style={{ fontSize: '10.5px', color: C.muted, backgroundColor: C.lineSoft, padding: '2px 8px', borderRadius: '50px', fontWeight: '700', whiteSpace: 'nowrap' }}>{ev.meta}</span>
                          </div>
                          <div style={{ fontSize: '12.5px', color: '#475569', margin: 0, lineHeight: 1.5 }}>{ev.body}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* 2. NOTES */}
            {profileTab === 'Notes' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <TabHeading title="Internal Lead Notes & Observations" subtitle="Visible to sales team and assigned representatives" />

                <div style={{ backgroundColor: '#FFFFFF', padding: '14px', borderRadius: '10px', border: `1px solid ${C.line}`, display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  <textarea
                    rows={3}
                    placeholder="Write an internal sales note, site visit summary, or technical observation for this lead..."
                    value={newNoteInput}
                    onChange={(e) => setNewNoteInput(e.target.value)}
                    style={{ width: '100%', border: '1px solid #CBD5E1', borderRadius: '8px', padding: '10px 12px', fontSize: '13px', outline: 'none', resize: 'vertical', boxSizing: 'border-box', fontFamily: 'inherit' }}
                  />
                  <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                    <PrimaryButton icon={Send} onClick={() => handleAddLeadNote(leadKey)}>Post Note</PrimaryButton>
                  </div>
                </div>

                {currentNotes.length === 0 ? (
                  <EmptyState
                    icon={FileText}
                    title="No internal notes"
                    text="No internal notes recorded for this lead yet. Use the area above to add technical requirements, meeting points, or client preferences."
                  />
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    {currentNotes.map(note => (
                      <div key={note.id} className="l360-row" style={{ backgroundColor: '#FFFFFF', padding: '14px 16px', borderRadius: '10px', border: `1px solid ${C.line}`, display: 'flex', gap: '12px', transition: 'all 0.15s ease' }}>
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

            {/* 2. QUOTATIONS */}
            {profileTab === 'Quotations' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <TabHeading
                  title="Commercial Quotations"
                  subtitle={`${linkedQuotes.length} quotation(s) given • Total Quoted Value: ${formatINR(totalQuoteAmount)}`}
                />

                {linkedQuotes.length === 0 ? (
                  <EmptyState
                    icon={Receipt}
                    title="No quotations yet"
                    text="No commercial quotations have been issued for this lead yet."
                  />
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    {linkedQuotes.map((q, idx) => (
                      <div key={q.id || idx} className="l360-row" style={{ backgroundColor: '#FFFFFF', padding: '14px 18px', borderRadius: '10px', border: `1px solid ${C.line}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '14px', flexWrap: 'wrap', transition: 'all 0.15s ease' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                          <span style={{ width: '38px', height: '38px', borderRadius: '10px', backgroundColor: C.tealSoft, color: C.teal, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
                            <FileText size={18} />
                          </span>
                          <div>
                            <div style={{ fontWeight: '800', color: C.ink, fontSize: '13.5px' }}>
                              {q.quote_number || q.quotationNumber || `QUOTE-${idx + 1}`}
                              {q.revision_number > 0 && (
                                <span style={{ marginLeft: '6px', fontSize: '10.5px', backgroundColor: C.purpleSoft, color: C.purple, padding: '1px 6px', borderRadius: '4px', fontWeight: 800 }}>
                                  Rev {q.revision_number}
                                </span>
                              )}
                            </div>
                            <div style={{ fontSize: '11.5px', color: C.muted, marginTop: '2px' }}>
                              Date: {q.created_at || q.date ? new Date(q.created_at || q.date).toLocaleDateString('en-IN') : 'Recent'} • Customer: {q.customerName || q.companyName || lead.company_name}
                            </div>
                          </div>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                          <span style={{ fontSize: '15px', fontWeight: '900', color: C.ink }}>{formatCurrency(quoteAmount(q))}</span>
                          <span style={{ fontSize: '11px', backgroundColor: '#ECFEFF', color: C.teal, padding: '3px 10px', borderRadius: '50px', fontWeight: '800' }}>
                            {q.status || 'Active'}
                          </span>
                          <button
                            type="button"
                            className="l360-btn"
                            onClick={() => onNavigateTab && onNavigateTab('Quotations')}
                            style={{ padding: '6px 14px', backgroundColor: '#FFFFFF', border: '1px solid #CBD5E1', color: C.teal, borderRadius: '8px', fontSize: '12px', fontWeight: '700', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                          >
                            <ExternalLink size={13} /> View Quote
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* 3. PROFORMA INVOICES */}
            {profileTab === 'Proforma Invoices' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <TabHeading
                  title="Proforma Invoices (PI)"
                  subtitle={`${linkedPis.length} PI(s) given • Total PI Value: ${formatINR(totalPiAmount)}`}
                />

                {linkedPis.length === 0 ? (
                  <EmptyState
                    icon={Receipt}
                    title="No Proforma Invoices yet"
                    text="No Proforma Invoices (PI) have been generated for this lead."
                  />
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    {linkedPis.map((p, idx) => (
                      <div key={p.id || idx} className="l360-row" style={{ backgroundColor: '#FFFFFF', padding: '14px 18px', borderRadius: '10px', border: `1px solid ${C.line}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '14px', flexWrap: 'wrap', transition: 'all 0.15s ease' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                          <span style={{ width: '38px', height: '38px', borderRadius: '10px', backgroundColor: C.purpleSoft, color: C.purple, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
                            <Receipt size={18} />
                          </span>
                          <div>
                            <div style={{ fontWeight: '800', color: C.ink, fontSize: '13.5px' }}>
                              {p.pi_number || p.piNo || `PI-${idx + 1}`}
                            </div>
                            <div style={{ fontSize: '11.5px', color: C.muted, marginTop: '2px' }}>
                              Date: {p.created_at || p.pi_date ? new Date(p.created_at || p.pi_date).toLocaleDateString('en-IN') : 'Recent'} • Buyer: {p.buyer_name || p.customer_name || p.customerName || lead.company_name}
                            </div>
                          </div>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                          <span style={{ fontSize: '15px', fontWeight: '900', color: C.ink }}>{formatCurrency(piAmount(p))}</span>
                          <span style={{ fontSize: '11px', backgroundColor: C.purpleSoft, color: C.purple, padding: '3px 10px', borderRadius: '50px', fontWeight: '800' }}>
                            {p.status || 'Confirmed'}
                          </span>
                          <button
                            type="button"
                            className="l360-btn"
                            onClick={() => onNavigateTab && onNavigateTab('Proforma Invoice')}
                            style={{ padding: '6px 14px', backgroundColor: '#FFFFFF', border: '1px solid #CBD5E1', color: C.purple, borderRadius: '8px', fontSize: '12px', fontWeight: '700', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                          >
                            <ExternalLink size={13} /> View PI
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* 4. TAX INVOICES */}
            {profileTab === 'Tax Invoices' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <TabHeading
                  title="Tax Invoices & Billing"
                  subtitle={`${linkedInvoices.length} invoice(s) given • Total Invoiced Value: ${formatINR(totalInvoiceAmount)}`}
                />

                {linkedInvoices.length === 0 ? (
                  <EmptyState
                    icon={FileCheck}
                    title="No Tax Invoices yet"
                    text="No official tax invoices have been billed or dispatched for this lead yet."
                  />
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    {linkedInvoices.map((inv, idx) => (
                      <div key={inv.id || idx} className="l360-row" style={{ backgroundColor: '#FFFFFF', padding: '14px 18px', borderRadius: '10px', border: `1px solid ${C.line}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '14px', flexWrap: 'wrap', transition: 'all 0.15s ease' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                          <span style={{ width: '38px', height: '38px', borderRadius: '10px', backgroundColor: C.greenSoft, color: C.green, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
                            <FileCheck size={18} />
                          </span>
                          <div>
                            <div style={{ fontWeight: '800', color: C.ink, fontSize: '13.5px' }}>
                              {inv.invoice_no || inv.invoiceNumber || inv.officialInvoiceNo || `INV-${idx + 1}`}
                            </div>
                            <div style={{ fontSize: '11.5px', color: C.muted, marginTop: '2px' }}>
                              Date: {inv.invoice_date || inv.created_at ? new Date(inv.invoice_date || inv.created_at).toLocaleDateString('en-IN') : 'Recent'} • Customer: {inv.customer_name || inv.customerName || inv.companyName || lead.company_name}
                            </div>
                          </div>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                          <span style={{ fontSize: '15px', fontWeight: '900', color: C.ink }}>{formatCurrency(invoiceAmount(inv))}</span>
                          <span style={{ fontSize: '11px', backgroundColor: C.greenSoft, color: C.green, padding: '3px 10px', borderRadius: '50px', fontWeight: '800' }}>
                            {inv.status || inv.dispatch_status || 'Generated'}
                          </span>
                          <button
                            type="button"
                            className="l360-btn"
                            onClick={() => onNavigateTab && onNavigateTab('Invoice Management')}
                            style={{ padding: '6px 14px', backgroundColor: '#FFFFFF', border: '1px solid #CBD5E1', color: C.green, borderRadius: '8px', fontSize: '12px', fontWeight: '700', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                          >
                            <ExternalLink size={13} /> View Invoice
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* 6. ENGAGEMENT OVERVIEW */}
            {profileTab === 'Engagement Overview' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
                <TabHeading
                  title="Lead Commercial & Engagement Overview"
                  subtitle="Unified summary of commercial quotes, proforma invoices, billing, and interaction velocity"
                />

                {/* 3 Top Document KPI Cards */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '14px' }}>
                  <div
                    onClick={() => setProfileTab('Quotations')}
                    style={{
                      backgroundColor: '#FFFFFF',
                      border: `1.5px solid ${C.tealBorder}`,
                      borderRadius: '12px',
                      padding: '16px',
                      cursor: 'pointer',
                      transition: 'all 0.15s ease',
                      boxShadow: '0 1px 3px rgba(0,0,0,0.04)'
                    }}
                    onMouseEnter={(e) => { e.currentTarget.style.borderColor = C.teal; e.currentTarget.style.transform = 'translateY(-2px)'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.borderColor = C.tealBorder; e.currentTarget.style.transform = 'none'; }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                      <span style={{ fontSize: '11px', fontWeight: '800', color: C.teal, textTransform: 'uppercase', letterSpacing: '0.4px' }}>Quotations</span>
                      <span style={{ width: '28px', height: '28px', borderRadius: '50%', backgroundColor: C.tealSoft, color: C.teal, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <FileText size={15} />
                      </span>
                    </div>
                    <div style={{ fontSize: '20px', fontWeight: '900', color: C.ink }}>{formatINR(totalQuoteAmount)}</div>
                    <div style={{ fontSize: '11.5px', color: C.muted, marginTop: '4px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <strong>{linkedQuotes.length}</strong> quote(s) issued • <span style={{ color: C.teal, fontWeight: '700' }}>View ›</span>
                    </div>
                  </div>

                  <div
                    onClick={() => setProfileTab('Proforma Invoices')}
                    style={{
                      backgroundColor: '#FFFFFF',
                      border: `1.5px solid ${C.purpleBorder}`,
                      borderRadius: '12px',
                      padding: '16px',
                      cursor: 'pointer',
                      transition: 'all 0.15s ease',
                      boxShadow: '0 1px 3px rgba(0,0,0,0.04)'
                    }}
                    onMouseEnter={(e) => { e.currentTarget.style.borderColor = C.purple; e.currentTarget.style.transform = 'translateY(-2px)'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.borderColor = C.purpleBorder; e.currentTarget.style.transform = 'none'; }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                      <span style={{ fontSize: '11px', fontWeight: '800', color: C.purple, textTransform: 'uppercase', letterSpacing: '0.4px' }}>Proforma Invoices (PI)</span>
                      <span style={{ width: '28px', height: '28px', borderRadius: '50%', backgroundColor: C.purpleSoft, color: C.purple, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <Receipt size={15} />
                      </span>
                    </div>
                    <div style={{ fontSize: '20px', fontWeight: '900', color: C.ink }}>{formatINR(totalPiAmount)}</div>
                    <div style={{ fontSize: '11.5px', color: C.muted, marginTop: '4px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <strong>{linkedPis.length}</strong> PI(s) confirmed • <span style={{ color: C.purple, fontWeight: '700' }}>View ›</span>
                    </div>
                  </div>

                  <div
                    onClick={() => setProfileTab('Tax Invoices')}
                    style={{
                      backgroundColor: '#FFFFFF',
                      border: `1.5px solid #BBF7D0`,
                      borderRadius: '12px',
                      padding: '16px',
                      cursor: 'pointer',
                      transition: 'all 0.15s ease',
                      boxShadow: '0 1px 3px rgba(0,0,0,0.04)'
                    }}
                    onMouseEnter={(e) => { e.currentTarget.style.borderColor = C.green; e.currentTarget.style.transform = 'translateY(-2px)'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.borderColor = '#BBF7D0'; e.currentTarget.style.transform = 'none'; }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                      <span style={{ fontSize: '11px', fontWeight: '800', color: C.green, textTransform: 'uppercase', letterSpacing: '0.4px' }}>Tax Invoices</span>
                      <span style={{ width: '28px', height: '28px', borderRadius: '50%', backgroundColor: C.greenSoft, color: C.green, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <FileCheck size={15} />
                      </span>
                    </div>
                    <div style={{ fontSize: '20px', fontWeight: '900', color: C.ink }}>{formatINR(totalInvoiceAmount)}</div>
                    <div style={{ fontSize: '11.5px', color: C.muted, marginTop: '4px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <strong>{linkedInvoices.length}</strong> invoice(s) billed • <span style={{ color: C.green, fontWeight: '700' }}>View ›</span>
                    </div>
                  </div>
                </div>

                {/* Engagement Breakdown Grid */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '16px' }}>
                  <div style={{ backgroundColor: '#FFFFFF', borderRadius: '12px', border: `1px solid ${C.line}`, padding: '16px 18px' }}>
                    <h5 style={{ margin: '0 0 14px', fontSize: '13px', fontWeight: '800', color: C.ink, display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <Clock size={15} color={C.teal} /> Touchpoint & Velocity Metrics
                    </h5>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                      <InfoRow icon={Calendar} label="Lead Created Date" value={creationDateText} />
                      <InfoRow icon={User} label="Assigned Representative" value={repName} />
                      <InfoRow icon={Compass} label="Inbound Channel / Source" value={lead.source || 'Direct Inbound'} />
                      <InfoRow icon={MapPin} label="Operating Location" value={leadLocation} />
                      <InfoRow icon={Clock} label="Last Activity Recorded" value={lead.last_qualifying_activity_at ? new Date(lead.last_qualifying_activity_at).toLocaleDateString('en-IN') : 'None recorded'} />
                    </div>
                  </div>

                  <div style={{ backgroundColor: '#FFFFFF', borderRadius: '12px', border: `1px solid ${C.line}`, padding: '16px 18px' }}>
                    <h5 style={{ margin: '0 0 14px', fontSize: '13px', fontWeight: '800', color: C.ink, display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <Sparkles size={15} color={C.purple} /> Commercial Opportunity Scope
                    </h5>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                      <InfoRow icon={Layers} label="Structure Category" value={lead.category || 'Aluminium Mounting'} />
                      <InfoRow icon={Zap} label="Estimated Capacity" value={lead.estimated_kw ? `${lead.estimated_kw} kW` : '—'} />
                      <InfoRow icon={TrendingUp} label="Current Lead Stage" value={lead.status || 'New'} />
                      <InfoRow icon={UserCheck} label="Reassignment Trail" value={`${(lead.assignmentHistory || []).length} transfer(s) recorded`} />
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* 7. ASSIGNMENT AUDIT */}
            {profileTab === 'Assignment Audit' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <TabHeading
                  title={`Assignment Audit (${(lead.assignmentHistory || []).length})`}
                  subtitle="Permanent historical audit trail of lead ownership and assignments"
                />

                {(!lead.assignmentHistory || lead.assignmentHistory.length === 0) ? (
                  <EmptyState
                    icon={UserCheck}
                    title="Initial assignment only"
                    text="This lead is currently on its initial assignment. No ownership transfers or reassignments have been made."
                  />
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    {lead.assignmentHistory.map(ah => (
                      <div key={ah.id} className="l360-row" style={{ padding: '14px 16px', backgroundColor: '#FFFFFF', borderRadius: '10px', border: `1px solid ${C.line}`, display: 'flex', flexDirection: 'column', gap: '6px', transition: 'all 0.15s ease' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <strong style={{ fontWeight: '800', color: C.ink, fontSize: '13px' }}>Assigned To: {ah.assigned_to_name}</strong>
                          <span style={{ fontSize: '11px', color: C.faint }}>
                            {new Date(ah.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                        <div style={{ fontSize: '11.5px', color: C.muted }}>
                          Assigned by <strong>{ah.assigned_by_name}</strong> ({ah.assigned_by_role || 'Manager'})
                        </div>
                        {ah.assignment_reason && (
                          <div style={{ fontSize: '11.5px', color: C.body, fontStyle: 'italic', backgroundColor: C.bg, padding: '6px 10px', borderRadius: '6px', marginTop: '2px' }}>
                            "{ah.assignment_reason}"
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* 8. DETAILS (CONTACT INFORMATION & MOUNTING REQUIREMENT) */}
            {profileTab === 'Details' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
                <TabHeading
                  title="Lead Profile & Technical Specifications"
                  subtitle={isConverted ? "Permanent read-only record • Lead has been converted to an active Customer" : "Complete contact details, company information, and technical mounting scope"}
                  action={
                    isConverted ? (
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '6px 14px', borderRadius: '8px', backgroundColor: '#F8FAFC', border: '1px solid #CBD5E1', fontSize: '12px', fontWeight: '700', color: '#64748B' }}>
                        <Lock size={13} color="#64748B" /> Details Locked (Converted)
                      </span>
                    ) : (
                      onEditLead && <PrimaryButton icon={Edit3} onClick={() => onEditLead(lead)}>Edit Details</PrimaryButton>
                    )
                  }
                />

                <div className="l360-details">
                  {/* Card 1: Contact Information */}
                  <div style={{ backgroundColor: '#FFFFFF', borderRadius: '12px', border: `1px solid ${C.tealBorder}`, overflow: 'hidden' }}>
                    <div style={{ padding: '12px 16px', backgroundColor: '#F0FDFF', borderBottom: `1px solid ${C.tealSoft}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <h5 style={{ margin: 0, fontSize: '13px', fontWeight: '800', color: C.teal, display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <User size={15} /> Contact Information
                      </h5>
                    </div>
                    <div style={{ padding: '8px 16px 14px' }}>
                      <KeyValue label="Company Name" value={lead.company_name || 'Independent Client'} />
                      <KeyValue label="Contact Person" value={lead.contact_person || '—'} />
                      <KeyValue label="Designation" value={lead.designation || '—'} />
                      <KeyValue label="Phone Number" value={lead.phone || '—'} />
                      {lead.whatsapp && <KeyValue label="WhatsApp Number" value={lead.whatsapp} />}
                      <KeyValue label="Email Address" value={lead.email || '—'} />
                      <KeyValue label="Location / City" value={leadLocation} />
                    </div>
                  </div>

                  {/* Card 2: Mounting Requirement */}
                  <div style={{ backgroundColor: '#FFFFFF', borderRadius: '12px', border: `1px solid ${C.purpleBorder}`, overflow: 'hidden' }}>
                    <div style={{ padding: '12px 16px', backgroundColor: '#FAF5FF', borderBottom: `1px solid ${C.purpleSoft}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <h5 style={{ margin: 0, fontSize: '13px', fontWeight: '800', color: C.purple, display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <Layers size={15} /> Mounting Requirement
                      </h5>
                    </div>
                    <div style={{ padding: '8px 16px 14px' }}>
                      <KeyValue label="Structure Category" value={lead.category || 'Aluminium Mounting'} />
                      <KeyValue label="Required Capacity" value={lead.estimated_kw ? `${lead.estimated_kw} kW` : '—'} valueColor={C.teal} />
                      <KeyValue label="Estimated Deal Value" value={lead.estimated_deal_value ? formatCurrency(lead.estimated_deal_value) : '—'} />
                      <div style={{ paddingTop: '8px' }}>
                        <div style={{ fontSize: '10.5px', color: C.faint, fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.4px' }}>Specification Details</div>
                        <div style={{ fontSize: '12px', color: C.ink, fontWeight: '600', marginTop: '4px', lineHeight: 1.45, backgroundColor: C.bg, padding: '8px 10px', borderRadius: '6px', border: `1px solid ${C.line}` }}>
                          {lead.product_requirement || 'Custom Solar Mounting Structures'}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Card 3: Administration & Scope */}
                <div style={{ backgroundColor: '#FFFFFF', borderRadius: '12px', border: `1px solid ${C.line}`, overflow: 'hidden' }}>
                  <div style={{ padding: '12px 16px', backgroundColor: C.bg, borderBottom: `1px solid ${C.line}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <h5 style={{ margin: 0, fontSize: '13px', fontWeight: '800', color: C.ink, display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <Sparkles size={15} color={C.teal} /> Lead Administration & Timeline
                    </h5>
                  </div>
                  <div style={{ padding: '8px 16px 14px', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '12px' }}>
                    <KeyValue label="Lead Number" value={lead.lead_number || lead.id} mono />
                    {isConverted && (
                      <KeyValue label="Customer ID" value={resolvedCustCode} mono highlight valueColor="#065F46" />
                    )}
                    <KeyValue label="Lead Source" value={lead.source || 'Direct Inbound'} />
                    <KeyValue label="Assigned Representative" value={repName} valueColor={repName !== 'Unassigned' ? C.teal : C.muted} />
                    <KeyValue label="Created Timestamp" value={creationDateText} />
                    <KeyValue label="Last Activity Date" value={lead.last_qualifying_activity_at ? new Date(lead.last_qualifying_activity_at).toLocaleDateString('en-IN') : 'None'} />
                  </div>
                </div>
              </div>
            )}

          </div>
        </Card>
      </div>
    );
  }
