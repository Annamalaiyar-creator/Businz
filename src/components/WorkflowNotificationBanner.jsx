import React, { useState, useEffect, useRef } from 'react';
import { X } from 'lucide-react';
import { isRoleTargeted, markNotificationAsRead, speakNotificationVoice, playPorterOrderAlert, getPorterVoiceCue } from '../services/notificationService';

export default function WorkflowNotificationBanner({ userRole, onNavigate }) {
  const [activeToast, setActiveToast] = useState(null);
  const timerRef = useRef(null);
  const seenToastIds = useRef(new Set());

  useEffect(() => {
    const handleWorkflowToast = (event) => {
      const notif = event?.detail;
      if (!notif) return;
      if (notif.id === 'NOTIF-001' || String(notif.title || '').includes('System Central Inventory Initialized')) {
        return;
      }

      // 1. Role-based targeting filter: Only show if matches user's active role
      if (!isRoleTargeted(userRole, notif.targetRoles, { ...notif.metadata, title: notif.title, message: notif.message, type: notif.type })) {
        return;
      }

      // Deduplicate rapid repeat events
      if (notif.id && seenToastIds.current.has(notif.id)) {
        return;
      }
      if (notif.id) {
        seenToastIds.current.add(notif.id);
        if (seenToastIds.current.size > 30) {
          const [first] = seenToastIds.current;
          seenToastIds.current.delete(first);
        }
      }

      // 2. Voice Message: Play sound alert & speech cue
      if (notif.fromBroadcast) {
        playPorterOrderAlert();
        setTimeout(() => {
          const cue = getPorterVoiceCue(notif, notif.metadata);
          speakNotificationVoice(cue, { rate: 1.12, pitch: 1.05 });
        }, 300);
      }

      // Clear any previous timer
      if (timerRef.current) clearTimeout(timerRef.current);

      setActiveToast(notif);

      // Auto-dismiss cleanly after 5 seconds
      timerRef.current = setTimeout(() => {
        if (notif && notif.id) {
          markNotificationAsRead(notif.id);
        }
        setActiveToast(null);
      }, 5000);
    };

    window.addEventListener('vrm_workflow_toast', handleWorkflowToast);
    return () => {
      window.removeEventListener('vrm_workflow_toast', handleWorkflowToast);
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [userRole]);

  if (!activeToast) return null;

  const handleActionClick = (e) => {
    if (e) e.stopPropagation();
    if (timerRef.current) clearTimeout(timerRef.current);

    const targetTab = activeToast.targetTab;
    const notifId = activeToast.id;
    setActiveToast(null);

    if (notifId) {
      markNotificationAsRead(notifId);
    }

    if (onNavigate && targetTab) {
      onNavigate(targetTab);
    }
  };

  const handleDismiss = (e) => {
    if (e) e.stopPropagation();
    if (timerRef.current) clearTimeout(timerRef.current);
    const notifId = activeToast.id;
    setActiveToast(null);

    if (notifId) {
      markNotificationAsRead(notifId);
    }
  };

  // Clean title (strip leading emoji if any for modern iOS look matching reference image)
  const rawTitle = activeToast.title || 'Notification';
  const cleanTitle = rawTitle.replace(/^[\p{Emoji}\p{Extended_Pictographic}\s]+/u, '').trim() || rawTitle;

  return (
    <>
      <style>{`
        @keyframes iosNotificationSlide {
          0% {
            transform: translateY(-24px) scale(0.96);
            opacity: 0;
          }
          100% {
            transform: translateY(0) scale(1);
            opacity: 1;
          }
        }
      `}</style>
      <div 
        onClick={handleActionClick}
        style={{
          position: 'fixed',
          top: '16px',
          right: '20px',
          zIndex: 9999999,
          maxWidth: '360px',
          width: 'calc(100vw - 40px)',
          backgroundColor: 'rgba(255, 255, 255, 0.96)',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          borderRadius: '18px',
          boxShadow: '0 12px 32px -4px rgba(15, 23, 42, 0.16), 0 4px 12px -2px rgba(15, 23, 42, 0.08), 0 0 0 1px rgba(15, 23, 42, 0.06)',
          fontFamily: "'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, 'SF Pro Text', sans-serif",
          animation: 'iosNotificationSlide 0.28s cubic-bezier(0.16, 1, 0.3, 1) forwards',
          cursor: activeToast.targetTab ? 'pointer' : 'default',
          padding: '12px 14px',
          display: 'flex',
          alignItems: 'flex-start',
          gap: '12px',
          transition: 'transform 0.15s ease, box-shadow 0.15s ease'
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.transform = 'translateY(-1px)';
          e.currentTarget.style.boxShadow = '0 16px 36px -4px rgba(15, 23, 42, 0.2), 0 0 0 1px rgba(15, 23, 42, 0.08)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.transform = 'translateY(0)';
          e.currentTarget.style.boxShadow = '0 12px 32px -4px rgba(15, 23, 42, 0.16), 0 4px 12px -2px rgba(15, 23, 42, 0.08), 0 0 0 1px rgba(15, 23, 42, 0.06)';
        }}
      >
        {/* Businz App Icon (iOS squircle matching user reference image) */}
        <div style={{
          width: '38px',
          height: '38px',
          borderRadius: '10px',
          backgroundColor: '#FFFFFF',
          boxShadow: '0 2px 6px rgba(14, 116, 144, 0.18), 0 0 0 1px rgba(14, 116, 144, 0.12)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
          overflow: 'hidden'
        }}>
          <img 
            src="/businz_icon.png" 
            alt="Businz" 
            style={{ width: '100%', height: '100%', objectFit: 'contain' }}
            onError={(e) => {
              e.currentTarget.src = '/businz_logo_clean.png';
            }}
          />
        </div>

        {/* Content: Title + NOW on row 1, Message on row 2 */}
        <div style={{ flex: 1, minWidth: 0, paddingTop: '1px' }}>
          {/* Header Row: Title on Left, NOW + Close on Right */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '8px',
            marginBottom: '2px'
          }}>
            <span style={{
              fontSize: '14px',
              fontWeight: '700',
              color: '#0F172A',
              letterSpacing: '-0.2px',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap'
            }}>
              {cleanTitle}
            </span>

            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
              <span style={{
                fontSize: '11px',
                fontWeight: '600',
                color: '#64748B',
                letterSpacing: '0.4px',
                textTransform: 'uppercase'
              }}>
                NOW
              </span>

              <button
                type="button"
                onClick={handleDismiss}
                title="Dismiss"
                style={{
                  border: 'none',
                  background: 'transparent',
                  color: '#94A3B8',
                  cursor: 'pointer',
                  padding: '2px',
                  borderRadius: '4px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  lineHeight: 1
                }}
                onMouseEnter={(e) => e.currentTarget.style.color = '#0F172A'}
                onMouseLeave={(e) => e.currentTarget.style.color = '#94A3B8'}
              >
                <X size={13} />
              </button>
            </div>
          </div>

          {/* Subtitle / Message Text */}
          <div style={{
            fontSize: '12.5px',
            color: '#334155',
            lineHeight: '1.38',
            fontWeight: '400',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            display: '-webkit-box',
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical'
          }}>
            {activeToast.message}
          </div>
        </div>
      </div>
    </>
  );
}
