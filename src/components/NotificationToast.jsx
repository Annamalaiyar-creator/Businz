import React, { useState, useEffect } from 'react';
import {
  Bell, Check, CheckCircle, AlertCircle, AlertTriangle, Info, X,
  ArrowRight, ExternalLink, GitBranch, UserCheck, CreditCard,
  FileText, Truck, ShoppingCart, Volume2
} from 'lucide-react';
import { speakNotificationVoice } from '../services/notificationService';

function getToastIcon(docType, eventType, rawType) {
  const dt = String(docType || '').toLowerCase();
  const et = String(eventType || '').toLowerCase();
  const rt = String(rawType || '').toLowerCase();

  if (dt === 'lead') {
    return { icon: <UserCheck size={18} />, bg: '#EFF6FF', fg: '#2563EB', tag: 'LEAD' };
  }
  if (dt === 'bom') {
    if (et.includes('cancel')) {
      return { icon: <X size={18} />, bg: '#FEF2F2', fg: '#DC2626', tag: 'BOM CANCELLED' };
    }
    if (et.includes('pack')) {
      return { icon: <Truck size={18} />, bg: '#F0FDF4', fg: '#16A34A', tag: 'DISPATCH PACKING' };
    }
    return { icon: <GitBranch size={18} />, bg: '#ECFEFF', fg: '#0E7490', tag: 'BOM ORDER' };
  }
  if (dt === 'po') {
    return { icon: <ShoppingCart size={18} />, bg: '#FAF5FF', fg: '#9333EA', tag: 'PURCHASE ORDER' };
  }
  if (dt === 'pi' || dt === 'invoice') {
    return { icon: <FileText size={18} />, bg: '#F0FDF4', fg: '#16A34A', tag: dt === 'pi' ? 'PROFORMA INVOICE' : 'TAX INVOICE' };
  }
  if (et.includes('account') || et.includes('pay')) {
    return { icon: <CreditCard size={18} />, bg: '#FFFBEB', fg: '#D97706', tag: 'ACCOUNTS' };
  }
  if (rt === 'error' || rt === 'danger') {
    return { icon: <AlertCircle size={18} />, bg: '#FEF2F2', fg: '#DC2626', tag: 'ALERT' };
  }
  if (rt === 'warning') {
    return { icon: <AlertTriangle size={18} />, bg: '#FFFBEB', fg: '#D97706', tag: 'ATTENTION' };
  }
  return { icon: <CheckCircle size={18} />, bg: '#F0FDF4', fg: '#16A34A', tag: 'UPDATE' };
}

export default function NotificationToast({ alert, onClose, onNavigate }) {
  if (!alert) return null;

  const alertObj = typeof alert === 'string' ? { message: alert, type: 'success' } : alert;
  const rawMessage = alertObj?.message || alertObj?.text || '';
  const rawType = alertObj?.type || 'success';
  const docType = alertObj?.document_type || alertObj?.docType || '';
  const eventType = alertObj?.event_type || alertObj?.eventType || '';
  const initialDuration = alertObj?.duration || 6;
  const [countdown, setCountdown] = useState(initialDuration);

  // Play voice and sound announcement on toast mount
  useEffect(() => {
    try {
      speakNotificationVoice(alertObj);
    } catch (_) {}
  }, [alertObj?.id || alertObj?.message]);

  // Countdown timer for auto-dismiss
  useEffect(() => {
    setCountdown(initialDuration);
    if (alertObj?.persistent) return;

    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          if (onClose) onClose();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [alertObj, onClose, initialDuration]);

  const { icon, bg, fg, tag } = getToastIcon(docType, eventType, rawType);

  const titleText = alertObj?.title || (
    rawType === 'error' ? 'Attention Required' :
    docType ? `${tag} Update` :
    'Action Successful'
  );

  const handleActionClick = () => {
    if (onNavigate && alertObj?.target_tab) {
      onNavigate(alertObj.target_tab, {
        recordId: alertObj.target_record_id || alertObj.document_id,
        highlightId: alertObj.document_id
      });
    }
    if (onClose) onClose();
  };

  return (
    <>
      <style>{`
        @keyframes toastSlideInRight {
          0% {
            transform: translateX(110%) scale(0.96);
            opacity: 0;
          }
          70% {
            transform: translateX(-2%) scale(1.01);
            opacity: 1;
          }
          100% {
            transform: translateX(0) scale(1);
            opacity: 1;
          }
        }
        @keyframes toastProgressAnim {
          from { width: 100%; }
          to { width: 0%; }
        }
        @keyframes toastPulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.4; transform: scale(0.85); }
        }
      `}</style>

      <div
        role="alert"
        aria-live="polite"
        style={{
          position: 'fixed',
          top: '20px',
          right: '24px',
          zIndex: 99999999,
          width: '390px',
          maxWidth: 'calc(100vw - 32px)',
          backgroundColor: '#FFFFFF',
          borderRadius: '16px',
          boxShadow: '0 20px 45px -10px rgba(15, 23, 42, 0.22), 0 0 0 1px rgba(15, 23, 42, 0.08)',
          fontFamily: "'Plus Jakarta Sans', 'DM Sans', -apple-system, sans-serif",
          animation: 'toastSlideInRight 0.32s cubic-bezier(0.16, 1, 0.3, 1) forwards',
          overflow: 'hidden',
          boxSizing: 'border-box'
        }}
      >
        {/* Top Header Strip: App Branding + Tag + Timestamp + Close Button */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '10px 14px 8px 14px',
            backgroundColor: '#FAFAFC',
            borderBottom: '1px solid #F1F5F9'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span
              style={{
                fontSize: '10.5px',
                fontWeight: '900',
                letterSpacing: '0.6px',
                color: '#0E7490',
                textTransform: 'uppercase'
              }}
            >
              BUSINZ
            </span>

            <span style={{ color: '#CBD5E1', fontSize: '11px' }}>•</span>

            <span
              style={{
                backgroundColor: bg,
                color: fg,
                fontSize: '10px',
                fontWeight: '800',
                padding: '2px 7px',
                borderRadius: '6px',
                letterSpacing: '0.3px',
                textTransform: 'uppercase'
              }}
            >
              {tag}
            </span>

            {/* Live Indicator Dot */}
            <span
              style={{
                width: '6px',
                height: '6px',
                borderRadius: '50%',
                backgroundColor: '#10B981',
                animation: 'toastPulse 1.8s infinite ease-in-out',
                display: 'inline-block'
              }}
            />
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ fontSize: '11px', color: '#94A3B8', fontWeight: '600' }}>
              Just now
            </span>
            <button
              type="button"
              onClick={onClose}
              title="Dismiss notification"
              style={{
                width: '22px',
                height: '22px',
                borderRadius: '50%',
                border: 'none',
                backgroundColor: 'transparent',
                color: '#94A3B8',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                transition: 'all 0.15s ease'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = '#E2E8F0';
                e.currentTarget.style.color = '#0F172A';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'transparent';
                e.currentTarget.style.color = '#94A3B8';
              }}
            >
              <X size={13} strokeWidth={2.4} />
            </button>
          </div>
        </div>

        {/* Main Content Body */}
        <div style={{ padding: '14px 16px', display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
          {/* Left Avatar Icon */}
          <div
            style={{
              width: '40px',
              height: '40px',
              borderRadius: '12px',
              backgroundColor: bg,
              color: fg,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
              boxShadow: '0 2px 6px rgba(0,0,0,0.04)'
            }}
          >
            {icon}
          </div>

          {/* Right Text Column */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', flex: 1, minWidth: 0 }}>
            <h4
              style={{
                fontSize: '13.5px',
                fontWeight: '800',
                color: '#0F172A',
                margin: 0,
                lineHeight: '1.3'
              }}
            >
              {titleText}
            </h4>
            <div
              style={{
                fontSize: '12px',
                color: '#475569',
                lineHeight: '1.45',
                wordBreak: 'break-word'
              }}
            >
              {rawMessage}
            </div>

            {/* Quick Action Button */}
            {alertObj?.target_tab && (
              <div style={{ marginTop: '8px' }}>
                <button
                  type="button"
                  onClick={handleActionClick}
                  style={{
                    border: 'none',
                    backgroundColor: '#ECFEFF',
                    color: '#0E7490',
                    fontSize: '11.5px',
                    fontWeight: '800',
                    padding: '5px 12px',
                    borderRadius: '7px',
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '5px',
                    transition: 'all 0.15s ease'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = '#0E7490';
                    e.currentTarget.style.color = '#FFFFFF';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = '#ECFEFF';
                    e.currentTarget.style.color = '#0E7490';
                  }}
                >
                  <span>Open {tag}</span>
                  <ArrowRight size={12} />
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Animated Auto-Dismiss Progress Bar at Bottom */}
        {!alertObj?.persistent && (
          <div
            style={{
              height: '3px',
              backgroundColor: '#F1F5F9',
              width: '100%',
              overflow: 'hidden'
            }}
          >
            <div
              style={{
                height: '100%',
                backgroundColor: fg,
                animation: `toastProgressAnim ${initialDuration}s linear forwards`
              }}
            />
          </div>
        )}
      </div>
    </>
  );
}
