import React, { useState, useEffect } from 'react';
import {
  ArrowLeft, MessageSquare, Edit3, Mail, Phone, CheckCircle2,
  FileText, MoreHorizontal, ChevronDown, ChevronRight,
  Calendar, Clock, Plus, Trash2, Send, Layers
} from 'lucide-react';
import { fetchCloudStore, saveCloudStore } from '../../utils/supabaseDataSync';

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
    { id: 'def_n2', author: 'System Sync', date: '08 Sep, 2026 12:59 PM', text: customer.source === 'Zoho Books' ? 'Contact details imported and verified via Zoho Books API v2.' : 'Direct customer registration initialized in Businz.' }
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

  const profileTabs = [
    'Timeline',
    'Tasks',
    'Notes',
    'Quotations',
    'WhatsApp Chat',
    'BOM Orders',
    'Opportunities',
    'Details'
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', minWidth: 0, width: '100%', fontFamily: "'DM Sans', sans-serif" }}>
      
      {/* Full Page Card Container */}
      <div style={{
        backgroundColor: '#FFFFFF',
        borderRadius: '16px',
        border: '1px solid #E2E8F0',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        boxShadow: '0 4px 16px -2px rgba(0, 0, 0, 0.05)',
        minHeight: 'calc(100vh - 120px)'
      }}>
        
        {/* TOP HEADER: NAVIGATION & QUICK ACTIONS */}
        <div style={{
          padding: '16px 24px',
          backgroundColor: '#0F172A',
          color: '#FFFFFF',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          borderBottom: '1px solid #1E293B'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
            <button
              type="button"
              onClick={onBack}
              style={{
                background: '#1E293B',
                border: '1px solid #334155',
                color: '#F8FAFC',
                padding: '8px 16px',
                borderRadius: '8px',
                fontSize: '13px',
                fontWeight: '700',
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                transition: 'all 0.2s ease'
              }}
            >
              <ArrowLeft size={15} /> Back to Customers
            </button>

            <div style={{ width: '1px', height: '24px', backgroundColor: '#334155' }} />

            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
              <h2 style={{ fontSize: '18px', fontWeight: '800', margin: 0, color: '#FFFFFF' }}>
                {customer.companyName}
              </h2>
              <span style={{ fontSize: '12px', padding: '3px 8px', borderRadius: '6px', backgroundColor: '#1E293B', color: '#94A3B8', border: '1px solid #334155', fontWeight: '700' }}>
                {customer.customerCode || customer.id}
              </span>

              {/* Zoho Status Badge */}
              {customer.source === 'Zoho Books' || customer.zohoContactId ? (
                <span style={{
                  fontSize: '11px',
                  padding: '3px 10px',
                  borderRadius: '6px',
                  backgroundColor: '#581C87',
                  color: '#E9D5FF',
                  border: '1px solid #7E22CE',
                  fontWeight: '800',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '5px'
                }}>
                  ⚡ ZOHO CONNECTED {customer.zohoContactId ? `(${customer.zohoContactId})` : ''}
                </span>
              ) : (
                <span style={{
                  fontSize: '11px',
                  padding: '3px 10px',
                  borderRadius: '6px',
                  backgroundColor: '#164E63',
                  color: '#67E8F9',
                  border: '1px solid #0E7490',
                  fontWeight: '800',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '5px'
                }}>
                  ✨ BUSINZ ACCOUNT
                </span>
              )}
            </div>
          </div>

          {/* Right Top Action Bar */}
          <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
            <button
              type="button"
              onClick={() => onOpenWhatsAppChat ? onOpenWhatsAppChat(customer) : onNavigateTab('WhatsApp Inbox')}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '8px 16px',
                backgroundColor: '#16A34A',
                color: '#FFFFFF',
                border: 'none',
                borderRadius: '8px',
                fontSize: '13px',
                fontWeight: '700',
                cursor: 'pointer',
                boxShadow: '0 2px 6px rgba(22, 163, 74, 0.3)'
              }}
            >
              <MessageSquare size={15} /> WhatsApp Chat
            </button>

            <button
              type="button"
              onClick={() => onEditCustomer(customer)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '8px 16px',
                backgroundColor: '#0E7490',
                color: '#FFFFFF',
                border: 'none',
                borderRadius: '8px',
                fontSize: '13px',
                fontWeight: '700',
                cursor: 'pointer',
                boxShadow: '0 2px 6px rgba(14, 116, 144, 0.3)'
              }}
              title="Modify customer details & synchronize updates directly to Zoho Books"
            >
              <Edit3 size={15} /> Edit & Sync to Zoho
            </button>
          </div>
        </div>

        {/* 3-COLUMN MAIN WORKSPACE */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: '310px 1fr 330px',
          gap: '16px',
          padding: '16px 20px',
          flex: 1,
          minHeight: 'calc(100vh - 180px)',
          backgroundColor: '#F1F5F9'
        }}>

          {/* ───────────────────────────────────────────────────────── */}
          {/* COLUMN 1: LEFT PROFILE & CONTACT INFORMATION (310px) */}
          {/* ───────────────────────────────────────────────────────── */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', overflowY: 'auto', paddingRight: '4px' }}>
            
            {/* Top Profile Card */}
            <div style={{ backgroundColor: '#FFFFFF', borderRadius: '12px', padding: '18px', border: '1px solid #E2E8F0', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '14px' }}>
                <div style={{
                  width: '52px',
                  height: '52px',
                  borderRadius: '50%',
                  background: 'linear-gradient(135deg, #0E7490 0%, #155E75 100%)',
                  color: '#FFFFFF',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '20px',
                  fontWeight: '800',
                  boxShadow: '0 4px 10px rgba(14, 116, 144, 0.3)'
                }}>
                  {customer.companyName?.charAt(0) || 'C'}
                </div>
                <div style={{ overflow: 'hidden' }}>
                  <h4 style={{ margin: 0, fontSize: '15px', fontWeight: '800', color: '#0F172A', whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden' }}>
                    {customer.primaryContact?.name || customer.customerName || customer.companyName}
                  </h4>
                  <div style={{ fontSize: '12px', color: '#64748B', margin: '2px 0 0', whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden' }}>
                    {customer.primaryContact?.email || 'sales@' + customer.companyName.toLowerCase().replace(/[^a-z0-9]/g, '') + '.com'}
                  </div>
                  <div style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', marginTop: '4px', fontSize: '11px', color: '#0E7490', fontWeight: '700' }}>
                    <span>👤 Rep: {customer.assignedSalesperson || customer.salesPerson || activeAccountUser}</span>
                  </div>
                </div>
              </div>

              {/* Quick Circular Action Buttons (Matching Video: Email, Call, Task, WhatsApp, Notes, More) */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '10px', borderTop: '1px solid #F1F5F9' }}>
                
                {/* Email */}
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
                  <button
                    type="button"
                    onClick={() => window.open(`mailto:${customer.primaryContact?.email || ''}`)}
                    style={{
                      width: '38px',
                      height: '38px',
                      borderRadius: '50%',
                      backgroundColor: '#F0FDFA',
                      border: '1px solid #CCFBF1',
                      color: '#0E7490',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      cursor: 'pointer'
                    }}
                    title="Send Email"
                  >
                    <Mail size={16} />
                  </button>
                  <span style={{ fontSize: '10px', color: '#64748B', fontWeight: '700' }}>Email</span>
                </div>

                {/* Call */}
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
                  <button
                    type="button"
                    onClick={() => window.open(`tel:${customer.primaryContact?.phone || ''}`)}
                    style={{
                      width: '38px',
                      height: '38px',
                      borderRadius: '50%',
                      backgroundColor: '#EFF6FF',
                      border: '1px solid #DBEAFE',
                      color: '#2563EB',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      cursor: 'pointer'
                    }}
                    title="Call Customer"
                  >
                    <Phone size={16} />
                  </button>
                  <span style={{ fontSize: '10px', color: '#64748B', fontWeight: '700' }}>Call</span>
                </div>

                {/* Task */}
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
                  <button
                    type="button"
                    onClick={() => setProfileTab('Tasks')}
                    style={{
                      width: '38px',
                      height: '38px',
                      borderRadius: '50%',
                      backgroundColor: '#FDF4FF',
                      border: '1px solid #F5D0FE',
                      color: '#A21CAF',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      cursor: 'pointer'
                    }}
                    title="Add Follow-up Task"
                  >
                    <CheckCircle2 size={16} />
                  </button>
                  <span style={{ fontSize: '10px', color: '#64748B', fontWeight: '700' }}>Task</span>
                </div>

                {/* WhatsApp */}
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
                  <button
                    type="button"
                    onClick={() => onOpenWhatsAppChat ? onOpenWhatsAppChat(customer) : onNavigateTab('WhatsApp Inbox')}
                    style={{
                      width: '38px',
                      height: '38px',
                      borderRadius: '50%',
                      backgroundColor: '#F0FDF4',
                      border: '1px solid #DCFCE7',
                      color: '#16A34A',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      cursor: 'pointer'
                    }}
                    title="Open WhatsApp"
                  >
                    <MessageSquare size={16} />
                  </button>
                  <span style={{ fontSize: '10px', color: '#64748B', fontWeight: '700' }}>WhatsApp</span>
                </div>

                {/* Notes */}
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
                  <button
                    type="button"
                    onClick={() => setProfileTab('Notes')}
                    style={{
                      width: '38px',
                      height: '38px',
                      borderRadius: '50%',
                      backgroundColor: '#FFFBEB',
                      border: '1px solid #FEF3C7',
                      color: '#D97706',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      cursor: 'pointer'
                    }}
                    title="Customer Notes"
                  >
                    <FileText size={16} />
                  </button>
                  <span style={{ fontSize: '10px', color: '#64748B', fontWeight: '700' }}>Notes</span>
                </div>

                {/* More */}
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
                  <button
                    type="button"
                    onClick={() => onEditCustomer(customer)}
                    style={{
                      width: '38px',
                      height: '38px',
                      borderRadius: '50%',
                      backgroundColor: '#F8FAFC',
                      border: '1px solid #E2E8F0',
                      color: '#64748B',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      cursor: 'pointer'
                    }}
                    title="Edit Customer"
                  >
                    <MoreHorizontal size={16} />
                  </button>
                  <span style={{ fontSize: '10px', color: '#64748B', fontWeight: '700' }}>More</span>
                </div>

              </div>
            </div>

            {/* Expandable Contact Information Card (Matching Video) */}
            <div style={{ backgroundColor: '#FFFFFF', borderRadius: '12px', border: '1px solid #E2E8F0', overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
              <div style={{
                padding: '14px 16px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                borderBottom: isContactInfoExpanded ? '1px solid #F1F5F9' : 'none',
                backgroundColor: '#FFFFFF'
              }}>
                <div>
                  <h4 style={{ margin: 0, fontSize: '13px', fontWeight: '800', color: '#0F172A' }}>Contact Information</h4>
                  <div style={{ fontSize: '11px', color: '#94A3B8' }}>Manage contact details and synchronization</div>
                </div>
                <button
                  type="button"
                  onClick={() => setIsContactInfoExpanded(!isContactInfoExpanded)}
                  style={{
                    backgroundColor: '#EFF6FF',
                    border: '1px solid #DBEAFE',
                    color: '#2563EB',
                    fontSize: '11px',
                    fontWeight: '800',
                    padding: '3px 8px',
                    borderRadius: '6px',
                    cursor: 'pointer'
                  }}
                >
                  {isContactInfoExpanded ? 'Collapse' : 'Expand'}
                </button>
              </div>

              {isContactInfoExpanded && (
                <div style={{ padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: '12px', fontSize: '12px' }}>
                  
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', color: '#64748B', marginBottom: '2px' }}>
                      <span>Contact Name</span>
                      <span style={{ fontSize: '9px', backgroundColor: '#F3E8FF', color: '#7E22CE', padding: '1px 4px', borderRadius: '4px', fontWeight: '800' }}>⚡ Zoho Core</span>
                    </div>
                    <div style={{ fontWeight: '700', color: '#0F172A' }}>{customer.primaryContact?.name || customer.customerName || '—'}</div>
                  </div>

                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', color: '#64748B', marginBottom: '2px' }}>
                      <span>Company Name</span>
                      <span style={{ fontSize: '9px', backgroundColor: '#F3E8FF', color: '#7E22CE', padding: '1px 4px', borderRadius: '4px', fontWeight: '800' }}>⚡ Zoho Core</span>
                    </div>
                    <div style={{ fontWeight: '700', color: '#0F172A' }}>{customer.companyName}</div>
                  </div>

                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', color: '#64748B', marginBottom: '2px' }}>
                      <span>Email</span>
                      <span style={{ fontSize: '9px', backgroundColor: '#F3E8FF', color: '#7E22CE', padding: '1px 4px', borderRadius: '4px', fontWeight: '800' }}>⚡ Zoho Core</span>
                    </div>
                    <div style={{ fontWeight: '700', color: '#0F172A' }}>{customer.primaryContact?.email || '—'}</div>
                  </div>

                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', color: '#64748B', marginBottom: '2px' }}>
                      <span>Phone</span>
                      <span style={{ fontSize: '9px', backgroundColor: '#F3E8FF', color: '#7E22CE', padding: '1px 4px', borderRadius: '4px', fontWeight: '800' }}>⚡ Zoho Core</span>
                    </div>
                    <div style={{ fontWeight: '700', color: '#0F172A' }}>{customer.primaryContact?.phone || '—'}</div>
                  </div>

                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', color: '#64748B', marginBottom: '2px' }}>
                      <span>Designation / Role</span>
                      <span style={{ fontSize: '9px', backgroundColor: '#F3E8FF', color: '#7E22CE', padding: '1px 4px', borderRadius: '4px', fontWeight: '800' }}>⚡ Zoho Core</span>
                    </div>
                    <div style={{ fontWeight: '700', color: '#0F172A' }}>{customer.primaryContact?.designation || 'Purchase / Commercial Head'}</div>
                  </div>

                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', color: '#64748B', marginBottom: '2px' }}>
                      <span>Tags & Industry</span>
                      <span style={{ fontSize: '9px', backgroundColor: '#ECFEFF', color: '#0E7490', padding: '1px 4px', borderRadius: '4px', fontWeight: '800' }}>✨ CR Add-on</span>
                    </div>
                    <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap', marginTop: '2px' }}>
                      <span style={{ backgroundColor: '#F1F5F9', color: '#475569', padding: '2px 6px', borderRadius: '4px', fontSize: '11px', fontWeight: '700' }}>{customer.customerType}</span>
                      <span style={{ backgroundColor: '#F1F5F9', color: '#475569', padding: '2px 6px', borderRadius: '4px', fontSize: '11px', fontWeight: '700' }}>{customer.industry}</span>
                    </div>
                  </div>

                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', color: '#64748B', marginBottom: '2px' }}>
                      <span>Lead Owner</span>
                      <span style={{ fontSize: '9px', backgroundColor: '#ECFEFF', color: '#0E7490', padding: '1px 4px', borderRadius: '4px', fontWeight: '800' }}>✨ CR Add-on</span>
                    </div>
                    <div style={{ fontWeight: '700', color: '#0E7490', display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#0E7490' }}></span>
                      {customer.assignedSalesperson || customer.salesPerson || activeAccountUser}
                    </div>
                  </div>

                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', color: '#64748B', marginBottom: '2px' }}>
                      <span>Location</span>
                      <span style={{ fontSize: '9px', backgroundColor: '#F3E8FF', color: '#7E22CE', padding: '1px 4px', borderRadius: '4px', fontWeight: '800' }}>⚡ Zoho Core</span>
                    </div>
                    <div style={{ fontWeight: '700', color: '#0F172A' }}>{customer.city || '—'}, {customer.state || ''}</div>
                  </div>

                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', color: '#64748B', marginBottom: '2px' }}>
                      <span>Credit Limit & Terms</span>
                      <span style={{ fontSize: '9px', backgroundColor: '#ECFEFF', color: '#0E7490', padding: '1px 4px', borderRadius: '4px', fontWeight: '800' }}>✨ CR Add-on</span>
                    </div>
                    <div style={{ fontWeight: '700', color: '#059669' }}>
                      ₹ {Number(customer.creditLimit || 2500000).toLocaleString()} • {customer.creditDays || 30} Days
                    </div>
                  </div>

                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', color: '#64748B', marginBottom: '2px' }}>
                      <span>Lead Source</span>
                      <span style={{ fontSize: '9px', backgroundColor: '#F3E8FF', color: '#7E22CE', padding: '1px 4px', borderRadius: '4px', fontWeight: '800' }}>⚡ Zoho Core</span>
                    </div>
                    <div style={{ fontWeight: '700', color: '#0F172A' }}>{customer.source || 'Zoho Books'}</div>
                  </div>

                </div>
              )}
            </div>
          </div>

          {/* ───────────────────────────────────────────────────────── */}
          {/* COLUMN 2: CENTER HORIZONTAL TABS & WORKSPACE (FLEX 1) */}
          {/* ───────────────────────────────────────────────────────── */}
          <div style={{
            backgroundColor: '#FFFFFF',
            borderRadius: '12px',
            border: '1px solid #E2E8F0',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            boxShadow: '0 1px 3px rgba(0,0,0,0.05)'
          }}>
            
            {/* Top Horizontal Tab Strip (Matching Video: Timeline, Tasks, Notes, Quotations, WhatsApp Chat, etc.) */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              borderBottom: '1px solid #E2E8F0',
              backgroundColor: '#FFFFFF',
              overflowX: 'auto',
              padding: '0 12px'
            }}>
              {profileTabs.map(tab => {
                const isActive = profileTab === tab;
                return (
                  <button
                    key={tab}
                    type="button"
                    onClick={() => setProfileTab(tab)}
                    style={{
                      padding: '14px 16px',
                      border: 'none',
                      backgroundColor: 'transparent',
                      borderBottom: isActive ? '3px solid #0E7490' : '3px solid transparent',
                      color: isActive ? '#0E7490' : '#64748B',
                      fontWeight: isActive ? '800' : '600',
                      fontSize: '13px',
                      cursor: 'pointer',
                      whiteSpace: 'nowrap',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '6px'
                    }}
                  >
                    {tab}
                    {tab === 'Tasks' && currentTasks.length > 0 && (
                      <span style={{ fontSize: '10px', backgroundColor: '#ECFEFF', color: '#0E7490', padding: '1px 6px', borderRadius: '10px', fontWeight: '800' }}>
                        {currentTasks.filter(t => !t.completed).length}
                      </span>
                    )}
                    {tab === 'Notes' && currentNotes.length > 0 && (
                      <span style={{ fontSize: '10px', backgroundColor: '#FEF3C7', color: '#B45309', padding: '1px 6px', borderRadius: '10px', fontWeight: '800' }}>
                        {currentNotes.length}
                      </span>
                    )}
                    {tab === 'Quotations' && custQuotations.length > 0 && (
                      <span style={{ fontSize: '10px', backgroundColor: '#DCFCE7', color: '#16A34A', padding: '1px 6px', borderRadius: '10px', fontWeight: '800' }}>
                        {custQuotations.length}
                      </span>
                    )}
                    {tab === 'Details' && (
                      <span style={{ fontSize: '9px', backgroundColor: '#F3E8FF', color: '#7E22CE', padding: '1px 5px', borderRadius: '4px', fontWeight: '800' }}>
                        Zoho vs CR
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            {/* Tab Body Workspace */}
            <div style={{ padding: '20px', flex: 1, overflowY: 'auto', backgroundColor: '#FAFAFA' }}>
              
              {/* 1. TIMELINE TAB (MATCHING REFERENCE VIDEO) */}
              {profileTab === 'Timeline' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <h4 style={{ margin: 0, fontSize: '14px', fontWeight: '800', color: '#0F172A' }}>Activity & Touchpoint Timeline</h4>
                    <span style={{ fontSize: '12px', color: '#64748B' }}>Audit stream synchronized with Businz ERP</span>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', position: 'relative', paddingLeft: '16px' }}>
                    {/* Vertical Line */}
                    <div style={{ position: 'absolute', left: '23px', top: '10px', bottom: '10px', width: '2px', backgroundColor: '#E2E8F0' }} />

                    {/* Event 1 */}
                    <div style={{ display: 'flex', gap: '14px', position: 'relative' }}>
                      <div style={{ width: '16px', height: '16px', borderRadius: '50%', backgroundColor: '#0E7490', border: '3px solid #FFFFFF', boxShadow: '0 0 0 2px #0E7490', zIndex: 1, marginTop: '4px' }} />
                      <div style={{ backgroundColor: '#FFFFFF', padding: '12px 16px', borderRadius: '8px', border: '1px solid #E2E8F0', flex: 1 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                          <strong style={{ fontSize: '13px', color: '#0F172A' }}>Account Active in Businz</strong>
                          <span style={{ fontSize: '11px', color: '#94A3B8' }}>Today</span>
                        </div>
                        <p style={{ fontSize: '12px', color: '#475569', margin: 0 }}>
                          Assigned to Lead Owner <strong>{customer.assignedSalesperson || customer.salesPerson || activeAccountUser}</strong>. Commercial terms configured for B2B solar structure dispatch.
                        </p>
                      </div>
                    </div>

                    {/* Event 2 */}
                    <div style={{ display: 'flex', gap: '14px', position: 'relative' }}>
                      <div style={{ width: '16px', height: '16px', borderRadius: '50%', backgroundColor: '#7E22CE', border: '3px solid #FFFFFF', boxShadow: '0 0 0 2px #7E22CE', zIndex: 1, marginTop: '4px' }} />
                      <div style={{ backgroundColor: '#FFFFFF', padding: '12px 16px', borderRadius: '8px', border: '1px solid #E2E8F0', flex: 1 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                          <strong style={{ fontSize: '13px', color: '#7E22CE' }}>⚡ Zoho Books Integration Link</strong>
                          <span style={{ fontSize: '11px', color: '#94A3B8' }}>Zoho API v2</span>
                        </div>
                        <p style={{ fontSize: '12px', color: '#475569', margin: 0 }}>
                          Contact synchronized with Zoho Books Contact ID: <strong>{customer.zohoContactId || 'ZOHO_AUTO_LINKED'}</strong>. Accounting ledgers and invoices connected.
                        </p>
                      </div>
                    </div>

                    {/* Event 3 */}
                    <div style={{ display: 'flex', gap: '14px', position: 'relative' }}>
                      <div style={{ width: '16px', height: '16px', borderRadius: '50%', backgroundColor: '#10B981', border: '3px solid #FFFFFF', boxShadow: '0 0 0 2px #10B981', zIndex: 1, marginTop: '4px' }} />
                      <div style={{ backgroundColor: '#FFFFFF', padding: '12px 16px', borderRadius: '8px', border: '1px solid #E2E8F0', flex: 1 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                          <strong style={{ fontSize: '13px', color: '#0F172A' }}>Payment & Commercial Terms Verified</strong>
                          <span style={{ fontSize: '11px', color: '#94A3B8' }}>Finance Checked</span>
                        </div>
                        <p style={{ fontSize: '12px', color: '#475569', margin: 0 }}>
                          Payment Terms: <strong>{customer.paymentTerms || '50% Advance + 50% Dispatch'}</strong> • Credit Days: <strong>{customer.creditDays || 30} Days</strong>.
                        </p>
                      </div>
                    </div>

                    {/* Event 4 */}
                    <div style={{ display: 'flex', gap: '14px', position: 'relative' }}>
                      <div style={{ width: '16px', height: '16px', borderRadius: '50%', backgroundColor: '#F59E0B', border: '3px solid #FFFFFF', boxShadow: '0 0 0 2px #F59E0B', zIndex: 1, marginTop: '4px' }} />
                      <div style={{ backgroundColor: '#FFFFFF', padding: '12px 16px', borderRadius: '8px', border: '1px solid #E2E8F0', flex: 1 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                          <strong style={{ fontSize: '13px', color: '#0F172A' }}>Dispatch & KYC Location Confirmed</strong>
                          <span style={{ fontSize: '11px', color: '#94A3B8' }}>Dispatch Gate</span>
                        </div>
                        <p style={{ fontSize: '12px', color: '#475569', margin: 0 }}>
                          GSTIN: <strong>{customer.gstNumber || 'Unregistered'}</strong> • Address: {customer.address || 'Standard Plant Dispatch'}
                        </p>
                      </div>
                    </div>

                  </div>
                </div>
              )}

              {/* 2. TASKS TAB (INTERACTIVE WITH PERSISTENCE) */}
              {profileTab === 'Tasks' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <h4 style={{ margin: 0, fontSize: '14px', fontWeight: '800', color: '#0F172A' }}>Customer Follow-ups & Tasks</h4>
                    <span style={{ fontSize: '12px', color: '#64748B' }}>{currentTasks.filter(t => !t.completed).length} Pending</span>
                  </div>

                  {/* Add Task Box */}
                  <div style={{ backgroundColor: '#FFFFFF', padding: '12px 16px', borderRadius: '8px', border: '1px solid #E2E8F0', display: 'flex', gap: '10px', alignItems: 'center' }}>
                    <input
                      type="text"
                      placeholder="What task needs to be completed for this customer?"
                      value={newTaskInput}
                      onChange={(e) => setNewTaskInput(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleAddCustomerTask(custKey)}
                      style={{ flex: 1, border: '1px solid #CBD5E1', borderRadius: '6px', padding: '8px 12px', fontSize: '13px', outline: 'none' }}
                    />
                    <input
                      type="date"
                      value={newTaskDueDate}
                      onChange={(e) => setNewTaskDueDate(e.target.value)}
                      style={{ border: '1px solid #CBD5E1', borderRadius: '6px', padding: '8px 10px', fontSize: '12px', outline: 'none' }}
                    />
                    <button
                      type="button"
                      onClick={() => handleAddCustomerTask(custKey)}
                      style={{ backgroundColor: '#0E7490', color: '#FFFFFF', border: 'none', padding: '8px 16px', borderRadius: '6px', fontSize: '12px', fontWeight: '800', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                    >
                      <Plus size={14} /> Add Task
                    </button>
                  </div>

                  {/* Task Items List */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {currentTasks.map(task => (
                      <div
                        key={task.id}
                        style={{
                          backgroundColor: '#FFFFFF',
                          padding: '12px 16px',
                          borderRadius: '8px',
                          border: '1px solid #E2E8F0',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          opacity: task.completed ? 0.65 : 1
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <input
                            type="checkbox"
                            checked={task.completed}
                            onChange={() => handleToggleCustomerTask(custKey, task.id)}
                            style={{ accentColor: '#0E7490', cursor: 'pointer', width: '16px', height: '16px' }}
                          />
                          <span style={{ fontSize: '13px', fontWeight: task.completed ? '500' : '700', color: '#0F172A', textDecoration: task.completed ? 'line-through' : 'none' }}>
                            {task.text}
                          </span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <span style={{ fontSize: '11px', color: '#64748B', backgroundColor: '#F1F5F9', padding: '2px 8px', borderRadius: '4px' }}>
                            Due: {task.dueDate}
                          </span>
                          <button
                            type="button"
                            onClick={() => handleDeleteCustomerTask(custKey, task.id)}
                            style={{ background: 'none', border: 'none', color: '#94A3B8', cursor: 'pointer', padding: '2px' }}
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* 3. NOTES TAB (INTERACTIVE WITH PERSISTENCE) */}
              {profileTab === 'Notes' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <h4 style={{ margin: 0, fontSize: '14px', fontWeight: '800', color: '#0F172A' }}>Internal CRM Account Notes</h4>
                    <span style={{ fontSize: '12px', color: '#64748B' }}>Shared with sales & engineering reps</span>
                  </div>

                  {/* Add Note Composer */}
                  <div style={{ backgroundColor: '#FFFFFF', padding: '14px', borderRadius: '8px', border: '1px solid #E2E8F0', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    <textarea
                      rows={3}
                      placeholder="Write an internal note, meeting minutes, or project update for this customer..."
                      value={newNoteInput}
                      onChange={(e) => setNewNoteInput(e.target.value)}
                      style={{ width: '100%', border: '1px solid #CBD5E1', borderRadius: '6px', padding: '10px', fontSize: '13px', outline: 'none', resize: 'vertical', boxSizing: 'border-box' }}
                    />
                    <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                      <button
                        type="button"
                        onClick={() => handleAddCustomerNote(custKey)}
                        style={{ backgroundColor: '#0E7490', color: '#FFFFFF', border: 'none', padding: '8px 18px', borderRadius: '6px', fontSize: '12px', fontWeight: '800', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                      >
                        <Send size={14} /> Post Note
                      </button>
                    </div>
                  </div>

                  {/* Notes Feed */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    {currentNotes.map(note => (
                      <div key={note.id} style={{ backgroundColor: '#FFFFFF', padding: '14px 16px', borderRadius: '8px', border: '1px solid #E2E8F0' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <span style={{ fontSize: '11px', fontWeight: '800', color: '#0E7490', backgroundColor: '#ECFEFF', padding: '2px 8px', borderRadius: '4px' }}>
                              {note.author}
                            </span>
                          </div>
                          <span style={{ fontSize: '11px', color: '#94A3B8' }}>{note.date}</span>
                        </div>
                        <p style={{ fontSize: '13px', color: '#334155', margin: 0, lineHeight: 1.5 }}>
                          {note.text}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* 4. QUOTATIONS TAB */}
              {profileTab === 'Quotations' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <h4 style={{ margin: 0, fontSize: '14px', fontWeight: '800', color: '#0F172A' }}>Commercial Quotations</h4>
                    <button
                      type="button"
                      onClick={() => onNavigateTab('Quotations')}
                      style={{ backgroundColor: '#0E7490', color: '#FFFFFF', border: 'none', padding: '6px 12px', borderRadius: '6px', fontSize: '12px', fontWeight: '700', cursor: 'pointer' }}
                    >
                      + New Quotation
                    </button>
                  </div>

                  {custQuotations.length === 0 ? (
                    <div style={{ backgroundColor: '#FFFFFF', padding: '30px', borderRadius: '8px', border: '1px solid #E2E8F0', textAlign: 'center', color: '#64748B' }}>
                      <p style={{ fontSize: '13px', margin: '0 0 12px' }}>No commercial quotations have been generated for {customer.companyName} yet.</p>
                      <button
                        type="button"
                        onClick={() => onNavigateTab('Quotations')}
                        style={{ padding: '8px 16px', backgroundColor: '#F0FDFA', border: '1px solid #CCFBF1', color: '#0E7490', borderRadius: '6px', fontSize: '12px', fontWeight: '800', cursor: 'pointer' }}
                      >
                        Generate Solar Structure Quotation
                      </button>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      {custQuotations.map((q, idx) => (
                        <div key={q.id || idx} style={{ backgroundColor: '#FFFFFF', padding: '14px', borderRadius: '8px', border: '1px solid #E2E8F0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <div>
                            <div style={{ fontWeight: '700', color: '#0F172A', fontSize: '13px' }}>{q.quotationNumber || `QUOTE-${idx + 1}`}</div>
                            <div style={{ fontSize: '12px', color: '#64748B' }}>Date: {q.date || 'Recent'} • Valid for 15 Days</div>
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                            <span style={{ fontSize: '14px', fontWeight: '800', color: '#0F172A' }}>₹ {Number(q.totalAmount || q.amount || 1500000).toLocaleString()}</span>
                            <span style={{ fontSize: '11px', backgroundColor: '#DCFCE7', color: '#16A34A', padding: '2px 8px', borderRadius: '4px', fontWeight: '700' }}>{q.status || 'Active'}</span>
                            <button
                              type="button"
                              onClick={() => onNavigateTab('Quotations')}
                              style={{ padding: '4px 10px', backgroundColor: '#F1F5F9', border: '1px solid #CBD5E1', borderRadius: '6px', fontSize: '11px', fontWeight: '700', cursor: 'pointer' }}
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

              {/* 5. WHATSAPP CHAT TAB */}
              {profileTab === 'WhatsApp Chat' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <h4 style={{ margin: 0, fontSize: '14px', fontWeight: '800', color: '#0F172A' }}>WhatsApp Business Messenger</h4>
                    <span style={{ fontSize: '12px', color: '#16A34A', fontWeight: '700' }}>● Connected Number</span>
                  </div>

                  <div style={{ backgroundColor: '#FFFFFF', padding: '20px', borderRadius: '8px', border: '1px solid #E2E8F0', display: 'flex', flexDirection: 'column', gap: '14px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <div style={{ width: '40px', height: '40px', borderRadius: '50%', backgroundColor: '#DCFCE7', color: '#16A34A', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <MessageSquare size={20} />
                      </div>
                      <div>
                        <div style={{ fontWeight: '800', color: '#0F172A', fontSize: '14px' }}>{customer.primaryContact?.name || customer.companyName}</div>
                        <div style={{ fontSize: '12px', color: '#64748B' }}>WhatsApp: {customer.primaryContact?.whatsapp || customer.primaryContact?.phone || 'Not Registered'}</div>
                      </div>
                    </div>

                    <div style={{ backgroundColor: '#F0FDF4', border: '1px solid #BBF7D0', padding: '12px', borderRadius: '8px', fontSize: '12px', color: '#166534' }}>
                      💡 You can launch direct WhatsApp conversations, share quotation PDFs, and dispatch notifications with 1-click.
                    </div>

                    <button
                      type="button"
                      onClick={() => onOpenWhatsAppChat ? onOpenWhatsAppChat(customer) : onNavigateTab('WhatsApp Inbox')}
                      style={{ backgroundColor: '#16A34A', color: '#FFFFFF', border: 'none', padding: '12px', borderRadius: '8px', fontSize: '13px', fontWeight: '800', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', boxShadow: '0 4px 10px rgba(22, 163, 74, 0.25)' }}
                    >
                      <MessageSquare size={16} /> Open in WhatsApp Inbox
                    </button>
                  </div>
                </div>
              )}

              {/* 6. BOM ORDERS TAB */}
              {profileTab === 'BOM Orders' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <h4 style={{ margin: 0, fontSize: '14px', fontWeight: '800', color: '#0F172A' }}>Linked Bills of Materials (BOM)</h4>
                    <button
                      type="button"
                      onClick={() => onNavigateTab('Sales BOM')}
                      style={{ backgroundColor: '#0E7490', color: '#FFFFFF', border: 'none', padding: '6px 12px', borderRadius: '6px', fontSize: '12px', fontWeight: '700', cursor: 'pointer' }}
                    >
                      + Create Sales BOM
                    </button>
                  </div>

                  <div style={{ backgroundColor: '#FFFFFF', padding: '24px', borderRadius: '8px', border: '1px solid #E2E8F0', textAlign: 'center' }}>
                    <Layers size={36} style={{ color: '#0E7490', margin: '0 auto 10px' }} />
                    <h5 style={{ fontSize: '14px', fontWeight: '800', color: '#0F172A', margin: '0 0 6px' }}>Engineered Solar Structures for {customer.companyName}</h5>
                    <p style={{ fontSize: '12px', color: '#64748B', maxWidth: '450px', margin: '0 auto 16px' }}>
                      Access technical BOM configurations, module presets, cold-formed section weights, and production orders generated for this client.
                    </p>
                    <button
                      type="button"
                      onClick={() => onNavigateTab('Sales BOM')}
                      style={{ padding: '8px 18px', backgroundColor: '#0E7490', color: '#FFFFFF', border: 'none', borderRadius: '8px', fontSize: '12px', fontWeight: '800', cursor: 'pointer' }}
                    >
                      Open BOM Orders Center
                    </button>
                  </div>
                </div>
              )}

              {/* 7. OPPORTUNITIES TAB */}
              {profileTab === 'Opportunities' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <h4 style={{ margin: 0, fontSize: '14px', fontWeight: '800', color: '#0F172A' }}>Sales Deals & Pipelines</h4>
                    <button
                      type="button"
                      onClick={() => onNavigateTab('Opportunities')}
                      style={{ backgroundColor: '#0E7490', color: '#FFFFFF', border: 'none', padding: '6px 12px', borderRadius: '6px', fontSize: '12px', fontWeight: '700', cursor: 'pointer' }}
                    >
                      + New Opportunity
                    </button>
                  </div>

                  {custDeals.length === 0 ? (
                    <div style={{ backgroundColor: '#FFFFFF', padding: '30px', borderRadius: '8px', border: '1px solid #E2E8F0', textAlign: 'center', color: '#64748B' }}>
                      <p style={{ fontSize: '13px', margin: '0 0 12px' }}>No active opportunities recorded for this customer.</p>
                      <button
                        type="button"
                        onClick={() => onNavigateTab('Opportunities')}
                        style={{ padding: '8px 16px', backgroundColor: '#F0FDFA', border: '1px solid #CCFBF1', color: '#0E7490', borderRadius: '6px', fontSize: '12px', fontWeight: '800', cursor: 'pointer' }}
                      >
                        Add Opportunity to Sales Pipeline
                      </button>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      {custDeals.map(opp => (
                        <div key={opp.id} style={{ backgroundColor: '#FFFFFF', padding: '14px 16px', borderRadius: '8px', border: '1px solid #E2E8F0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <div>
                            <div style={{ fontWeight: '700', color: '#0F172A', fontSize: '13px' }}>{opp.title}</div>
                            <div style={{ fontSize: '12px', color: '#64748B' }}>Stage: <strong style={{ color: '#0E7490' }}>{opp.stage}</strong></div>
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                            <span style={{ fontSize: '14px', fontWeight: '800', color: '#0F172A' }}>₹ {Number(opp.dealValue || 0).toLocaleString()}</span>
                            <button
                              type="button"
                              onClick={() => onNavigateTab('Opportunities')}
                              style={{ padding: '6px 12px', backgroundColor: '#0E7490', color: '#FFFFFF', border: 'none', borderRadius: '6px', fontSize: '11px', fontWeight: '700', cursor: 'pointer' }}
                            >
                              View Pipeline
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* 8. DETAILS TAB: ZOHO CORE VS CONTROL ROOM ADD-ONS DELINEATION */}
              {profileTab === 'Details' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <h4 style={{ margin: 0, fontSize: '14px', fontWeight: '800', color: '#0F172A' }}>
                        Field-by-Field Breakdown: Zoho Books vs Businz Add-ons
                      </h4>
                      <p style={{ fontSize: '12px', color: '#64748B', margin: '2px 0 0' }}>
                        Distinguishes accounting data synchronized with Zoho Books from engineering intelligence in Businz.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => onEditCustomer(customer)}
                      style={{ backgroundColor: '#0E7490', color: '#FFFFFF', border: 'none', padding: '8px 16px', borderRadius: '8px', fontSize: '12px', fontWeight: '800', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}
                    >
                      <Edit3 size={14} /> Modify & Sync
                    </button>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                    
                    {/* BOX 1: ZOHO BOOKS CORE ACCOUNTING FIELDS */}
                    <div style={{ backgroundColor: '#FFFFFF', borderRadius: '10px', border: '1px solid #E9D5FF', padding: '16px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px', paddingBottom: '8px', borderBottom: '1px solid #F3E8FF' }}>
                        <h5 style={{ margin: 0, fontSize: '13px', fontWeight: '800', color: '#7E22CE', display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <span>⚡</span> Zoho Books Core (Synced)
                        </h5>
                        <span style={{ fontSize: '10px', backgroundColor: '#F3E8FF', color: '#7E22CE', padding: '2px 6px', borderRadius: '4px', fontWeight: '800' }}>
                          Required for Invoicing
                        </span>
                      </div>

                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '12px', color: '#334155' }}>
                        <div><strong>Company Name:</strong> {customer.companyName}</div>
                        <div><strong>Primary Contact:</strong> {customer.primaryContact?.name || customer.customerName || '—'}</div>
                        <div><strong>Phone:</strong> {customer.primaryContact?.phone || '—'}</div>
                        <div><strong>Email:</strong> {customer.primaryContact?.email || '—'}</div>
                        <div><strong>Billing Address:</strong> {customer.address || '—'}</div>
                        <div><strong>City & State:</strong> {customer.city || '—'}, {customer.state || ''} - {customer.pincode || ''}</div>
                        <div><strong>Dispatch Address:</strong> {customer.dispatchAddress || customer.address || 'Same as billing'}</div>
                        <div><strong>GSTIN:</strong> {customer.gstNumber || 'Not Registered'}</div>
                        <div><strong>PAN:</strong> {customer.panNumber || '—'}</div>
                        <div><strong>Payment Terms:</strong> {customer.paymentTerms || '50% Advance + 50% Dispatch'}</div>
                        <div><strong>Zoho Contact ID:</strong> {customer.zohoContactId || 'Auto-generated on Sync'}</div>
                      </div>
                    </div>

                    {/* BOX 2: BUSINZ CRM ADD-ONS */}
                    <div style={{ backgroundColor: '#FFFFFF', borderRadius: '10px', border: '1px solid #CFFAFE', padding: '16px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px', paddingBottom: '8px', borderBottom: '1px solid #ECFEFF' }}>
                        <h5 style={{ margin: 0, fontSize: '13px', fontWeight: '800', color: '#0E7490', display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <span>✨</span> Businz CRM Add-ons
                        </h5>
                        <span style={{ fontSize: '10px', backgroundColor: '#ECFEFF', color: '#0E7490', padding: '2px 6px', borderRadius: '4px', fontWeight: '800' }}>
                          Engineering & Sales CRM
                        </span>
                      </div>

                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '12px', color: '#334155' }}>
                        <div><strong>Assigned Rep / Owner:</strong> {customer.assignedSalesperson || customer.salesPerson || activeAccountUser}</div>
                        <div><strong>Customer Type:</strong> {customer.customerType}</div>
                        <div><strong>Industry Domain:</strong> {customer.industry}</div>
                        <div><strong>Commercial Credit Limit:</strong> ₹ {Number(customer.creditLimit || 2500000).toLocaleString()}</div>
                        <div><strong>Credit Days Granted:</strong> {customer.creditDays || 30} Days</div>
                        <div><strong>Preferred Channel:</strong> WhatsApp & Direct Call</div>
                        <div><strong>Best Time to Call:</strong> 10:00 AM - 1:00 PM</div>
                        <div><strong>Engineering BOMs Linked:</strong> Active Solar Structural Orders</div>
                        <div><strong>Internal Account Notes:</strong> {customer.notes || 'B2B Client account.'}</div>
                      </div>
                    </div>

                  </div>
                </div>
              )}

            </div>
          </div>

          {/* ───────────────────────────────────────────────────────── */}
          {/* COLUMN 3: RIGHT ACCORDIONS (OVERVIEW, COMPANY, DEALS) (330px) */}
          {/* ───────────────────────────────────────────────────────── */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', overflowY: 'auto', paddingRight: '4px' }}>
            
            {/* ACCORDION 1: OVERVIEW (MATCHING VIDEO) */}
            <div style={{ backgroundColor: '#FFFFFF', borderRadius: '12px', border: '1px solid #E2E8F0', overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
              <div
                onClick={() => setIsOverviewOpen(!isOverviewOpen)}
                style={{
                  padding: '12px 16px',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  cursor: 'pointer',
                  backgroundColor: '#FFFFFF',
                  borderBottom: isOverviewOpen ? '1px solid #F1F5F9' : 'none'
                }}
              >
                <h4 style={{ margin: 0, fontSize: '13px', fontWeight: '800', color: '#0F172A', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  {isOverviewOpen ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                  Overview
                </h4>
                <span style={{ fontSize: '10px', color: '#94A3B8', fontWeight: '700' }}>Summary</span>
              </div>

              {isOverviewOpen && (
                <div style={{ padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: '10px', fontSize: '12px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#475569' }}>
                    <Calendar size={14} style={{ color: '#64748B' }} />
                    <div style={{ flex: 1 }}>
                      <div style={{ color: '#94A3B8', fontSize: '11px' }}>Created At</div>
                      <div style={{ fontWeight: '700', color: '#0F172A' }}>
                        {customer.createdAt ? new Date(customer.createdAt).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '08 Sep, 2026 12:59 PM'}
                      </div>
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#475569' }}>
                    <Clock size={14} style={{ color: '#64748B' }} />
                    <div style={{ flex: 1 }}>
                      <div style={{ color: '#94A3B8', fontSize: '11px' }}>Last Communication Date</div>
                      <div style={{ fontWeight: '700', color: '#0F172A' }}>Today, 11:30 AM</div>
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#475569' }}>
                    <Mail size={14} style={{ color: '#64748B' }} />
                    <div style={{ flex: 1 }}>
                      <div style={{ color: '#94A3B8', fontSize: '11px' }}>Last Email Sent Date</div>
                      <div style={{ fontWeight: '700', color: '#0F172A' }}>08 Sep, 2026</div>
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#475569' }}>
                    <Phone size={14} style={{ color: '#64748B' }} />
                    <div style={{ flex: 1 }}>
                      <div style={{ color: '#94A3B8', fontSize: '11px' }}>Last Call Done Date</div>
                      <div style={{ fontWeight: '700', color: '#0F172A' }}>Yesterday, 04:15 PM</div>
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#475569' }}>
                    <CheckCircle2 size={14} style={{ color: '#16A34A' }} />
                    <div style={{ flex: 1 }}>
                      <div style={{ color: '#94A3B8', fontSize: '11px' }}>Last Touchpoint</div>
                      <div style={{ fontWeight: '700', color: '#0F172A' }}>WhatsApp Quotation Follow-up</div>
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#475569' }}>
                    <MessageSquare size={14} style={{ color: '#16A34A' }} />
                    <div style={{ flex: 1 }}>
                      <div style={{ color: '#94A3B8', fontSize: '11px' }}>Preferred Channel</div>
                      <div style={{ fontWeight: '700', color: '#0F172A' }}>WhatsApp Business</div>
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#475569' }}>
                    <Clock size={14} style={{ color: '#0E7490' }} />
                    <div style={{ flex: 1 }}>
                      <div style={{ color: '#94A3B8', fontSize: '11px' }}>Best Time to Call</div>
                      <div style={{ fontWeight: '700', color: '#0F172A' }}>02:30 PM - 05:00 PM</div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* ACCORDION 2: COMPANY & ZOHO ACCOUNTING (MATCHING VIDEO) */}
            <div style={{ backgroundColor: '#FFFFFF', borderRadius: '12px', border: '1px solid #E2E8F0', overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
              <div
                onClick={() => setIsCompanyOpen(!isCompanyOpen)}
                style={{
                  padding: '12px 16px',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  cursor: 'pointer',
                  backgroundColor: '#FFFFFF',
                  borderBottom: isCompanyOpen ? '1px solid #F1F5F9' : 'none'
                }}
              >
                <h4 style={{ margin: 0, fontSize: '13px', fontWeight: '800', color: '#0F172A', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  {isCompanyOpen ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                  Company & Accounting
                </h4>
                <span style={{ fontSize: '10px', color: '#7E22CE', fontWeight: '800' }}>⚡ Zoho</span>
              </div>

              {isCompanyOpen && (
                <div style={{ padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '12px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: '#64748B' }}>Zoho Status:</span>
                    <span style={{ fontWeight: '800', color: '#7E22CE' }}>⚡ Connected</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: '#64748B' }}>Zoho Contact ID:</span>
                    <span style={{ fontWeight: '700', color: '#0F172A', fontFamily: 'monospace' }}>{customer.zohoContactId || 'AUTO_SYNCED'}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: '#64748B' }}>GSTIN:</span>
                    <span style={{ fontWeight: '700', color: '#0F172A', fontFamily: 'monospace' }}>{customer.gstNumber || 'Not Registered'}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: '#64748B' }}>PAN:</span>
                    <span style={{ fontWeight: '700', color: '#0F172A', fontFamily: 'monospace' }}>{customer.panNumber || '—'}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: '#64748B' }}>Payment Terms:</span>
                    <span style={{ fontWeight: '700', color: '#B45309' }}>{customer.paymentTerms || '50% Advance'}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: '#64748B' }}>Credit Days:</span>
                    <span style={{ fontWeight: '700', color: '#0F172A' }}>{customer.creditDays || 30} Days</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: '#64748B' }}>Credit Limit:</span>
                    <span style={{ fontWeight: '700', color: '#059669' }}>₹ {Number(customer.creditLimit || 2500000).toLocaleString()}</span>
                  </div>
                  <div style={{ borderTop: '1px solid #F1F5F9', paddingTop: '6px' }}>
                    <div style={{ color: '#64748B', fontSize: '11px' }}>Billing Address:</div>
                    <div style={{ color: '#0F172A', fontWeight: '600', marginTop: '2px', lineHeight: 1.4 }}>
                      {customer.address || 'Standard Registered Address'}
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* ACCORDION 3: OPEN DEALS (MATCHING VIDEO) */}
            <div style={{ backgroundColor: '#FFFFFF', borderRadius: '12px', border: '1px solid #E2E8F0', overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
              <div
                onClick={() => setIsDealsOpen(!isDealsOpen)}
                style={{
                  padding: '12px 16px',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  cursor: 'pointer',
                  backgroundColor: '#FFFFFF',
                  borderBottom: isDealsOpen ? '1px solid #F1F5F9' : 'none'
                }}
              >
                <h4 style={{ margin: 0, fontSize: '13px', fontWeight: '800', color: '#0F172A', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  {isDealsOpen ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                  Open Deals ({custDeals.length})
                </h4>
                <span style={{ fontSize: '10px', color: '#0E7490', fontWeight: '800' }}>Pipeline</span>
              </div>

              {isDealsOpen && (
                <div style={{ padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '12px' }}>
                  {custDeals.length === 0 ? (
                    <div style={{ color: '#64748B', fontSize: '12px', textAlign: 'center', padding: '10px 0' }}>
                      <span>No open deals currently recorded.</span>
                      <button
                        type="button"
                        onClick={() => onNavigateTab('Opportunities')}
                        style={{ display: 'block', margin: '8px auto 0', padding: '4px 10px', backgroundColor: '#F0FDFA', border: '1px solid #CCFBF1', color: '#0E7490', borderRadius: '4px', fontSize: '11px', fontWeight: '700', cursor: 'pointer' }}
                      >
                        + Create Deal
                      </button>
                    </div>
                  ) : (
                    custDeals.map(deal => (
                      <div key={deal.id} style={{ padding: '8px', backgroundColor: '#F8FAFC', borderRadius: '6px', border: '1px solid #E2E8F0' }}>
                        <div style={{ fontWeight: '700', color: '#0F172A' }}>{deal.title}</div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', color: '#64748B', fontSize: '11px', marginTop: '4px' }}>
                          <span>Stage: <strong style={{ color: '#0E7490' }}>{deal.stage}</strong></span>
                          <span style={{ fontWeight: '800', color: '#0F172A' }}>₹ {Number(deal.dealValue).toLocaleString()}</span>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>

          </div>

        </div>

      </div>
    </div>
  );
}
