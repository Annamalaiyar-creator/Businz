import React, { useState, useEffect, useRef } from 'react';
import { MessageSquare, Send, Search, User, Phone, ArrowLeft, Check, CheckCheck } from 'lucide-react';
import { INITIAL_WHATSAPP_CONVERSATIONS } from '../../../services/crmStore';

export default function MobileCrmView({ userRole }) {
  const [conversations, setConversations] = useState(() => {
    try {
      const saved = localStorage.getItem('crm_whatsapp_conversations');
      if (saved) return JSON.parse(saved);
    } catch (_) {}
    return INITIAL_WHATSAPP_CONVERSATIONS;
  });

  const [activeConvId, setActiveConvId] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [messageInput, setMessageInput] = useState('');
  const [isSending, setIsSending] = useState(false);
  const messagesEndRef = useRef(null);

  const activeConv = conversations.find(c => c.id === activeConvId);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [activeConv?.messages]);

  // Live real-time incoming WhatsApp listener
  useEffect(() => {
    const handleIncoming = (e) => {
      if (e?.detail?.from && e?.detail?.text) {
        const { from, text, timestamp, formattedPhone } = e.detail;
        setConversations(prev => {
          const list = [...prev];
          const phoneToMatch = (formattedPhone || from).replace(/[^0-9]/g, '');
          let convIdx = list.findIndex(c => (c.phone || '').replace(/[^0-9]/g, '') === phoneToMatch);
          const newMsg = {
            id: `MSG-${Date.now()}`,
            sender: 'customer',
            text,
            timestamp: timestamp || new Date().toISOString(),
            status: 'received'
          };
          if (convIdx !== -1) {
            const conv = { ...list[convIdx] };
            conv.messages = [...(conv.messages || []), newMsg];
            conv.lastMessage = text;
            conv.timestamp = timestamp || new Date().toISOString();
            list[convIdx] = conv;
          } else {
            list.unshift({
              id: `CONV-${Date.now()}`,
              customerName: `+${from}`,
              phone: `+${from}`,
              companyName: 'New Contact',
              lastMessage: text,
              timestamp: timestamp || new Date().toISOString(),
              unreadCount: 1,
              status: 'active',
              messages: [newMsg]
            });
          }
          try {
            localStorage.setItem('crm_whatsapp_conversations', JSON.stringify(list));
          } catch (_) {}
          return list;
        });
      }
    };

    window.addEventListener('controlroom_whatsapp_message', handleIncoming);
    return () => window.removeEventListener('controlroom_whatsapp_message', handleIncoming);
  }, []);

  const handleSendMessage = async (e) => {
    e?.preventDefault();
    if (!messageInput.trim() || !activeConv) return;

    setIsSending(true);
    const newMsg = {
      id: `MSG-${Date.now()}`,
      sender: 'agent',
      text: messageInput.trim(),
      timestamp: new Date().toISOString(),
      status: 'sent'
    };

    const updated = conversations.map(c => {
      if (c.id === activeConv.id) {
        return {
          ...c,
          lastMessage: messageInput.trim(),
          timestamp: new Date().toISOString(),
          messages: [...(c.messages || []), newMsg]
        };
      }
      return c;
    });

    setConversations(updated);
    try {
      localStorage.setItem('crm_whatsapp_conversations', JSON.stringify(updated));
    } catch (_) {}

    try {
      await fetch('/api/crm/whatsapp/send-message', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: activeConv.phone,
          text: messageInput.trim()
        })
      });
    } catch (_) {}

    setMessageInput('');
    setIsSending(false);
  };

  const filtered = conversations.filter(c => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return c.customerName?.toLowerCase().includes(q) || c.phone?.includes(q) || c.companyName?.toLowerCase().includes(q);
  });

  // Active Chat Screen
  if (activeConv) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 120px)', fontFamily: "'Plus Jakarta Sans', -apple-system, sans-serif" }}>
        {/* Chat Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 16px', backgroundColor: '#FFFFFF', borderBottom: '1px solid #E2E8F0' }}>
          <button
            onClick={() => setActiveConvId(null)}
            style={{ border: 'none', background: 'none', padding: '4px', cursor: 'pointer', color: '#475569' }}
          >
            <ArrowLeft size={20} />
          </button>
          <div style={{ width: '36px', height: '36px', borderRadius: '50%', backgroundColor: '#25D366', color: '#FFFFFF', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: '800' }}>
            <User size={18} />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: '14px', fontWeight: '800', color: '#0F172A', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {activeConv.customerName}
            </div>
            <div style={{ fontSize: '11px', color: '#16A34A', fontWeight: '600' }}>
              WhatsApp • {activeConv.phone}
            </div>
          </div>
        </div>

        {/* Message Feed */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '16px', display: 'flex', flexDirection: 'column', gap: '10px', backgroundColor: '#F8FAFC' }}>
          {(activeConv.messages || []).map((msg, i) => {
            const isMe = msg.sender === 'agent';
            return (
              <div
                key={i}
                style={{
                  alignSelf: isMe ? 'flex-end' : 'flex-start',
                  maxWidth: '82%',
                  backgroundColor: isMe ? '#DCF8C6' : '#FFFFFF',
                  color: '#0F172A',
                  padding: '10px 12px',
                  borderRadius: '12px',
                  borderBottomRightRadius: isMe ? '2px' : '12px',
                  borderBottomLeftRadius: isMe ? '12px' : '2px',
                  boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
                  fontSize: '13.5px',
                  lineHeight: '1.4'
                }}
              >
                <div>{msg.text}</div>
                <div style={{ fontSize: '10px', color: '#64748B', textAlign: 'right', marginTop: '4px' }}>
                  {msg.timestamp ? new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                </div>
              </div>
            );
          })}
          <div ref={messagesEndRef} />
        </div>

        {/* Input Bar */}
        <form
          onSubmit={handleSendMessage}
          style={{ display: 'flex', gap: '8px', padding: '10px 14px', backgroundColor: '#FFFFFF', borderTop: '1px solid #E2E8F0', alignItems: 'center' }}
        >
          <input
            type="text"
            placeholder="Type a WhatsApp message..."
            value={messageInput}
            onChange={(e) => setMessageInput(e.target.value)}
            style={{ flex: 1, height: '40px', borderRadius: '20px', border: '1px solid #CBD5E1', padding: '0 14px', fontSize: '13.5px', outline: 'none' }}
          />
          <button
            type="submit"
            disabled={isSending || !messageInput.trim()}
            style={{
              width: '40px',
              height: '40px',
              borderRadius: '50%',
              backgroundColor: '#25D366',
              color: '#FFFFFF',
              border: 'none',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              opacity: !messageInput.trim() ? 0.6 : 1
            }}
          >
            <Send size={16} />
          </button>
        </form>
      </div>
    );
  }

  // Conversation List Screen
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', paddingBottom: '90px', fontFamily: "'Plus Jakarta Sans', -apple-system, sans-serif" }}>
      {/* Header */}
      <div style={{ backgroundColor: '#15803D', color: '#FFFFFF', padding: '16px', borderRadius: '14px', boxShadow: '0 4px 12px rgba(21, 128, 61, 0.15)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.5px', color: '#BBF7D0', fontWeight: '700' }}>Customer Communications</div>
            <h2 style={{ fontSize: '18px', fontWeight: '800', margin: '2px 0 0 0' }}>WhatsApp Inbox</h2>
          </div>
          <div style={{ backgroundColor: 'rgba(255, 255, 255, 0.15)', padding: '6px 12px', borderRadius: '20px', fontSize: '12px', fontWeight: '800' }}>
            {filtered.length} Chats
          </div>
        </div>
      </div>

      {/* Search */}
      <div style={{ position: 'relative' }}>
        <input
          type="text"
          placeholder="Search chats, customer or phone..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          style={{ width: '100%', height: '44px', borderRadius: '12px', border: '1px solid #E2E8F0', padding: '0 40px 0 38px', fontSize: '14px', backgroundColor: '#FFFFFF', outline: 'none', boxSizing: 'border-box' }}
        />
        <Search size={16} style={{ position: 'absolute', left: '12px', top: '14px', color: '#94A3B8' }} />
      </div>

      {/* Conversations Feed */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {filtered.map(c => (
          <div
            key={c.id}
            onClick={() => setActiveConvId(c.id)}
            style={{
              backgroundColor: '#FFFFFF',
              borderRadius: '12px',
              border: '1px solid #E2E8F0',
              padding: '12px 14px',
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              cursor: 'pointer'
            }}
          >
            <div style={{ width: '42px', height: '42px', borderRadius: '50%', backgroundColor: '#DCFCE7', color: '#16A34A', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: '800', flexShrink: 0 }}>
              {c.customerName?.charAt(0) || 'C'}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ fontSize: '14px', fontWeight: '800', color: '#0F172A', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {c.customerName}
                </div>
                <div style={{ fontSize: '11px', color: '#94A3B8' }}>
                  {c.timestamp ? new Date(c.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                </div>
              </div>
              <div style={{ fontSize: '12px', color: '#64748B', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', marginTop: '2px' }}>
                {c.lastMessage || 'Start conversation...'}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
