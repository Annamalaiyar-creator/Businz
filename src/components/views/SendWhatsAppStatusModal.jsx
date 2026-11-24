import React, { useState, useEffect } from 'react';
import { 
  X, 
  MessageSquare, 
  Send, 
  ExternalLink, 
  CheckCircle, 
  AlertCircle, 
  Loader2, 
  Phone, 
  User, 
  Copy, 
  Check, 
  Truck, 
  Package, 
  FileText, 
  RefreshCw 
} from 'lucide-react';
import { 
  formatCustomerOrderStatusText, 
  openWhatsAppWebFallback, 
  getWhatsAppStatus, 
  sendDirectWhatsApp 
} from '../../utils/whatsappDispatchService';

export default function SendWhatsAppStatusModal({ order, onClose }) {
  if (!order) return null;

  const rawPhone = order.mobile || order.phone || order.contactPhone || order.contact_person_phone || order.contact?.phone || order.primaryContact?.phone || order.c4 || '';
  const initialPhone = String(rawPhone).replace(/[^0-9]/g, '');

  const [phone, setPhone] = useState(initialPhone);
  const [customNote, setCustomNote] = useState('');
  const [messageText, setMessageText] = useState(() => formatCustomerOrderStatusText(order, ''));
  const [isSending, setIsSending] = useState(false);
  const [sendSuccess, setSendSuccess] = useState(false);
  const [copied, setCopied] = useState(false);
  const [sessionStatus, setSessionStatus] = useState({ isReady: false, status: 'CHECKING' });

  // Check user's paired WhatsApp session status
  useEffect(() => {
    let active = true;
    getWhatsAppStatus().then(st => {
      if (active) setSessionStatus(st);
    }).catch(() => {
      if (active) setSessionStatus({ isReady: false, status: 'DISCONNECTED' });
    });
    return () => { active = false; };
  }, []);

  // Update message preview when customNote changes
  const handleNoteChange = (e) => {
    const val = e.target.value;
    setCustomNote(val);
    setMessageText(formatCustomerOrderStatusText(order, val));
  };

  const handleCopy = () => {
    navigator.clipboard?.writeText(messageText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // 1. Direct dispatch via connected WhatsApp socket or backend gateway
  const handleSendDirect = async () => {
    if (!phone || phone.length < 10) {
      alert('Please enter a valid 10-digit mobile number.');
      return;
    }

    setIsSending(true);
    try {
      const cleanPhone = phone.length === 10 ? '91' + phone : phone;
      const res = await fetch('/api/whatsapp/auto-status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bomCode: order.bomCode || order.code || order.id,
          customerPhone: cleanPhone,
          customerName: order.customerName || order.companyName || 'Customer',
          stageEvent: 'MANUAL_DISPATCH',
          text: messageText,
          details: {
            status: order.status,
            packingStatus: order.packingStatus,
            invoiceNo: order.invoiceNo
          }
        })
      });

      const data = await res.json().catch(() => ({}));
      if (data && data.success) {
        setSendSuccess(true);
        setTimeout(() => {
          onClose();
        }, 1800);
      } else {
        // Fallback to direct user session send
        await sendDirectWhatsApp({
          to: cleanPhone,
          text: messageText
        });
        setSendSuccess(true);
        setTimeout(() => {
          onClose();
        }, 1800);
      }
    } catch (err) {
      // If direct sending fails or no session, offer WhatsApp Web
      if (window.confirm(`Direct send error: ${err.message}\n\nWould you like to open in WhatsApp Web / App directly instead?`)) {
        openWhatsAppWebFallback({ to: phone, text: messageText });
        onClose();
      }
    } finally {
      setIsSending(false);
    }
  };

  // 2. Open via WhatsApp Web / App (Universal fallback)
  const handleOpenWhatsAppWeb = () => {
    if (!phone || phone.length < 10) {
      alert('Please enter a valid 10-digit mobile number.');
      return;
    }
    openWhatsAppWebFallback({ to: phone, text: messageText });
    onClose();
  };

  const bCode = order.bomCode || order.code || order.id || 'ORDER';
  const custName = order.customerName || order.companyName || order.vendor || 'Customer';

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(15, 23, 42, 0.75)',
      backdropFilter: 'blur(4px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 99999,
      padding: '16px'
    }}>
      <div style={{
        backgroundColor: '#FFFFFF',
        borderRadius: '16px',
        width: '100%',
        maxWidth: '580px',
        maxHeight: '90vh',
        display: 'flex',
        flexDirection: 'column',
        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
        overflow: 'hidden',
        border: '1px solid #E2E8F0'
      }}>
        {/* Modal Header */}
        <div style={{
          backgroundColor: '#075E54',
          backgroundImage: 'linear-gradient(135deg, #075E54 0%, #128C7E 100%)',
          padding: '18px 24px',
          color: '#FFFFFF',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{
              width: '40px',
              height: '40px',
              borderRadius: '10px',
              backgroundColor: 'rgba(255, 255, 255, 0.2)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <MessageSquare size={22} color="#FFFFFF" />
            </div>
            <div>
              <h2 style={{ fontSize: '17px', fontWeight: '800', margin: 0, letterSpacing: '-0.01em' }}>
                Send Order Status via WhatsApp
              </h2>
              <div style={{ fontSize: '12px', opacity: 0.9, marginTop: '2px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span>{bCode}</span>
                <span>•</span>
                <span style={{ fontWeight: '600' }}>{custName}</span>
              </div>
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'transparent',
              border: 'none',
              color: '#FFFFFF',
              cursor: 'pointer',
              padding: '6px',
              borderRadius: '6px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            <X size={20} />
          </button>
        </div>

        {/* Modal Body */}
        <div style={{ padding: '20px 24px', overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {sendSuccess ? (
            <div style={{
              padding: '40px 20px',
              textAlign: 'center',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '12px'
            }}>
              <div style={{ width: '60px', height: '60px', borderRadius: '50%', backgroundColor: '#DCFCE7', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <CheckCircle size={36} color="#16A34A" />
              </div>
              <h3 style={{ fontSize: '18px', fontWeight: '800', color: '#0F172A', margin: 0 }}>
                Status Sent Successfully!
              </h3>
              <p style={{ fontSize: '13px', color: '#64748B', margin: 0 }}>
                Order status message has been dispatched to <strong>+{phone}</strong>.
              </p>
            </div>
          ) : (
            <>
              {/* Recipient Phone Input */}
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: '#334155', marginBottom: '6px' }}>
                  Recipient Customer Mobile / WhatsApp No:
                </label>
                <div style={{ display: 'flex', alignItems: 'center', position: 'relative' }}>
                  <span style={{
                    position: 'absolute',
                    left: '12px',
                    fontSize: '13px',
                    fontWeight: '700',
                    color: '#64748B'
                  }}>+91</span>
                  <input
                    type="text"
                    value={phone.startsWith('91') && phone.length > 10 ? phone.slice(2) : phone}
                    onChange={(e) => setPhone(e.target.value.replace(/[^0-9]/g, ''))}
                    placeholder="Enter 10-digit mobile number"
                    style={{
                      width: '100%',
                      padding: '9px 12px 9px 44px',
                      borderRadius: '8px',
                      border: '1px solid #CBD5E1',
                      fontSize: '14px',
                      fontWeight: '600',
                      color: '#0F172A',
                      outline: 'none',
                      boxSizing: 'border-box'
                    }}
                  />
                </div>
              </div>

              {/* Optional Custom Note */}
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: '#334155', marginBottom: '6px' }}>
                  Add Custom Note (Optional):
                </label>
                <input
                  type="text"
                  value={customNote}
                  onChange={handleNoteChange}
                  placeholder="e.g. Driver contact: Ramesh 9876543210 / Deliver to Warehouse B"
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    borderRadius: '8px',
                    border: '1px solid #CBD5E1',
                    fontSize: '13px',
                    color: '#0F172A',
                    outline: 'none',
                    boxSizing: 'border-box'
                  }}
                />
              </div>

              {/* Live Message Preview */}
              <div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
                  <label style={{ fontSize: '12px', fontWeight: '700', color: '#334155' }}>
                    Live Message Preview:
                  </label>
                  <button
                    onClick={handleCopy}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: '#0D9488',
                      fontSize: '11px',
                      fontWeight: '700',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px'
                    }}
                  >
                    {copied ? <Check size={12} /> : <Copy size={12} />}
                    {copied ? 'Copied' : 'Copy Text'}
                  </button>
                </div>
                <textarea
                  value={messageText}
                  onChange={(e) => setMessageText(e.target.value)}
                  rows={8}
                  style={{
                    width: '100%',
                    padding: '12px',
                    borderRadius: '8px',
                    border: '1px solid #E2E8F0',
                    backgroundColor: '#F8FAFC',
                    fontSize: '12px',
                    fontFamily: 'monospace',
                    lineHeight: '1.5',
                    color: '#1E293B',
                    boxSizing: 'border-box',
                    resize: 'vertical'
                  }}
                />
              </div>

              {/* Session Status Banner */}
              <div style={{
                padding: '10px 14px',
                borderRadius: '8px',
                backgroundColor: sessionStatus.isReady ? '#F0FDF4' : '#F8FAFC',
                border: `1px solid ${sessionStatus.isReady ? '#BBF7D0' : '#E2E8F0'}`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                fontSize: '12px'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{
                    width: '8px',
                    height: '8px',
                    borderRadius: '50%',
                    backgroundColor: sessionStatus.isReady ? '#16A34A' : '#94A3B8'
                  }} />
                  <span style={{ color: sessionStatus.isReady ? '#166534' : '#64748B', fontWeight: '600' }}>
                    {sessionStatus.isReady 
                      ? `Paired WhatsApp: +${sessionStatus.phoneNumber || 'Connected'}` 
                      : 'Direct pairing inactive • WhatsApp Web will open'}
                  </span>
                </div>
                <span style={{ color: '#94A3B8', fontSize: '11px' }}>
                  {sessionStatus.isReady ? 'Direct Dispatch Ready' : 'One-Click Web Ready'}
                </span>
              </div>
            </>
          )}
        </div>

        {/* Modal Footer */}
        {!sendSuccess && (
          <div style={{
            padding: '16px 24px',
            backgroundColor: '#F8FAFC',
            borderTop: '1px solid #E2E8F0',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'flex-end',
            gap: '10px'
          }}>
            <button
              onClick={onClose}
              disabled={isSending}
              style={{
                padding: '9px 16px',
                borderRadius: '8px',
                border: '1px solid #CBD5E1',
                backgroundColor: '#FFFFFF',
                color: '#475569',
                fontSize: '13px',
                fontWeight: '600',
                cursor: 'pointer'
              }}
            >
              Cancel
            </button>
            <button
              onClick={handleOpenWhatsAppWeb}
              disabled={isSending}
              style={{
                padding: '9px 16px',
                borderRadius: '8px',
                border: '1px solid #CBD5E1',
                backgroundColor: '#F1F5F9',
                color: '#0F172A',
                fontSize: '13px',
                fontWeight: '700',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px'
              }}
              title="Open WhatsApp Web in a new tab with pre-filled status text"
            >
              <ExternalLink size={14} color="#075E54" />
              Open WhatsApp Web
            </button>
            <button
              onClick={handleSendDirect}
              disabled={isSending}
              style={{
                padding: '9px 20px',
                borderRadius: '8px',
                border: 'none',
                backgroundColor: '#25D366',
                backgroundImage: 'linear-gradient(135deg, #128C7E 0%, #25D366 100%)',
                color: '#FFFFFF',
                fontSize: '13px',
                fontWeight: '800',
                cursor: isSending ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                boxShadow: '0 2px 6px rgba(37, 211, 102, 0.3)'
              }}
            >
              {isSending ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
              {isSending ? 'Sending...' : 'Send via WhatsApp'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
