import React, { useState, useEffect, useMemo } from 'react';
import {
  Mail, Send, Inbox, Archive, Trash2, Star,
  Search, RefreshCw, Paperclip, CheckCircle2, AlertCircle,
  Clock, Plus, Filter, ChevronRight, User, ArrowLeft,
  X, Check, Settings, ExternalLink, ShieldCheck, Tag
} from 'lucide-react';

const INITIAL_SUPPORT_EMAILS = [
  {
    id: 'mail-001',
    fromName: 'Rajesh Sharma',
    fromEmail: 'rajesh.sharma@tatapowersolar.com',
    company: 'Tata Power Solar Systems Ltd',
    subject: 'Technical query regarding Mini Rail 75mm wind load certificate',
    body: `Dear Tech Support Team,

We are currently evaluating the Mini Rail 75mm system (preset_3_mini_rail_75mm_new) for our 2.5 MW rooftop project in Gujarat. 
Could you please share the structural wind load calculation sheet and the aluminum alloy 6063-T6 tensile test certificate?

Also, please verify if the adhesive EPDM rubber padding is compatible with pre-coated Galvalume corrugated roofing sheets without causing galvanic corrosion.

Awaiting your prompt response.

Best regards,
Rajesh Sharma | Senior Project Engineer
Tata Power Solar Systems Ltd`,
    date: 'Today, 09:30 AM',
    timestamp: new Date().toISOString(),
    isRead: false,
    folder: 'inbox',
    category: 'Technical Query',
    priority: 'Urgent',
    hasAttachment: true,
    attachments: ['Project_Roof_Specs_Tata.pdf']
  },
  {
    id: 'mail-002',
    fromName: 'Karthik Narayanan',
    fromEmail: 'karthik@teorainn.in',
    company: 'Teorainn Solar Pvt Ltd',
    subject: 'Purlin spacing and mid-clamp torque requirements for Double C-Rail',
    body: `Hello Support,

We are installing the Double C-Rail structure at our site in Coimbatore. What is the recommended tightening torque for the M8 hex socket head bolts on the mid clamps? 

Is 12-14 Nm safe, or should we torque it up to 16 Nm? Please send the standard installation manual.

Thanks,
Karthik Narayanan
Technical Lead, Teorainn Solar`,
    date: 'Yesterday, 04:15 PM',
    timestamp: new Date(Date.now() - 86400000).toISOString(),
    isRead: true,
    folder: 'inbox',
    category: 'Installation Guide',
    priority: 'Normal',
    hasAttachment: false,
    attachments: []
  },
  {
    id: 'mail-003',
    fromName: 'Priya Sundaram',
    fromEmail: 'p.sundaram@vrmenergy.com',
    company: 'VRM Energy Consultancy Services',
    subject: 'BOS Solar Kit DCR specification confirmation for 500kW site',
    body: `Hi BUSINZ Tech Support,

Please confirm the component breakup for DCR BOS Solar Kit (preset_bos_500kw). We need to verify if the grounding lug and stainless steel cable clips (SS304) are included in the standard kit bill of materials.

Thank you,
Priya Sundaram`,
    date: '08 Oct 2026',
    timestamp: new Date(Date.now() - 172800000).toISOString(),
    isRead: true,
    folder: 'inbox',
    category: 'Specification Check',
    priority: 'High',
    hasAttachment: true,
    attachments: ['BOS_Component_Checklist.xlsx']
  }
];

export default function SupportMailInboxView({ userRole = 'Tech Support', onNavigateTab }) {
  const [emails, setEmails] = useState(() => {
    try {
      const stored = localStorage.getItem('controlroom_support_emails');
      return stored ? JSON.parse(stored) : INITIAL_SUPPORT_EMAILS;
    } catch {
      return INITIAL_SUPPORT_EMAILS;
    }
  });

  const [activeFolder, setActiveFolder] = useState('inbox'); // 'inbox' | 'technical' | 'sent' | 'archived'
  const [selectedEmailId, setSelectedEmailId] = useState('mail-001');
  const [searchQuery, setSearchQuery] = useState('');
  const [replyText, setReplyText] = useState('');
  const [isSendingReply, setIsSendingReply] = useState(false);
  const [showComposeModal, setShowComposeModal] = useState(false);
  const [showConfigModal, setShowConfigModal] = useState(false);
  const [toastMsg, setToastMsg] = useState(null);

  // Compose Modal Form
  const [composeForm, setComposeForm] = useState({
    to: '',
    subject: '',
    category: 'Technical Clarification',
    priority: 'Normal',
    body: '',
    attachment: ''
  });

  // Mail Server Config State
  const [serverConfig, setServerConfig] = useState(() => {
    try {
      const stored = localStorage.getItem('controlroom_mail_server_config');
      return stored ? JSON.parse(stored) : {
        provider: 'Google Workspace',
        email: 'support@businz.com',
        smtpHost: 'smtp.gmail.com',
        smtpPort: '587',
        imapHost: 'imap.gmail.com',
        imapPort: '993',
        status: 'Connected & Active'
      };
    } catch {
      return {
        provider: 'Google Workspace',
        email: 'support@businz.com',
        smtpHost: 'smtp.gmail.com',
        smtpPort: '587',
        imapHost: 'imap.gmail.com',
        imapPort: '993',
        status: 'Connected & Active'
      };
    }
  });

  // Persist emails
  const saveEmails = (newEmails) => {
    setEmails(newEmails);
    try {
      localStorage.setItem('controlroom_support_emails', JSON.stringify(newEmails));
    } catch (_) {}
  };

  const showToast = (text, type = 'success') => {
    setToastMsg({ text, type });
    setTimeout(() => setToastMsg(null), 4000);
  };

  // Filtered emails
  const filteredEmails = useMemo(() => {
    return emails.filter((em) => {
      const matchFolder =
        activeFolder === 'inbox' ? em.folder === 'inbox' :
        activeFolder === 'technical' ? (em.category === 'Technical Query' || em.category === 'Specification Check') :
        activeFolder === 'sent' ? em.folder === 'sent' :
        em.folder === 'archived';

      const q = searchQuery.toLowerCase().trim();
      const matchSearch =
        !q ||
        em.subject.toLowerCase().includes(q) ||
        em.fromName.toLowerCase().includes(q) ||
        em.fromEmail.toLowerCase().includes(q) ||
        em.company.toLowerCase().includes(q) ||
        em.body.toLowerCase().includes(q);

      return matchFolder && matchSearch;
    });
  }, [emails, activeFolder, searchQuery]);

  const activeEmail = useMemo(() => {
    return emails.find((e) => e.id === selectedEmailId) || filteredEmails[0] || null;
  }, [emails, selectedEmailId, filteredEmails]);

  // Handle Mark as Read
  const handleSelectEmail = (id) => {
    setSelectedEmailId(id);
    const updated = emails.map((em) => em.id === id ? { ...em, isRead: true } : em);
    saveEmails(updated);
  };

  // Handle Send Reply
  const handleSendReply = () => {
    if (!replyText.trim() || !activeEmail) return;
    setIsSendingReply(true);

    setTimeout(() => {
      const sentItem = {
        id: `mail-sent-${Date.now()}`,
        fromName: 'BUSINZ Tech Support',
        fromEmail: serverConfig.email || 'support@businz.com',
        company: activeEmail.company,
        subject: `Re: ${activeEmail.subject}`,
        body: replyText,
        date: 'Just now',
        timestamp: new Date().toISOString(),
        isRead: true,
        folder: 'sent',
        category: activeEmail.category,
        priority: activeEmail.priority,
        hasAttachment: false,
        attachments: []
      };

      saveEmails([sentItem, ...emails]);
      setReplyText('');
      setIsSendingReply(false);
      showToast(`Reply dispatched to ${activeEmail.fromEmail}`);
    }, 600);
  };

  // Handle Send Composed Email
  const handleSendComposed = (e) => {
    e.preventDefault();
    if (!composeForm.to || !composeForm.subject || !composeForm.body) {
      showToast('Please fill in To, Subject and Body', 'error');
      return;
    }

    const newMail = {
      id: `mail-${Date.now()}`,
      fromName: 'BUSINZ Tech Support',
      fromEmail: serverConfig.email || 'support@businz.com',
      company: composeForm.to.split('@')[0],
      subject: composeForm.subject,
      body: composeForm.body,
      date: 'Just now',
      timestamp: new Date().toISOString(),
      isRead: true,
      folder: 'sent',
      category: composeForm.category,
      priority: composeForm.priority,
      hasAttachment: Boolean(composeForm.attachment),
      attachments: composeForm.attachment ? [composeForm.attachment] : []
    };

    saveEmails([newMail, ...emails]);
    setShowComposeModal(false);
    setComposeForm({ to: '', subject: '', category: 'Technical Clarification', priority: 'Normal', body: '', attachment: '' });
    showToast(`Email dispatched to ${composeForm.to}`);
  };

  const handleArchive = (id) => {
    const updated = emails.map((e) => e.id === id ? { ...e, folder: 'archived' } : e);
    saveEmails(updated);
    showToast('Email moved to Archive');
  };

  const unreadCount = useMemo(() => {
    return emails.filter((e) => e.folder === 'inbox' && !e.isRead).length;
  }, [emails]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', width: '100%', boxSizing: 'border-box', fontFamily: "'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, sans-serif" }}>
      
      {/* 1. TOP HEADER BANNER */}
      <div style={{
        backgroundColor: '#FFFFFF',
        borderRadius: '16px',
        border: '1px solid #E2E8F0',
        padding: '12px 20px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '12px',
        boxShadow: '0 4px 16px -2px rgba(15, 23, 42, 0.04)',
        background: 'linear-gradient(135deg, #FFFFFF 0%, #F8FAFC 100%)',
        position: 'relative',
        overflow: 'hidden'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px', zIndex: 2, minWidth: 0 }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <h2 style={{ fontSize: '18px', fontWeight: '800', color: '#0F172A', margin: 0, letterSpacing: '-0.02em' }}>
                Tech Support Mail & Inquiries
              </h2>
              <span style={{
                fontSize: '11px',
                fontWeight: '800',
                backgroundColor: '#ECFEFF',
                color: '#0E7490',
                border: '1px solid #CFFAFE',
                padding: '2px 8px',
                borderRadius: '12px',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px'
              }}>
                <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#10B981' }} />
                IMAP/SMTP Active
              </span>
            </div>
            <p style={{ fontSize: '12px', color: '#64748B', margin: '4px 0 0 0', fontWeight: '500' }}>
              Client technical queries, structural specification requests & support email dispatch.
            </p>
          </div>
        </div>

        {/* Right side controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap', zIndex: 2 }}>
          <button
            onClick={() => setShowConfigModal(true)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              backgroundColor: '#FFFFFF',
              border: '1px solid #CBD5E1',
              color: '#334155',
              padding: '6px 12px',
              borderRadius: '9px',
              fontSize: '11.5px',
              fontWeight: '700',
              cursor: 'pointer',
              transition: 'all 0.15s ease'
            }}
          >
            <Settings size={13} style={{ color: '#0E7490' }} />
            <span>Mail Config</span>
          </button>

          <button
            onClick={() => setShowComposeModal(true)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              backgroundColor: '#0E7490',
              border: 'none',
              color: '#FFFFFF',
              padding: '6px 14px',
              borderRadius: '9px',
              fontSize: '12px',
              fontWeight: '700',
              cursor: 'pointer',
              boxShadow: '0 2px 8px rgba(14, 116, 144, 0.25)'
            }}
          >
            <Plus size={14} />
            <span>Compose Email</span>
          </button>
        </div>
      </div>

      {/* Toast Alert */}
      {toastMsg && (
        <div style={{
          padding: '10px 16px',
          borderRadius: '10px',
          backgroundColor: toastMsg.type === 'error' ? '#FEF2F2' : '#F0FDF4',
          border: `1px solid ${toastMsg.type === 'error' ? '#FECACA' : '#BBF7D0'}`,
          color: toastMsg.type === 'error' ? '#991B1B' : '#166534',
          fontSize: '12px',
          fontWeight: '600',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between'
        }}>
          <span>{toastMsg.text}</span>
          <button onClick={() => setToastMsg(null)} style={{ border: 'none', background: 'none', cursor: 'pointer', color: 'inherit' }}>
            <X size={14} />
          </button>
        </div>
      )}

      {/* 2. MAIN 3-PANE WORKSPACE */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: '220px 380px 1fr',
        gap: '14px',
        minHeight: '620px',
        alignItems: 'stretch'
      }}>
        
        {/* PANE 1: FOLDERS & ACCOUNT */}
        <div style={{
          backgroundColor: '#FFFFFF',
          borderRadius: '16px',
          border: '1px solid #EAEFEF',
          padding: '16px',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          gap: '14px',
          boxShadow: '0 4px 18px rgba(15, 23, 42, 0.03)'
        }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <span style={{ fontSize: '11px', fontWeight: '800', color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.04em', paddingLeft: '8px', marginBottom: '4px' }}>
              FOLDERS
            </span>

            {[
              { id: 'inbox', label: 'Inbox', icon: Inbox, badge: unreadCount > 0 ? String(unreadCount) : null },
              { id: 'technical', label: 'Technical Queries', icon: Tag, badge: null },
              { id: 'sent', label: 'Sent Mail', icon: Send, badge: null },
              { id: 'archived', label: 'Archived', icon: Archive, badge: null }
            ].map((f) => (
              <button
                key={f.id}
                onClick={() => setActiveFolder(f.id)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '9px 12px',
                  borderRadius: '10px',
                  border: 'none',
                  backgroundColor: activeFolder === f.id ? '#ECFEFF' : 'transparent',
                  color: activeFolder === f.id ? '#0E7490' : '#475569',
                  fontSize: '12.5px',
                  fontWeight: activeFolder === f.id ? '700' : '500',
                  cursor: 'pointer',
                  transition: 'all 0.1s ease'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <f.icon size={15} style={{ color: activeFolder === f.id ? '#0E7490' : '#64748B' }} />
                  <span>{f.label}</span>
                </div>
                {f.badge && (
                  <span style={{
                    fontSize: '10.5px',
                    fontWeight: '800',
                    backgroundColor: '#0E7490',
                    color: '#FFFFFF',
                    padding: '1px 6px',
                    borderRadius: '10px'
                  }}>
                    {f.badge}
                  </span>
                )}
              </button>
            ))}
          </div>

          {/* Account status info card */}
          <div style={{
            backgroundColor: '#F8FAFC',
            borderRadius: '12px',
            border: '1px solid #F1F5F9',
            padding: '12px',
            display: 'flex',
            flexDirection: 'column',
            gap: '6px'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', fontWeight: '700', color: '#0F172A' }}>
              <ShieldCheck size={14} style={{ color: '#059669' }} />
              <span>{serverConfig.provider}</span>
            </div>
            <div style={{ fontSize: '11px', color: '#64748B', wordBreak: 'break-all' }}>
              {serverConfig.email}
            </div>
            <div style={{ fontSize: '10px', color: '#059669', fontWeight: '700' }}>
              Connected via TLS
            </div>
          </div>
        </div>

        {/* PANE 2: EMAIL LIST */}
        <div style={{
          backgroundColor: '#FFFFFF',
          borderRadius: '16px',
          border: '1px solid #EAEFEF',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          boxShadow: '0 4px 18px rgba(15, 23, 42, 0.03)'
        }}>
          {/* Search Header */}
          <div style={{ padding: '12px 14px', borderBottom: '1px solid #F1F5F9' }}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              backgroundColor: '#F8FAFC',
              border: '1px solid #CBD5E1',
              borderRadius: '8px',
              padding: '0 10px',
              height: '34px'
            }}>
              <Search size={14} style={{ color: '#94A3B8' }} />
              <input
                type="text"
                placeholder="Search sender, subject, query..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{
                  border: 'none',
                  outline: 'none',
                  backgroundColor: 'transparent',
                  paddingLeft: '8px',
                  fontSize: '12px',
                  width: '100%',
                  color: '#0F172A'
                }}
              />
            </div>
          </div>

          {/* Email Items List */}
          <div style={{ flex: 1, overflowY: 'auto' }}>
            {filteredEmails.length === 0 ? (
              <div style={{ padding: '40px', textAlign: 'center', color: '#64748B', fontSize: '12px' }}>
                No emails found in this folder.
              </div>
            ) : (
              filteredEmails.map((em) => {
                const isSelected = em.id === (activeEmail?.id);

                return (
                  <div
                    key={em.id}
                    onClick={() => handleSelectEmail(em.id)}
                    style={{
                      padding: '12px 14px',
                      borderBottom: '1px solid #F1F5F9',
                      cursor: 'pointer',
                      backgroundColor: isSelected ? '#ECFEFF' : (!em.isRead ? '#FFFFFF' : '#FAFAFA'),
                      borderLeft: isSelected ? '4px solid #0E7490' : '4px solid transparent',
                      transition: 'background-color 0.1s ease',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '4px'
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: '12px', fontWeight: !em.isRead ? '800' : '600', color: '#0F172A' }}>
                        {em.fromName}
                      </span>
                      <span style={{ fontSize: '10px', color: '#94A3B8' }}>{em.date}</span>
                    </div>

                    <div style={{ fontSize: '11px', color: '#0E7490', fontWeight: '700' }}>
                      {em.company}
                    </div>

                    <div style={{ fontSize: '12px', fontWeight: !em.isRead ? '700' : '500', color: '#334155', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {em.subject}
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '2px' }}>
                      <span style={{
                        fontSize: '10px',
                        fontWeight: '700',
                        color: em.priority === 'Urgent' ? '#DC2626' : '#0369A1',
                        backgroundColor: em.priority === 'Urgent' ? '#FEF2F2' : '#E0F2FE',
                        padding: '1px 6px',
                        borderRadius: '4px'
                      }}>
                        {em.category}
                      </span>

                      {em.hasAttachment && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '3px', fontSize: '10px', color: '#64748B' }}>
                          <Paperclip size={11} />
                          <span>PDF</span>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* PANE 3: EMAIL DETAIL & REPLY */}
        <div style={{
          backgroundColor: '#FFFFFF',
          borderRadius: '16px',
          border: '1px solid #EAEFEF',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          boxShadow: '0 4px 18px rgba(15, 23, 42, 0.03)'
        }}>
          {activeEmail ? (
            <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
              {/* Header */}
              <div style={{ padding: '16px 20px', borderBottom: '1px solid #F1F5F9', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px' }}>
                <div>
                  <h3 style={{ margin: 0, fontSize: '15px', fontWeight: '800', color: '#0F172A', lineHeight: '1.3' }}>
                    {activeEmail.subject}
                  </h3>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '6px' }}>
                    <span style={{ fontSize: '12px', fontWeight: '700', color: '#0F172A' }}>{activeEmail.fromName}</span>
                    <span style={{ fontSize: '11px', color: '#64748B' }}>&lt;{activeEmail.fromEmail}&gt;</span>
                  </div>
                  <div style={{ fontSize: '11px', color: '#0E7490', fontWeight: '600', marginTop: '2px' }}>
                    {activeEmail.company}
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <button
                    onClick={() => handleArchive(activeEmail.id)}
                    title="Archive this email"
                    style={{
                      padding: '6px',
                      borderRadius: '8px',
                      border: '1px solid #E2E8F0',
                      backgroundColor: '#FFFFFF',
                      cursor: 'pointer',
                      color: '#64748B'
                    }}
                  >
                    <Archive size={14} />
                  </button>
                </div>
              </div>

              {/* Message Content */}
              <div style={{ flex: 1, padding: '20px', overflowY: 'auto', fontSize: '13px', color: '#334155', lineHeight: '1.6', whiteSpace: 'pre-line' }}>
                {activeEmail.body}

                {/* Attachments Section */}
                {activeEmail.attachments && activeEmail.attachments.length > 0 && (
                  <div style={{ marginTop: '20px', paddingTop: '16px', borderTop: '1px solid #F1F5F9' }}>
                    <span style={{ fontSize: '11px', fontWeight: '800', color: '#64748B', textTransform: 'uppercase' }}>
                      ATTACHMENTS ({activeEmail.attachments.length})
                    </span>
                    <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
                      {activeEmail.attachments.map((att, idx) => (
                        <div
                          key={idx}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px',
                            padding: '6px 12px',
                            borderRadius: '8px',
                            backgroundColor: '#F8FAFC',
                            border: '1px solid #E2E8F0',
                            fontSize: '12px',
                            color: '#0F172A'
                          }}
                        >
                          <Paperclip size={13} style={{ color: '#0E7490' }} />
                          <span>{att}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Quick Reply Form */}
              <div style={{ padding: '14px 20px', borderTop: '1px solid #F1F5F9', backgroundColor: '#F8FAFC' }}>
                <span style={{ fontSize: '11px', fontWeight: '800', color: '#475569', textTransform: 'uppercase', marginBottom: '6px', display: 'block' }}>
                  REPLY TO CLIENT INQUIRY
                </span>
                <textarea
                  rows={3}
                  placeholder={`Draft technical reply to ${activeEmail.fromEmail}...`}
                  value={replyText}
                  onChange={(e) => setReplyText(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    borderRadius: '8px',
                    border: '1px solid #CBD5E1',
                    fontSize: '12.5px',
                    color: '#0F172A',
                    outline: 'none',
                    boxSizing: 'border-box',
                    backgroundColor: '#FFFFFF',
                    resize: 'vertical'
                  }}
                />
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '8px' }}>
                  <button
                    onClick={() => {
                      setReplyText(`Dear ${activeEmail.fromName},\n\nThank you for reaching out to BUSINZ Tech Support. We have verified your request regarding ${activeEmail.subject}. Please find the required technical specification attached.\n\nBest regards,\nBUSINZ Engineering & Support`);
                    }}
                    style={{
                      border: 'none',
                      backgroundColor: 'transparent',
                      color: '#0E7490',
                      fontSize: '11.5px',
                      fontWeight: '700',
                      cursor: 'pointer'
                    }}
                  >
                    Insert Standard Technical Reply
                  </button>

                  <button
                    onClick={handleSendReply}
                    disabled={isSendingReply || !replyText.trim()}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '6px',
                      padding: '6px 14px',
                      backgroundColor: '#0E7490',
                      color: '#FFFFFF',
                      border: 'none',
                      borderRadius: '8px',
                      fontSize: '12px',
                      fontWeight: '700',
                      cursor: !replyText.trim() ? 'not-allowed' : 'pointer'
                    }}
                  >
                    <Send size={13} />
                    <span>{isSendingReply ? 'Sending...' : 'Send Reply'}</span>
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div style={{ padding: '40px', textAlign: 'center', color: '#64748B' }}>
              Select an email to view conversation.
            </div>
          )}
        </div>

      </div>

      {/* 3. COMPOSE EMAIL MODAL */}
      {showComposeModal && (
        <div style={{
          position: 'fixed',
          top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(15, 23, 42, 0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 99999,
          padding: '20px'
        }}>
          <div style={{
            backgroundColor: '#FFFFFF',
            borderRadius: '16px',
            width: '100%',
            maxWidth: '560px',
            boxShadow: '0 20px 40px rgba(0,0,0,0.2)',
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column'
          }}>
            <div style={{ padding: '16px 20px', borderBottom: '1px solid #E2E8F0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#F8FAFC' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Mail size={16} style={{ color: '#0E7490' }} />
                <span style={{ fontSize: '14px', fontWeight: '800', color: '#0F172A' }}>Compose Support Email</span>
              </div>
              <button onClick={() => setShowComposeModal(false)} style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: '#64748B' }}>
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleSendComposed} style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div>
                <label style={{ fontSize: '11px', fontWeight: '700', color: '#475569', textTransform: 'uppercase', marginBottom: '4px', display: 'block' }}>
                  RECIPIENT EMAIL (TO)
                </label>
                <input
                  type="email"
                  required
                  placeholder="client@company.com"
                  value={composeForm.to}
                  onChange={(e) => setComposeForm({ ...composeForm, to: e.target.value })}
                  style={{ width: '100%', padding: '8px 12px', borderRadius: '8px', border: '1px solid #CBD5E1', fontSize: '12.5px', boxSizing: 'border-box' }}
                />
              </div>

              <div>
                <label style={{ fontSize: '11px', fontWeight: '700', color: '#475569', textTransform: 'uppercase', marginBottom: '4px', display: 'block' }}>
                  SUBJECT
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Technical Clarification: Mini Rail Specification"
                  value={composeForm.subject}
                  onChange={(e) => setComposeForm({ ...composeForm, subject: e.target.value })}
                  style={{ width: '100%', padding: '8px 12px', borderRadius: '8px', border: '1px solid #CBD5E1', fontSize: '12.5px', boxSizing: 'border-box' }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <div>
                  <label style={{ fontSize: '11px', fontWeight: '700', color: '#475569', textTransform: 'uppercase', marginBottom: '4px', display: 'block' }}>
                    CATEGORY
                  </label>
                  <select
                    value={composeForm.category}
                    onChange={(e) => setComposeForm({ ...composeForm, category: e.target.value })}
                    style={{ width: '100%', padding: '8px 10px', borderRadius: '8px', border: '1px solid #CBD5E1', fontSize: '12px', backgroundColor: '#FFFFFF' }}
                  >
                    <option value="Technical Clarification">Technical Clarification</option>
                    <option value="Installation Manual">Installation Manual</option>
                    <option value="Material Test Certificate">Material Test Certificate</option>
                    <option value="Warranty Documentation">Warranty Documentation</option>
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: '11px', fontWeight: '700', color: '#475569', textTransform: 'uppercase', marginBottom: '4px', display: 'block' }}>
                    PRIORITY
                  </label>
                  <select
                    value={composeForm.priority}
                    onChange={(e) => setComposeForm({ ...composeForm, priority: e.target.value })}
                    style={{ width: '100%', padding: '8px 10px', borderRadius: '8px', border: '1px solid #CBD5E1', fontSize: '12px', backgroundColor: '#FFFFFF' }}
                  >
                    <option value="Normal">Normal</option>
                    <option value="High">High</option>
                    <option value="Urgent">Urgent</option>
                  </select>
                </div>
              </div>

              <div>
                <label style={{ fontSize: '11px', fontWeight: '700', color: '#475569', textTransform: 'uppercase', marginBottom: '4px', display: 'block' }}>
                  MESSAGE BODY
                </label>
                <textarea
                  required
                  rows={5}
                  placeholder="Type your technical response and guidelines here..."
                  value={composeForm.body}
                  onChange={(e) => setComposeForm({ ...composeForm, body: e.target.value })}
                  style={{ width: '100%', padding: '8px 12px', borderRadius: '8px', border: '1px solid #CBD5E1', fontSize: '12.5px', boxSizing: 'border-box' }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '8px' }}>
                <button
                  type="button"
                  onClick={() => setShowComposeModal(false)}
                  style={{ padding: '8px 14px', borderRadius: '8px', border: '1px solid #CBD5E1', backgroundColor: '#FFFFFF', fontSize: '12px', fontWeight: '600', cursor: 'pointer' }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  style={{ padding: '8px 18px', borderRadius: '8px', border: 'none', backgroundColor: '#0E7490', color: '#FFFFFF', fontSize: '12px', fontWeight: '700', cursor: 'pointer' }}
                >
                  Dispatch Email
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 4. MAIL CONFIG MODAL */}
      {showConfigModal && (
        <div style={{
          position: 'fixed',
          top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(15, 23, 42, 0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 99999,
          padding: '20px'
        }}>
          <div style={{
            backgroundColor: '#FFFFFF',
            borderRadius: '16px',
            width: '100%',
            maxWidth: '500px',
            boxShadow: '0 20px 40px rgba(0,0,0,0.2)',
            overflow: 'hidden'
          }}>
            <div style={{ padding: '16px 20px', borderBottom: '1px solid #E2E8F0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#F8FAFC' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Settings size={16} style={{ color: '#0E7490' }} />
                <span style={{ fontSize: '14px', fontWeight: '800', color: '#0F172A' }}>Mail Server Integration Settings</span>
              </div>
              <button onClick={() => setShowConfigModal(false)} style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: '#64748B' }}>
                <X size={16} />
              </button>
            </div>

            <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div>
                <label style={{ fontSize: '11px', fontWeight: '700', color: '#475569', textTransform: 'uppercase', marginBottom: '4px', display: 'block' }}>
                  EMAIL PROVIDER
                </label>
                <select
                  value={serverConfig.provider}
                  onChange={(e) => setServerConfig({ ...serverConfig, provider: e.target.value })}
                  style={{ width: '100%', padding: '8px 10px', borderRadius: '8px', border: '1px solid #CBD5E1', fontSize: '12px', backgroundColor: '#FFFFFF' }}
                >
                  <option value="Google Workspace">Google Workspace (Gmail)</option>
                  <option value="Microsoft 365">Microsoft 365 (Outlook)</option>
                  <option value="Custom IMAP/SMTP">Custom Corporate SMTP/IMAP</option>
                </select>
              </div>

              <div>
                <label style={{ fontSize: '11px', fontWeight: '700', color: '#475569', textTransform: 'uppercase', marginBottom: '4px', display: 'block' }}>
                  SUPPORT EMAIL ADDRESS
                </label>
                <input
                  type="email"
                  value={serverConfig.email}
                  onChange={(e) => setServerConfig({ ...serverConfig, email: e.target.value })}
                  style={{ width: '100%', padding: '8px 12px', borderRadius: '8px', border: '1px solid #CBD5E1', fontSize: '12.5px', boxSizing: 'border-box' }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <div>
                  <label style={{ fontSize: '11px', fontWeight: '700', color: '#475569', textTransform: 'uppercase', marginBottom: '4px', display: 'block' }}>
                    SMTP HOST & PORT
                  </label>
                  <input
                    type="text"
                    value={`${serverConfig.smtpHost}:${serverConfig.smtpPort}`}
                    readOnly
                    style={{ width: '100%', padding: '8px 10px', borderRadius: '8px', border: '1px solid #E2E8F0', backgroundColor: '#F8FAFC', fontSize: '12px' }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: '11px', fontWeight: '700', color: '#475569', textTransform: 'uppercase', marginBottom: '4px', display: 'block' }}>
                    IMAP HOST & PORT
                  </label>
                  <input
                    type="text"
                    value={`${serverConfig.imapHost}:${serverConfig.imapPort}`}
                    readOnly
                    style={{ width: '100%', padding: '8px 10px', borderRadius: '8px', border: '1px solid #E2E8F0', backgroundColor: '#F8FAFC', fontSize: '12px' }}
                  />
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '10px' }}>
                <button
                  type="button"
                  onClick={() => setShowConfigModal(false)}
                  style={{ padding: '8px 14px', borderRadius: '8px', border: '1px solid #CBD5E1', backgroundColor: '#FFFFFF', fontSize: '12px', fontWeight: '600', cursor: 'pointer' }}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => {
                    try {
                      localStorage.setItem('controlroom_mail_server_config', JSON.stringify(serverConfig));
                    } catch (_) {}
                    setShowConfigModal(false);
                    showToast('Mail configuration synchronized successfully!');
                  }}
                  style={{ padding: '8px 18px', borderRadius: '8px', border: 'none', backgroundColor: '#0E7490', color: '#FFFFFF', fontSize: '12px', fontWeight: '700', cursor: 'pointer' }}
                >
                  Save & Connect
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
