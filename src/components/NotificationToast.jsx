import React, { useState, useEffect } from 'react';
import { AlertCircle, AlertTriangle, CheckCircle, Info, X } from 'lucide-react';

export default function NotificationToast({ alert, onClose, onRetry, onLearnMore }) {
  const alertObj = typeof alert === 'string' ? { message: alert, type: 'success' } : alert;
  const rawMessage = alertObj?.message || alertObj?.text || '';
  const rawType = alertObj?.type || 'success';
  const hasDetails = Boolean(alertObj && Array.isArray(alertObj.details) && alertObj.details.length > 0);
  const initialDuration = alertObj?.duration || (hasDetails ? 10 : 4);
  const [countdown, setCountdown] = useState(initialDuration);

  useEffect(() => {
    setCountdown(initialDuration);
    if (alertObj?.persistent) return;
    const timer = setInterval(() => {
      setCountdown(prev => {
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

  if (!alert) return null;

  const isError = rawType === 'error' || rawType === 'danger' || (rawMessage && (
    rawMessage.toLowerCase().includes('wrong') ||
    rawMessage.toLowerCase().includes('error') ||
    rawMessage.toLowerCase().includes('failed') ||
    rawMessage.toLowerCase().includes('unable')
  ));
  const isWarning = rawType === 'warning';
  const isSuccess = rawType === 'success' || (!isError && !isWarning);

  const containerBg = isError
    ? '#FFF0F2'
    : isWarning
      ? '#FFF7ED'
      : isSuccess
        ? '#F0FDF4'
        : '#EFF6FF';

  const iconBg = isError
    ? '#FEE2E2'
    : isWarning
      ? '#FFEDD5'
      : isSuccess
        ? '#DCFCE7'
        : '#DBEAFE';

  const iconFg = isError
    ? '#DC2626'
    : isWarning
      ? '#EA580C'
      : isSuccess
        ? '#16A34A'
        : '#2563EB';

  const titleText = alertObj?.title || (isError ? 'Uh oh! Something went wrong' : isSuccess ? 'Action Successful' : isWarning ? 'Attention Required' : 'System Notification');
  const bodyText = rawMessage || (isError ? 'We apologize for the inconvenience you experienced.' : 'Operation completed successfully.');

  return (
    <>
      <style>{`
        @keyframes toastSlideInRight {
          from {
            transform: translateX(120%);
            opacity: 0;
          }
          to {
            transform: translateX(0);
            opacity: 1;
          }
        }
      `}</style>
      <div style={{
        position: 'fixed',
        top: '20px',
        right: '20px',
        zIndex: 9999999,
        maxWidth: hasDetails ? '460px' : '380px',
        width: 'calc(100% - 40px)',
        backgroundColor: containerBg,
        borderRadius: '16px',
        padding: '8px 10px 10px 10px',
        boxShadow: '0 12px 30px -6px rgba(0, 0, 0, 0.16), 0 0 0 1px rgba(0, 0, 0, 0.05)',
        fontFamily: "'Plus Jakarta Sans', 'DM Sans', sans-serif",
        animation: 'toastSlideInRight 0.32s cubic-bezier(0.16, 1, 0.3, 1) forwards',
        boxSizing: 'border-box'
      }}>
        {/* Inner White Card */}
        <div style={{
          backgroundColor: '#FFFFFF',
          borderRadius: '12px',
          padding: '12px 14px',
          display: 'flex',
          flexDirection: 'column',
          gap: '10px',
          boxShadow: '0 1px 4px rgba(0, 0, 0, 0.04)'
        }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '10px' }}>
            {/* Left Side: Circular Icon + Title/Subtitle */}
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', flex: 1, minWidth: 0 }}>
              <div style={{
                width: '32px',
                height: '32px',
                borderRadius: '50%',
                backgroundColor: iconBg,
                color: iconFg,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
                marginTop: '1px'
              }}>
                {isError ? (
                  <AlertCircle size={18} strokeWidth={2.2} />
                ) : isWarning ? (
                  <AlertTriangle size={18} strokeWidth={2.2} />
                ) : isSuccess ? (
                  <CheckCircle size={18} strokeWidth={2.2} />
                ) : (
                  <Info size={18} strokeWidth={2.2} />
                )}
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', minWidth: 0 }}>
                <h4 style={{ fontSize: '13px', fontWeight: '800', color: '#0F172A', margin: 0, lineHeight: '1.25' }}>
                  {titleText}
                </h4>
                <div style={{ fontSize: '11.5px', color: '#64748B', lineHeight: '1.35', wordBreak: 'break-word', whiteSpace: 'pre-line' }}>
                  {bodyText}
                </div>
              </div>
            </div>

            {/* Close Button */}
            <button
              type="button"
              onClick={onClose}
              style={{
                width: '24px',
                height: '24px',
                borderRadius: '50%',
                border: '1px solid #E2E8F0',
                backgroundColor: '#FFFFFF',
                color: '#64748B',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                flexShrink: 0,
                transition: 'all 0.15s ease'
              }}
              onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#F1F5F9'; e.currentTarget.style.color = '#0F172A'; }}
              onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = '#FFFFFF'; e.currentTarget.style.color = '#64748B'; }}
            >
              <X size={13} strokeWidth={2.2} />
            </button>
          </div>

          {/* Missing Details Interactive List */}
          {hasDetails && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', maxHeight: '180px', overflowY: 'auto', borderTop: '1px solid #F1F5F9', paddingTop: '8px' }}>
              {alert.details.map((d, i) => {
                const fName = typeof d === 'string' ? d : (d.field || 'Missing Field');
                const fMsg = typeof d === 'object' ? (d.message || d.desc) : '';
                const tId = typeof d === 'object' ? d.targetId : null;
                return (
                  <div
                    key={i}
                    onClick={() => {
                      if (tId) {
                        const el = document.getElementById(tId);
                        if (el) {
                          el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                          el.focus();
                          if (onClose) onClose();
                        }
                      }
                    }}
                    style={{
                      display: 'flex',
                      alignItems: 'flex-start',
                      justifyContent: 'space-between',
                      gap: '8px',
                      padding: '6px 10px',
                      borderRadius: '8px',
                      backgroundColor: '#FEF2F2',
                      border: '1px solid #FECACA',
                      cursor: tId ? 'pointer' : 'default',
                      fontSize: '11.5px'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: '6px', minWidth: 0, flex: 1 }}>
                      <AlertCircle size={13} style={{ color: '#DC2626', marginTop: '2px', flexShrink: 0 }} />
                      <div style={{ minWidth: 0 }}>
                        <span style={{ fontWeight: '800', color: '#991B1B' }}>{fName}</span>
                        {fMsg && <span style={{ color: '#B91C1C', marginLeft: '4px' }}>— {fMsg}</span>}
                      </div>
                    </div>
                    {tId && (
                      <span style={{ fontSize: '10px', fontWeight: '800', color: '#0E7490', backgroundColor: '#ECFEFF', padding: '2px 6px', borderRadius: '4px', flexShrink: 0 }}>
                        Go →
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Countdown Timer Banner Text */}
        {!alert?.persistent && (
          <div style={{
            textAlign: 'right',
            marginTop: '6px',
            paddingRight: '4px',
            fontSize: '11px',
            fontWeight: '600',
            color: '#64748B'
          }}>
            Auto close in <span style={{ color: iconFg, fontWeight: '800' }}>{countdown}s</span>
          </div>
        )}
      </div>
    </>
  );
}
