import React, { useState, useEffect, useMemo } from 'react';
import {
  Share2, MessageCircle, RefreshCw, Search, CheckCircle2,
  AlertCircle, ExternalLink, Settings, Send, Plus,
  Clock, User, Check, X, ShieldCheck, Smartphone, Mail,
  Sliders, ArrowRight, Eye, ChevronRight
} from 'lucide-react';

const INITIAL_FB_MESSAGES = [
  {
    id: 'fb-msg-1',
    customerName: 'Anil Deshmukh',
    pageName: 'BUSINZ Industrial & Solar Solutions',
    timestamp: 'Today, 10:15 AM',
    unread: false,
    messages: [
      { sender: 'client', text: 'Hello team, we are planning a 50kW solar rooftop setup. Do you supply mini rail and mid clamps directly from factory?', time: '10:12 AM' },
      { sender: 'agent', text: 'Hello Anil, yes! We manufacture extruded aluminium mini rails (40mm, 60mm, 75mm, 100mm) and universal mid/end clamps. Would you like a catalog or preset spec?', time: '10:14 AM' },
      { sender: 'client', text: 'Yes please share 75mm mini rail specs and pricing per meter.', time: '10:15 AM' }
    ],
    contactPhone: '+91 98765 43210',
    contactEmail: 'anil.deshmukh@solarenergy.in'
  },
  {
    id: 'fb-msg-2',
    customerName: 'Vikas Engineering Works',
    pageName: 'BUSINZ Industrial & Solar Solutions',
    timestamp: 'Yesterday, 03:40 PM',
    unread: true,
    messages: [
      { sender: 'client', text: 'Do you have pre-punched purlin channels with 2.00mm GI coil in stock?', time: '03:40 PM' }
    ],
    contactPhone: '+91 94432 11223',
    contactEmail: 'vikas.engg@gmail.com'
  },
  {
    id: 'fb-msg-3',
    customerName: 'SunPower Infrastructures',
    pageName: 'BUSINZ Industrial & Solar Solutions',
    timestamp: '08 Oct 2026',
    unread: false,
    messages: [
      { sender: 'client', text: 'We received your proposal for the DCR BOS kit. Need technical clarification on grounding clips.', time: '11:20 AM' },
      { sender: 'agent', text: 'Hi! Grounding clips are SS304 rated with dual piercing teeth. Compatible with anodized frames.', time: '11:25 AM' }
    ],
    contactPhone: '+91 91234 56789',
    contactEmail: 'projects@sunpowerinfra.com'
  }
];

const INITIAL_FB_LEAD_ADS = [
  {
    id: 'lead-fb-101',
    name: 'Gaurav Kulkarni',
    phone: '+91 98220 54321',
    email: 'gaurav.k@greenpowertech.com',
    campaign: 'Meta Lead Ad - Commercial Solar Rooftop 2026',
    productRequested: 'Mini Rail 75mm & Aluminium Profiles',
    date: 'Today, 08:45 AM',
    status: 'Inquiry Received'
  },
  {
    id: 'lead-fb-102',
    name: 'Senthil Nathan',
    phone: '+91 97890 12345',
    email: 'senthil@apexsolar.co.in',
    campaign: 'Facebook Page Contact Form',
    productRequested: 'BOS Solar Kits (500 kW Package)',
    date: 'Yesterday, 05:20 PM',
    status: 'Replied via Messenger'
  },
  {
    id: 'lead-fb-103',
    name: 'Mehta Solar EPC',
    phone: '+91 99099 88776',
    email: 'info@mehtasolarepc.com',
    campaign: 'Instagram / Meta Lead Ads',
    productRequested: 'Double C-Rail & Walkway Systems',
    date: '08 Oct 2026',
    status: 'Qualified'
  }
];

export default function FacebookMetaIntegrationView({ userRole = 'Tech Support', onNavigateTab }) {
  const [activeTab, setActiveTab] = useState('messenger'); // 'messenger' | 'leads' | 'settings'
  const [threads, setThreads] = useState(() => {
    try {
      const stored = localStorage.getItem('controlroom_fb_threads');
      return stored ? JSON.parse(stored) : INITIAL_FB_MESSAGES;
    } catch {
      return INITIAL_FB_MESSAGES;
    }
  });

  const [leadAds, setLeadAds] = useState(() => {
    try {
      const stored = localStorage.getItem('controlroom_fb_leads');
      return stored ? JSON.parse(stored) : INITIAL_FB_LEAD_ADS;
    } catch {
      return INITIAL_FB_LEAD_ADS;
    }
  });

  const [selectedThreadId, setSelectedThreadId] = useState('fb-msg-1');
  const [replyInput, setReplyInput] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [toastMsg, setToastMsg] = useState(null);

  // Meta Integration Config State
  const [metaConfig, setMetaConfig] = useState(() => {
    try {
      const stored = localStorage.getItem('controlroom_meta_config');
      return stored ? JSON.parse(stored) : {
        pageName: 'BUSINZ Industrial & Solar Solutions',
        pageId: '109847265192837',
        appId: '849201938472910',
        webhookStatus: 'Live (https://businz.com/api/webhooks/facebook)',
        autoLeadSync: true,
        isConnected: true
      };
    } catch {
      return {
        pageName: 'BUSINZ Industrial & Solar Solutions',
        pageId: '109847265192837',
        appId: '849201938472910',
        webhookStatus: 'Live (https://businz.com/api/webhooks/facebook)',
        autoLeadSync: true,
        isConnected: true
      };
    }
  });

  const showToast = (text, type = 'success') => {
    setToastMsg({ text, type });
    setTimeout(() => setToastMsg(null), 4000);
  };

  const activeThread = useMemo(() => {
    return threads.find((t) => t.id === selectedThreadId) || threads[0] || null;
  }, [threads, selectedThreadId]);

  const handleSendReply = () => {
    if (!replyInput.trim() || !activeThread) return;

    const newMsg = {
      sender: 'agent',
      text: replyInput.trim(),
      time: new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })
    };

    const updated = threads.map((t) => {
      if (t.id === activeThread.id) {
        return {
          ...t,
          messages: [...t.messages, newMsg],
          timestamp: 'Just now'
        };
      }
      return t;
    });

    setThreads(updated);
    try {
      localStorage.setItem('controlroom_fb_threads', JSON.stringify(updated));
    } catch (_) {}
    setReplyInput('');
    showToast(`Reply sent to ${activeThread.customerName} via Facebook Messenger`);
  };

  const handleRefresh = () => {
    setIsRefreshing(true);
    setTimeout(() => {
      setIsRefreshing(false);
      showToast('Facebook messages & Meta lead inquiries synchronized!');
    }, 500);
  };

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
                Facebook & Meta Business Suite
              </h2>
              <span style={{
                fontSize: '11px',
                fontWeight: '800',
                backgroundColor: '#EFF6FF',
                color: '#1D4ED8',
                border: '1px solid #BFDBFE',
                padding: '2px 8px',
                borderRadius: '12px',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px'
              }}>
                <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#2563EB' }} />
                Page & Webhook Live
              </span>
            </div>
            <p style={{ fontSize: '12px', color: '#64748B', margin: '4px 0 0 0', fontWeight: '500' }}>
              Connected to <strong>{metaConfig.pageName}</strong>. Incoming Messenger inquiries and Lead Ads.
            </p>
          </div>
        </div>

        {/* Right side controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap', zIndex: 2 }}>
          <button
            onClick={handleRefresh}
            disabled={isRefreshing}
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
            <RefreshCw size={13} className={isRefreshing ? 'animate-spin' : ''} style={{ color: '#1D4ED8' }} />
            <span>Sync Meta</span>
          </button>

          <button
            onClick={() => setActiveTab('settings')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              backgroundColor: '#1877F2',
              border: 'none',
              color: '#FFFFFF',
              padding: '6px 14px',
              borderRadius: '9px',
              fontSize: '12px',
              fontWeight: '700',
              cursor: 'pointer',
              boxShadow: '0 2px 8px rgba(24, 119, 242, 0.25)'
            }}
          >
            <Settings size={14} />
            <span>Meta Settings</span>
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

      {/* 2. SUB-NAVIGATION TABS */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        backgroundColor: '#FFFFFF',
        padding: '6px 14px',
        borderRadius: '12px',
        border: '1px solid #E2E8F0',
        width: 'fit-content'
      }}>
        <button
          onClick={() => setActiveTab('messenger')}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            padding: '6px 12px',
            borderRadius: '8px',
            border: 'none',
            backgroundColor: activeTab === 'messenger' ? '#EFF6FF' : 'transparent',
            color: activeTab === 'messenger' ? '#1D4ED8' : '#64748B',
            fontWeight: activeTab === 'messenger' ? '700' : '500',
            fontSize: '12px',
            cursor: 'pointer'
          }}
        >
          <MessageCircle size={14} />
          <span>Facebook Messenger ({threads.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('leads')}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            padding: '6px 12px',
            borderRadius: '8px',
            border: 'none',
            backgroundColor: activeTab === 'leads' ? '#EFF6FF' : 'transparent',
            color: activeTab === 'leads' ? '#1D4ED8' : '#64748B',
            fontWeight: activeTab === 'leads' ? '700' : '500',
            fontSize: '12px',
            cursor: 'pointer'
          }}
        >
          <Share2 size={14} />
          <span>Lead Ads Inquiries ({leadAds.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('settings')}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            padding: '6px 12px',
            borderRadius: '8px',
            border: 'none',
            backgroundColor: activeTab === 'settings' ? '#EFF6FF' : 'transparent',
            color: activeTab === 'settings' ? '#1D4ED8' : '#64748B',
            fontWeight: activeTab === 'settings' ? '700' : '500',
            fontSize: '12px',
            cursor: 'pointer'
          }}
        >
          <Settings size={14} />
          <span>Page & Webhook Config</span>
        </button>
      </div>

      {/* 3. TAB CONTENT 1: MESSENGER LIVE CHATS */}
      {activeTab === 'messenger' && (
        <div style={{
          display: 'grid',
          gridTemplateColumns: '320px 1fr',
          gap: '14px',
          minHeight: '580px',
          alignItems: 'stretch'
        }}>
          {/* Threads List */}
          <div style={{
            backgroundColor: '#FFFFFF',
            borderRadius: '16px',
            border: '1px solid #EAEFEF',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            boxShadow: '0 4px 18px rgba(15, 23, 42, 0.03)'
          }}>
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
                  placeholder="Search customer, inquiry..."
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

            <div style={{ flex: 1, overflowY: 'auto' }}>
              {threads.map((t) => {
                const isSelected = t.id === activeThread?.id;
                const lastMsg = t.messages[t.messages.length - 1];

                return (
                  <div
                    key={t.id}
                    onClick={() => setSelectedThreadId(t.id)}
                    style={{
                      padding: '12px 14px',
                      borderBottom: '1px solid #F1F5F9',
                      cursor: 'pointer',
                      backgroundColor: isSelected ? '#EFF6FF' : '#FFFFFF',
                      borderLeft: isSelected ? '4px solid #1877F2' : '4px solid transparent',
                      transition: 'background-color 0.1s ease',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '4px'
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: '12.5px', fontWeight: '800', color: '#0F172A' }}>
                        {t.customerName}
                      </span>
                      <span style={{ fontSize: '10px', color: '#94A3B8' }}>{t.timestamp}</span>
                    </div>

                    <div style={{ fontSize: '11px', color: '#64748B', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {lastMsg ? lastMsg.text : 'Customer inquiry'}
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '2px', fontSize: '10px', color: '#1D4ED8', fontWeight: '600' }}>
                      <MessageCircle size={11} />
                      <span>Facebook Messenger</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Conversation Detail & Chat */}
          <div style={{
            backgroundColor: '#FFFFFF',
            borderRadius: '16px',
            border: '1px solid #EAEFEF',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            boxShadow: '0 4px 18px rgba(15, 23, 42, 0.03)'
          }}>
            {activeThread ? (
              <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
                {/* Header */}
                <div style={{ padding: '14px 20px', borderBottom: '1px solid #F1F5F9', display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#F8FAFC' }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ fontSize: '14px', fontWeight: '800', color: '#0F172A' }}>{activeThread.customerName}</span>
                      <span style={{ fontSize: '10.5px', fontWeight: '700', color: '#1D4ED8', backgroundColor: '#EFF6FF', padding: '1px 6px', borderRadius: '4px' }}>
                        Facebook Lead
                      </span>
                    </div>
                    <div style={{ fontSize: '11.5px', color: '#64748B', marginTop: '2px' }}>
                      {activeThread.contactPhone} &bull; {activeThread.contactEmail}
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <button
                      onClick={() => onNavigateTab && onNavigateTab('WhatsApp Inbox')}
                      title="Open in WhatsApp Inbox"
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px',
                        padding: '5px 10px',
                        borderRadius: '6px',
                        border: '1px solid #CBD5E1',
                        backgroundColor: '#FFFFFF',
                        fontSize: '11px',
                        fontWeight: '700',
                        color: '#059669',
                        cursor: 'pointer'
                      }}
                    >
                      <Smartphone size={12} />
                      <span>WhatsApp</span>
                    </button>
                    <button
                      onClick={() => onNavigateTab && onNavigateTab('Mail Inbox')}
                      title="Send Support Email"
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px',
                        padding: '5px 10px',
                        borderRadius: '6px',
                        border: '1px solid #CBD5E1',
                        backgroundColor: '#FFFFFF',
                        fontSize: '11px',
                        fontWeight: '700',
                        color: '#0E7490',
                        cursor: 'pointer'
                      }}
                    >
                      <Mail size={12} />
                      <span>Email</span>
                    </button>
                  </div>
                </div>

                {/* Messages Body */}
                <div style={{ flex: 1, padding: '20px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {activeThread.messages.map((m, idx) => {
                    const isAgent = m.sender === 'agent';

                    return (
                      <div
                        key={idx}
                        style={{
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: isAgent ? 'flex-end' : 'flex-start'
                        }}
                      >
                        <div
                          style={{
                            maxWidth: '75%',
                            padding: '10px 14px',
                            borderRadius: isAgent ? '14px 14px 2px 14px' : '14px 14px 14px 2px',
                            backgroundColor: isAgent ? '#1877F2' : '#F1F5F9',
                            color: isAgent ? '#FFFFFF' : '#0F172A',
                            fontSize: '12.5px',
                            lineHeight: '1.4'
                          }}
                        >
                          {m.text}
                        </div>
                        <span style={{ fontSize: '10px', color: '#94A3B8', marginTop: '3px', paddingLeft: '4px', paddingRight: '4px' }}>
                          {m.time}
                        </span>
                      </div>
                    );
                  })}
                </div>

                {/* Reply Input Bar */}
                <div style={{ padding: '14px 20px', borderTop: '1px solid #F1F5F9', backgroundColor: '#F8FAFC', display: 'flex', gap: '10px' }}>
                  <input
                    type="text"
                    placeholder={`Reply to ${activeThread.customerName} on Messenger...`}
                    value={replyInput}
                    onChange={(e) => setReplyInput(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') handleSendReply(); }}
                    style={{
                      flex: 1,
                      padding: '8px 12px',
                      borderRadius: '8px',
                      border: '1px solid #CBD5E1',
                      fontSize: '12.5px',
                      outline: 'none',
                      backgroundColor: '#FFFFFF'
                    }}
                  />
                  <button
                    onClick={handleSendReply}
                    disabled={!replyInput.trim()}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      padding: '8px 16px',
                      backgroundColor: '#1877F2',
                      color: '#FFFFFF',
                      border: 'none',
                      borderRadius: '8px',
                      fontSize: '12px',
                      fontWeight: '700',
                      cursor: !replyInput.trim() ? 'not-allowed' : 'pointer'
                    }}
                  >
                    <Send size={13} />
                    <span>Send</span>
                  </button>
                </div>
              </div>
            ) : (
              <div style={{ padding: '40px', textAlign: 'center', color: '#64748B' }}>
                Select a conversation to reply.
              </div>
            )}
          </div>
        </div>
      )}

      {/* 4. TAB CONTENT 2: LEAD ADS TABLE */}
      {activeTab === 'leads' && (
        <div style={{
          backgroundColor: '#FFFFFF',
          borderRadius: '16px',
          border: '1px solid #EAEFEF',
          padding: '18px 20px',
          boxShadow: '0 4px 18px rgba(15, 23, 42, 0.03)',
          display: 'flex',
          flexDirection: 'column',
          gap: '14px'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <h3 style={{ margin: 0, fontSize: '15px', fontWeight: '800', color: '#0F172A' }}>
                Meta Lead Ads & Form Inquiries
              </h3>
              <p style={{ margin: '3px 0 0', fontSize: '12px', color: '#64748B' }}>
                Automated technical leads captured through Facebook campaigns and instant forms
              </p>
            </div>
            <button
              onClick={handleRefresh}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '6px 12px',
                borderRadius: '8px',
                border: '1px solid #CBD5E1',
                backgroundColor: '#FFFFFF',
                fontSize: '11.5px',
                fontWeight: '700',
                cursor: 'pointer'
              }}
            >
              <RefreshCw size={13} style={{ color: '#1D4ED8' }} />
              <span>Fetch New Leads</span>
            </button>
          </div>

          <div style={{ border: '1px solid #E2E8F0', borderRadius: '12px', overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '12.5px' }}>
              <thead>
                <tr style={{ backgroundColor: '#F8FAFC', borderBottom: '1px solid #E2E8F0', color: '#475569', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: '700' }}>
                  <th style={{ padding: '10px 14px' }}>CLIENT NAME</th>
                  <th style={{ padding: '10px 14px' }}>CONTACT DETAILS</th>
                  <th style={{ padding: '10px 14px' }}>CAMPAIGN / SOURCE</th>
                  <th style={{ padding: '10px 14px' }}>PRODUCT SPECIFICATION</th>
                  <th style={{ padding: '10px 14px' }}>STATUS</th>
                  <th style={{ padding: '10px 14px', textAlign: 'right' }}>ACTIONS</th>
                </tr>
              </thead>
              <tbody>
                {leadAds.map((lead, idx) => (
                  <tr key={lead.id} style={{ borderBottom: '1px solid #F1F5F9', backgroundColor: idx % 2 === 0 ? '#FFFFFF' : '#FAFAFA' }}>
                    <td style={{ padding: '10px 14px' }}>
                      <div style={{ fontWeight: '700', color: '#0F172A' }}>{lead.name}</div>
                      <div style={{ fontSize: '10.5px', color: '#64748B' }}>{lead.date}</div>
                    </td>
                    <td style={{ padding: '10px 14px' }}>
                      <div style={{ fontWeight: '600', color: '#0F172A' }}>{lead.phone}</div>
                      <div style={{ fontSize: '11px', color: '#64748B' }}>{lead.email}</div>
                    </td>
                    <td style={{ padding: '10px 14px' }}>
                      <span style={{ fontSize: '11.5px', color: '#1D4ED8', fontWeight: '600' }}>{lead.campaign}</span>
                    </td>
                    <td style={{ padding: '10px 14px' }}>
                      <span style={{ fontWeight: '600', color: '#334155' }}>{lead.productRequested}</span>
                    </td>
                    <td style={{ padding: '10px 14px' }}>
                      <span style={{
                        padding: '2px 8px',
                        borderRadius: '6px',
                        fontSize: '11px',
                        fontWeight: '700',
                        backgroundColor: '#EFF6FF',
                        color: '#1D4ED8'
                      }}>
                        {lead.status}
                      </span>
                    </td>
                    <td style={{ padding: '10px 14px', textAlign: 'right' }}>
                      <div style={{ display: 'inline-flex', gap: '6px' }}>
                        <button
                          onClick={() => {
                            setActiveTab('messenger');
                            showToast(`Opened chat for ${lead.name}`);
                          }}
                          style={{
                            padding: '4px 8px',
                            borderRadius: '6px',
                            border: '1px solid #1877F2',
                            backgroundColor: '#FFFFFF',
                            color: '#1877F2',
                            fontSize: '11px',
                            fontWeight: '700',
                            cursor: 'pointer'
                          }}
                        >
                          Messenger
                        </button>
                        <button
                          onClick={() => onNavigateTab && onNavigateTab('WhatsApp Inbox')}
                          style={{
                            padding: '4px 8px',
                            borderRadius: '6px',
                            border: '1px solid #059669',
                            backgroundColor: '#059669',
                            color: '#FFFFFF',
                            fontSize: '11px',
                            fontWeight: '700',
                            cursor: 'pointer'
                          }}
                        >
                          WhatsApp
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 5. TAB CONTENT 3: SETTINGS & WEBHOOK */}
      {activeTab === 'settings' && (
        <div style={{
          backgroundColor: '#FFFFFF',
          borderRadius: '16px',
          border: '1px solid #EAEFEF',
          padding: '20px',
          boxShadow: '0 4px 18px rgba(15, 23, 42, 0.03)',
          display: 'flex',
          flexDirection: 'column',
          gap: '16px',
          maxWidth: '700px'
        }}>
          <div>
            <h3 style={{ margin: 0, fontSize: '16px', fontWeight: '800', color: '#0F172A' }}>
              Meta Business Suite & Webhook Configuration
            </h3>
            <p style={{ margin: '4px 0 0', fontSize: '12px', color: '#64748B' }}>
              Configure Facebook Page integration, Graph API access token, and real-time webhook listeners.
            </p>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div>
              <label style={{ fontSize: '11px', fontWeight: '700', color: '#475569', textTransform: 'uppercase', marginBottom: '4px', display: 'block' }}>
                FACEBOOK PAGE NAME
              </label>
              <input
                type="text"
                value={metaConfig.pageName}
                onChange={(e) => setMetaConfig({ ...metaConfig, pageName: e.target.value })}
                style={{ width: '100%', padding: '8px 12px', borderRadius: '8px', border: '1px solid #CBD5E1', fontSize: '12.5px', boxSizing: 'border-box' }}
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div>
                <label style={{ fontSize: '11px', fontWeight: '700', color: '#475569', textTransform: 'uppercase', marginBottom: '4px', display: 'block' }}>
                  PAGE ID
                </label>
                <input
                  type="text"
                  value={metaConfig.pageId}
                  onChange={(e) => setMetaConfig({ ...metaConfig, pageId: e.target.value })}
                  style={{ width: '100%', padding: '8px 12px', borderRadius: '8px', border: '1px solid #CBD5E1', fontSize: '12.5px', boxSizing: 'border-box' }}
                />
              </div>

              <div>
                <label style={{ fontSize: '11px', fontWeight: '700', color: '#475569', textTransform: 'uppercase', marginBottom: '4px', display: 'block' }}>
                  META APP ID
                </label>
                <input
                  type="text"
                  value={metaConfig.appId}
                  onChange={(e) => setMetaConfig({ ...metaConfig, appId: e.target.value })}
                  style={{ width: '100%', padding: '8px 12px', borderRadius: '8px', border: '1px solid #CBD5E1', fontSize: '12.5px', boxSizing: 'border-box' }}
                />
              </div>
            </div>

            <div>
              <label style={{ fontSize: '11px', fontWeight: '700', color: '#475569', textTransform: 'uppercase', marginBottom: '4px', display: 'block' }}>
                WEBHOOK CALLBACK URL
              </label>
              <input
                type="text"
                readOnly
                value="https://businz.com/api/webhooks/facebook"
                style={{ width: '100%', padding: '8px 12px', borderRadius: '8px', border: '1px solid #E2E8F0', backgroundColor: '#F8FAFC', fontSize: '12.5px', boxSizing: 'border-box', color: '#64748B' }}
              />
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginTop: '6px' }}>
              <input
                type="checkbox"
                id="autoLead"
                checked={metaConfig.autoLeadSync}
                onChange={(e) => setMetaConfig({ ...metaConfig, autoLeadSync: e.target.checked })}
                style={{ accentColor: '#1877F2', cursor: 'pointer' }}
              />
              <label htmlFor="autoLead" style={{ fontSize: '12px', color: '#334155', fontWeight: '600', cursor: 'pointer' }}>
                Automatically sync Facebook Lead Ads directly into CRM Lead pipeline
              </label>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '12px' }}>
              <button
                type="button"
                onClick={() => {
                  try {
                    localStorage.setItem('controlroom_meta_config', JSON.stringify(metaConfig));
                  } catch (_) {}
                  showToast('Meta Business Suite settings saved successfully!');
                }}
                style={{
                  padding: '8px 18px',
                  borderRadius: '8px',
                  border: 'none',
                  backgroundColor: '#1877F2',
                  color: '#FFFFFF',
                  fontSize: '12px',
                  fontWeight: '700',
                  cursor: 'pointer'
                }}
              >
                Save Meta Configuration
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
