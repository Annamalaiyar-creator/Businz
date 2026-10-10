import React, { useState, useRef, useEffect } from 'react';
import {
  MessageSquare, Send, Bot, Sparkles, User, Paperclip, Check, CheckCheck,
  Search, Phone, Building2, Calendar, FileText, ArrowRight, RefreshCw, X,
  Clock, ShieldAlert, Tag, Layers, ChevronRight, Zap, QrCode, Smartphone, Plus
} from 'lucide-react';
import { analyzeSolarEnquiry } from '../../services/crmStore';
import WhatsAppQrModal from './WhatsAppQrModal';
import { 
  getCleanCurrentUserId, 
  getCurrentSalesRepName, 
  getWhatsAppStatus, 
  sendDirectWhatsApp,
  getWhatsAppChats,
  startWhatsAppChat
} from '../../utils/whatsappDispatchService';

export default function CrmWhatsAppInbox({
  conversations = [],
  templates = [],
  onSendMessage,
  onAutoCreateLead,
  onNavigateTab
}) {
  const [chatList, setChatList] = useState(conversations);
  const [activeConvId, setActiveConvId] = useState(conversations[0]?.id || null);
  const [searchFilter, setSearchFilter] = useState('');
  const [messageInput, setMessageInput] = useState('');
  const [selectedTemplate, setSelectedTemplate] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [aiAnalysis, setAiAnalysis] = useState(null);
  const [isQrModalOpen, setIsQrModalOpen] = useState(false);
  const [waSession, setWaSession] = useState(null);
  const [isSyncingChats, setIsSyncingChats] = useState(false);
  const [showNewChatModal, setShowNewChatModal] = useState(false);
  const [newChatPhone, setNewChatPhone] = useState('');
  const [newChatName, setNewChatName] = useState('');

  const messagesEndRef = useRef(null);
  const currentUserId = getCleanCurrentUserId();
  const salesRepName = getCurrentSalesRepName();

  // Sync real WhatsApp chats from connected phone
  const syncChatsFromWhatsApp = async () => {
    setIsSyncingChats(true);
    try {
      const data = await getWhatsAppChats(currentUserId);
      if (data?.chats && data.chats.length > 0) {
        setChatList(data.chats);
        if (!activeConvId || !data.chats.some(c => c.id === activeConvId)) {
          setActiveConvId(data.chats[0].id);
        }
      }
    } catch (e) {
      console.error('Error fetching real WhatsApp chats:', e);
    } finally {
      setIsSyncingChats(false);
    }
  };

  // Check initial WhatsApp session status
  const checkStatus = async () => {
    try {
      const data = await getWhatsAppStatus(currentUserId);
      setWaSession(data);
    } catch (_) {}
  };

  useEffect(() => {
    checkStatus();
    const interval = setInterval(checkStatus, 5000);
    return () => clearInterval(interval);
  }, []);

  // When WhatsApp connects or user changes, sync real chats
  useEffect(() => {
    if (waSession?.status === 'CONNECTED') {
      syncChatsFromWhatsApp();
    }
  }, [waSession?.status]);

  const activeConv = chatList.find(c => c.id === activeConvId) || chatList[0];

  // Scroll to bottom of chat
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [activeConv?.messages]);

  // Run AI analysis on the customer's latest incoming messages
  useEffect(() => {
    if (activeConv && activeConv.messages) {
      const incoming = activeConv.messages.filter(m => m.sender === 'customer');
      const latestIncoming = incoming[incoming.length - 1];
      if (latestIncoming) {
        const analysis = analyzeSolarEnquiry(latestIncoming.text);
        setAiAnalysis(analysis);
      } else {
        setAiAnalysis(null);
      }
    }
  }, [activeConv]);

  const handleStartNewChat = async (e) => {
    e.preventDefault();
    const cleanPhone = newChatPhone.replace(/[^0-9]/g, '');
    if (!cleanPhone) return;

    try {
      const res = await startWhatsAppChat({
        userId: currentUserId,
        phone: cleanPhone,
        name: newChatName.trim() || `Customer +${cleanPhone}`,
        company: 'Client Contact'
      });
      if (res?.chat) {
        setChatList(prev => [res.chat, ...prev.filter(c => c.id !== res.chat.id)]);
        setActiveConvId(res.chat.id);
        setShowNewChatModal(false);
        setNewChatPhone('');
        setNewChatName('');
      }
    } catch (err) {
      alert('Could not start chat: ' + err.message);
    }
  };

  const handleSend = async (e) => {
    e.preventDefault();
    if (!messageInput.trim() || !activeConv) return;

    setIsSending(true);
    const newMsg = {
      id: `MSG-${Date.now()}`,
      sender: 'agent',
      senderName: salesRepName,
      text: messageInput.trim(),
      timestamp: new Date().toISOString(),
      status: 'sent'
    };

    // Update local chatList immediately
    setChatList(prev => prev.map(c => {
      if (c.id === activeConv.id) {
        return {
          ...c,
          timestamp: new Date().toISOString(),
          messages: [...(c.messages || []), newMsg]
        };
      }
      return c;
    }));

    try {
      if (waSession?.status === 'CONNECTED') {
        // Send via Sales Rep's individual connected WhatsApp
        await sendDirectWhatsApp({
          userId: currentUserId,
          to: activeConv.phone,
          text: messageInput.trim()
        });
      } else {
        // Fallback to central API
        await fetch('/api/crm/whatsapp/send-message', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            to: activeConv.phone,
            text: messageInput.trim()
          })
        });
      }
    } catch (err) {
      console.warn('Backend send notice:', err);
    }

    if (onSendMessage) onSendMessage(activeConv.id, newMsg);
    setMessageInput('');
    setIsSending(false);
  };

  const handleApplyTemplate = (tmplText) => {
    if (!tmplText) return;
    let formatted = tmplText
      .replace('{{customer_name}}', activeConv?.customerName?.split(' ')[0] || 'Sir')
      .replace('{{sales_person}}', localStorage.getItem('controlroom_logged_user_name') || 'Sales Representative');
    setMessageInput(formatted);
  };

  const handleApplyAiSuggestion = () => {
    if (aiAnalysis?.suggestedReply) {
      setMessageInput(aiAnalysis.suggestedReply);
    }
  };

  const filteredConversations = chatList.filter(c => {
    const q = searchFilter.toLowerCase();
    return !searchFilter ||
      c.customerName?.toLowerCase().includes(q) ||
      c.companyName?.toLowerCase().includes(q) ||
      c.phone?.includes(q);
  });

  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: '320px 1fr 300px',
      gap: '16px',
      height: 'calc(100vh - 170px)',
      width: '100%',
      minHeight: '600px'
    }}>
      {/* 1. LEFT PANEL: Chat Conversations List */}
      <div style={{
        backgroundColor: '#FFFFFF',
        borderRadius: '12px',
        border: '1px solid #E2E8F0',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden'
      }}>
        <div style={{ padding: '14px 16px', borderBottom: '1px solid #E2E8F0', backgroundColor: '#F8FAFC' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <MessageSquare size={18} color="#16A34A" />
              <span style={{ fontWeight: '800', fontSize: '14px', color: '#0F172A' }}>WhatsApp Chats</span>
            </div>
            <button
              onClick={() => setIsQrModalOpen(true)}
              title="Click to connect or view your WhatsApp device"
              style={{
                fontSize: '11px',
                fontWeight: '800',
                padding: '4px 10px',
                borderRadius: '20px',
                backgroundColor: waSession?.status === 'CONNECTED' ? '#DCFCE7' : '#EFF6FF',
                color: waSession?.status === 'CONNECTED' ? '#15803D' : '#1D4ED8',
                border: waSession?.status === 'CONNECTED' ? '1px solid #86EFAC' : '1px solid #BFDBFE',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '5px',
                transition: 'all 0.15s ease'
              }}
            >
              <Smartphone size={12} />
              {waSession?.status === 'CONNECTED' ? `Linked (+${waSession.phoneNumber?.slice(-10) || 'Active'})` : 'Link WhatsApp'}
            </button>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', backgroundColor: '#FFFFFF', padding: '6px 10px', borderRadius: '6px', border: '1px solid #CBD5E1' }}>
            <Search size={14} color="#64748B" />
            <input
              type="text"
              placeholder="Search chats..."
              value={searchFilter}
              onChange={(e) => setSearchFilter(e.target.value)}
              style={{ border: 'none', outline: 'none', fontSize: '12px', width: '100%' }}
            />
          </div>

          <div style={{ display: 'flex', gap: '6px', marginTop: '8px' }}>
            <button
              onClick={() => setShowNewChatModal(true)}
              style={{
                flex: 1,
                padding: '6px 10px',
                borderRadius: '6px',
                border: '1px solid #CBD5E1',
                backgroundColor: '#FFFFFF',
                color: '#0F172A',
                fontSize: '11px',
                fontWeight: '700',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '4px'
              }}
            >
              <Plus size={13} color="#16A34A" /> New Chat
            </button>

            <button
              onClick={syncChatsFromWhatsApp}
              disabled={isSyncingChats}
              title="Sync contacts and conversations from your linked WhatsApp"
              style={{
                padding: '6px 10px',
                borderRadius: '6px',
                border: '1px solid #CBD5E1',
                backgroundColor: '#FFFFFF',
                color: '#475569',
                fontSize: '11px',
                fontWeight: '700',
                cursor: isSyncingChats ? 'wait' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '4px'
              }}
            >
              <RefreshCw size={12} className={isSyncingChats ? 'spin' : ''} />
              {isSyncingChats ? 'Syncing...' : 'Sync'}
            </button>
          </div>
        </div>

        <div style={{ flex: 1, overflowY: 'auto' }}>
          {filteredConversations.map(conv => {
            const isCurrent = conv.id === activeConv?.id;
            const lastMsg = conv.messages?.[conv.messages.length - 1];
            return (
              <div
                key={conv.id}
                onClick={() => setActiveConvId(conv.id)}
                style={{
                  padding: '12px 14px',
                  borderBottom: '1px solid #F1F5F9',
                  backgroundColor: isCurrent ? '#F0FDF4' : '#FFFFFF',
                  cursor: 'pointer',
                  borderLeft: isCurrent ? '4px solid #16A34A' : '4px solid transparent',
                  transition: 'background-color 0.15s'
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '4px' }}>
                  <div style={{ fontWeight: '700', fontSize: '13px', color: '#0F172A' }}>
                    {conv.customerName}
                  </div>
                  <span style={{ fontSize: '10px', color: '#94A3B8' }}>
                    {lastMsg ? new Date(lastMsg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                  </span>
                </div>
                <div style={{ fontSize: '11px', color: '#0E7490', fontWeight: '600' }}>
                  {conv.companyName}
                </div>
                <div style={{
                  fontSize: '12px',
                  color: '#64748B',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  marginTop: '4px'
                }}>
                  {lastMsg?.sender === 'agent' ? 'You: ' : ''}{lastMsg?.text || 'No messages yet'}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 2. CENTER PANEL: Interactive Chat Workspace */}
      <div style={{
        backgroundColor: '#FFFFFF',
        borderRadius: '12px',
        border: '1px solid #E2E8F0',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden'
      }}>
        {/* Chat Header */}
        <div style={{
          padding: '12px 20px',
          borderBottom: '1px solid #E2E8F0',
          backgroundColor: '#F8FAFC',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{ width: '38px', height: '38px', borderRadius: '50%', backgroundColor: '#16A34A', color: '#FFFFFF', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: '800', fontSize: '15px' }}>
              {activeConv?.customerName?.charAt(0) || 'C'}
            </div>
            <div>
              <div style={{ fontWeight: '800', fontSize: '14px', color: '#0F172A' }}>
                {activeConv?.customerName} • {activeConv?.phone}
              </div>
              <div style={{ fontSize: '11px', color: '#64748B' }}>
                {activeConv?.companyName} • Channel: Meta WhatsApp Business
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              onClick={() => onAutoCreateLead && onAutoCreateLead(activeConv)}
              style={{
                padding: '6px 12px',
                borderRadius: '6px',
                border: '1px solid #0E7490',
                backgroundColor: '#F0FDFA',
                color: '#0E7490',
                fontSize: '12px',
                fontWeight: '700',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '4px'
              }}
            >
              <Zap size={14} /> Auto-Create Lead
            </button>
          </div>
        </div>

        {/* AI Requirement Extraction Assistant Bar */}
        {aiAnalysis && (
          <div style={{
            backgroundColor: '#F0FDF4',
            borderBottom: '1px solid #BBF7D0',
            padding: '10px 16px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Sparkles size={16} color="#16A34A" />
              <div style={{ fontSize: '12px', color: '#166534' }}>
                <strong>AI Solar Detected:</strong> {aiAnalysis.requirement || 'Solar Inbound Inquiry'}
                <span style={{ marginLeft: '6px', fontSize: '11px', opacity: 0.8 }}>({aiAnalysis.category})</span>
              </div>
            </div>
            <button
              onClick={handleApplyAiSuggestion}
              style={{
                padding: '4px 10px',
                borderRadius: '6px',
                border: 'none',
                backgroundColor: '#16A34A',
                color: '#FFFFFF',
                fontSize: '11px',
                fontWeight: '700',
                cursor: 'pointer'
              }}
            >
              Apply AI Draft Reply
            </button>
          </div>
        )}

        {/* Chat Message Stream */}
        <div style={{
          flex: 1,
          overflowY: 'auto',
          padding: '20px',
          backgroundColor: '#F8FAFC',
          display: 'flex',
          flexDirection: 'column',
          gap: '12px'
        }}>
          {activeConv?.messages?.map(msg => {
            const isMe = msg.sender === 'agent';
            return (
              <div
                key={msg.id}
                style={{
                  alignSelf: isMe ? 'flex-end' : 'flex-start',
                  maxWidth: '70%',
                  backgroundColor: isMe ? '#0E7490' : '#FFFFFF',
                  color: isMe ? '#FFFFFF' : '#0F172A',
                  padding: '10px 14px',
                  borderRadius: '12px',
                  borderTopRightRadius: isMe ? '2px' : '12px',
                  borderTopLeftRadius: isMe ? '12px' : '2px',
                  boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
                  border: isMe ? 'none' : '1px solid #E2E8F0'
                }}
              >
                {!isMe && (
                  <div style={{ fontSize: '10px', fontWeight: '800', color: '#0E7490', marginBottom: '2px' }}>
                    {msg.senderName || activeConv.customerName}
                  </div>
                )}
                <div style={{ fontSize: '13px', lineHeight: '1.4', whiteSpace: 'pre-wrap' }}>
                  {msg.text}
                </div>
                <div style={{
                  display: 'flex',
                  justifyContent: 'flex-end',
                  alignItems: 'center',
                  gap: '4px',
                  fontSize: '10px',
                  color: isMe ? '#CFFAFE' : '#94A3B8',
                  marginTop: '4px'
                }}>
                  <span>{new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                  {isMe && <CheckCheck size={12} />}
                </div>
              </div>
            );
          })}
          <div ref={messagesEndRef} />
        </div>

        {/* Quick Templates Bar */}
        <div style={{
          padding: '8px 16px',
          backgroundColor: '#FFFFFF',
          borderTop: '1px solid #E2E8F0',
          display: 'flex',
          alignItems: 'center',
          gap: '8px'
        }}>
          <span style={{ fontSize: '11px', fontWeight: '700', color: '#64748B' }}>Templates:</span>
          <select
            value={selectedTemplate}
            onChange={(e) => {
              setSelectedTemplate(e.target.value);
              handleApplyTemplate(e.target.value);
            }}
            style={{
              flex: 1,
              padding: '5px 8px',
              borderRadius: '6px',
              border: '1px solid #CBD5E1',
              fontSize: '12px',
              backgroundColor: '#FFFFFF',
              color: '#334155'
            }}
          >
            <option value="">Select official VRM structure message template...</option>
            {templates.map(t => (
              <option key={t.id} value={t.body || t.message}>[{t.category}] {t.title}</option>
            ))}
          </select>
        </div>

        {/* Chat Input Bar */}
        <form
          onSubmit={handleSend}
          style={{
            padding: '12px 16px',
            backgroundColor: '#FFFFFF',
            borderTop: '1px solid #F1F5F9',
            display: 'flex',
            gap: '8px',
            alignItems: 'center'
          }}
        >
          <input
            type="text"
            placeholder="Type WhatsApp message or select a template..."
            value={messageInput}
            onChange={(e) => setMessageInput(e.target.value)}
            disabled={isSending}
            style={{
              flex: 1,
              padding: '10px 14px',
              borderRadius: '8px',
              border: '1px solid #CBD5E1',
              fontSize: '13px',
              outline: 'none'
            }}
          />
          <button
            type="submit"
            disabled={isSending || !messageInput.trim()}
            style={{
              padding: '10px 18px',
              borderRadius: '8px',
              border: 'none',
              backgroundColor: '#16A34A',
              color: '#FFFFFF',
              fontSize: '13px',
              fontWeight: '700',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}
          >
            <Send size={15} /> Send
          </button>
        </form>
      </div>

      {/* 3. RIGHT PANEL: Customer Intelligence & Quick Actions */}
      <div style={{
        backgroundColor: '#FFFFFF',
        borderRadius: '12px',
        border: '1px solid #E2E8F0',
        padding: '16px',
        display: 'flex',
        flexDirection: 'column',
        gap: '16px',
        overflowY: 'auto'
      }}>
        <div>
          <h4 style={{ fontSize: '13px', fontWeight: '800', color: '#0F172A', margin: '0 0 10px' }}>
            Customer Profile
          </h4>
          <div style={{ padding: '12px', backgroundColor: '#F8FAFC', borderRadius: '8px', border: '1px solid #E2E8F0' }}>
            <div style={{ fontWeight: '800', fontSize: '13px', color: '#0F172A' }}>{activeConv?.companyName}</div>
            <div style={{ fontSize: '12px', color: '#475569', marginTop: '2px' }}>{activeConv?.customerName}</div>
            <div style={{ fontSize: '11px', color: '#64748B', marginTop: '6px', display: 'flex', alignItems: 'center', gap: '4px' }}>
              <Phone size={12} /> {activeConv?.phone}
            </div>
          </div>
        </div>

        <div>
          <h4 style={{ fontSize: '13px', fontWeight: '800', color: '#0F172A', margin: '0 0 8px' }}>
            Quick CRM Actions
          </h4>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <button
              onClick={() => onNavigateTab('Sales BOM')}
              style={{
                padding: '8px 12px',
                borderRadius: '6px',
                border: '1px solid #E2E8F0',
                backgroundColor: '#FFFFFF',
                color: '#0F172A',
                fontSize: '12px',
                fontWeight: '700',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Layers size={13} color="#0E7490" />
                <span>Calculate BOM Order</span>
              </div>
              <ChevronRight size={14} />
            </button>

            <button
              onClick={() => onNavigateTab('Quotations')}
              style={{
                padding: '8px 12px',
                borderRadius: '6px',
                border: '1px solid #E2E8F0',
                backgroundColor: '#FFFFFF',
                color: '#0F172A',
                fontSize: '12px',
                fontWeight: '700',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <FileText size={13} color="#0E7490" />
                <span>Create Quotation</span>
              </div>
              <ChevronRight size={14} />
            </button>

            <button
              onClick={() => onNavigateTab('Follow-ups')}
              style={{
                padding: '8px 12px',
                borderRadius: '6px',
                border: '1px solid #E2E8F0',
                backgroundColor: '#FFFFFF',
                color: '#0F172A',
                fontSize: '12px',
                fontWeight: '700',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Clock size={13} color="#0E7490" />
                <span>Set Follow-up Reminder</span>
              </div>
              <ChevronRight size={14} />
            </button>
          </div>
        </div>

        <div style={{ padding: '14px', backgroundColor: waSession?.status === 'CONNECTED' ? '#F0FDF4' : '#F8FAFC', borderRadius: '10px', border: waSession?.status === 'CONNECTED' ? '1px solid #BBF7D0' : '1px solid #E2E8F0' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
            <div style={{ fontSize: '12px', fontWeight: '800', color: waSession?.status === 'CONNECTED' ? '#166534' : '#0F172A', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Smartphone size={14} color={waSession?.status === 'CONNECTED' ? '#16A34A' : '#64748B'} />
              My WhatsApp Device
            </div>
            <span style={{ fontSize: '10px', fontWeight: '800', color: waSession?.status === 'CONNECTED' ? '#15803D' : '#64748B' }}>
              {waSession?.status === 'CONNECTED' ? 'Active' : 'Unlinked'}
            </span>
          </div>

          <div style={{ fontSize: '11.5px', color: '#475569', lineHeight: '1.4', marginBottom: '10px' }}>
            {waSession?.status === 'CONNECTED' ? (
              <span>Your phone <strong>+{waSession.phoneNumber}</strong> is linked. Quotations and messages will send directly from your personal number.</span>
            ) : (
              <span>Link your WhatsApp to send official Quotations, PIs, and BOM documents directly in 1 click without downloading to your phone.</span>
            )}
          </div>

          <button
            onClick={() => setIsQrModalOpen(true)}
            style={{
              width: '100%',
              padding: '7px 12px',
              borderRadius: '6px',
              border: 'none',
              backgroundColor: waSession?.status === 'CONNECTED' ? '#16A34A' : '#0E7490',
              color: '#FFFFFF',
              fontSize: '11px',
              fontWeight: '800',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px'
            }}
          >
            <QrCode size={13} />
            {waSession?.status === 'CONNECTED' ? 'Manage Connection / Switch' : 'Link WhatsApp (Scan QR)'}
          </button>
        </div>
      </div>

      {/* WhatsApp QR Pairing & Multi-Session Modal */}
      <WhatsAppQrModal
        isOpen={isQrModalOpen}
        onClose={() => setIsQrModalOpen(false)}
        onSessionChanged={(s) => setWaSession(s)}
      />

      {/* NEW CHAT MODAL */}
      {showNewChatModal && (
        <div style={{
          position: 'fixed',
          top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(15, 23, 42, 0.75)',
          backdropFilter: 'blur(4px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 100003,
          padding: '16px'
        }}>
          <div style={{
            backgroundColor: '#FFFFFF',
            borderRadius: '16px',
            width: '100%',
            maxWidth: '440px',
            boxShadow: '0 25px 50px -12px rgba(0,0,0,0.3)',
            overflow: 'hidden'
          }}>
            <div style={{
              backgroundColor: '#075E54',
              padding: '16px 20px',
              color: '#FFFFFF',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <MessageSquare size={18} />
                <h3 style={{ margin: 0, fontSize: '15px', fontWeight: '800' }}>
                  Start New WhatsApp Chat
                </h3>
              </div>
              <button
                onClick={() => setShowNewChatModal(false)}
                style={{ backgroundColor: 'transparent', border: 'none', color: '#FFFFFF', cursor: 'pointer' }}
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleStartNewChat} style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: '#334155', marginBottom: '6px' }}>
                  Customer Phone Number (with Country Code)
                </label>
                <input
                  type="text"
                  placeholder="e.g. 919876543210 or 9876543210"
                  value={newChatPhone}
                  onChange={(e) => setNewChatPhone(e.target.value)}
                  required
                  autoFocus
                  style={{
                    width: '100%',
                    padding: '9px 12px',
                    borderRadius: '8px',
                    border: '1px solid #CBD5E1',
                    fontSize: '13px',
                    boxSizing: 'border-box'
                  }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: '#334155', marginBottom: '6px' }}>
                  Contact Name (Optional)
                </label>
                <input
                  type="text"
                  placeholder="e.g. Ramesh Kumar"
                  value={newChatName}
                  onChange={(e) => setNewChatName(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '9px 12px',
                    borderRadius: '8px',
                    border: '1px solid #CBD5E1',
                    fontSize: '13px',
                    boxSizing: 'border-box'
                  }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '6px' }}>
                <button
                  type="button"
                  onClick={() => setShowNewChatModal(false)}
                  style={{
                    padding: '8px 16px',
                    borderRadius: '8px',
                    border: '1px solid #CBD5E1',
                    backgroundColor: '#FFFFFF',
                    color: '#475569',
                    fontSize: '12px',
                    fontWeight: '700',
                    cursor: 'pointer'
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!newChatPhone.trim()}
                  style={{
                    padding: '9px 20px',
                    borderRadius: '8px',
                    border: 'none',
                    backgroundColor: '#16A34A',
                    color: '#FFFFFF',
                    fontSize: '12px',
                    fontWeight: '800',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px'
                  }}
                >
                  <Plus size={14} /> Start Chat
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
