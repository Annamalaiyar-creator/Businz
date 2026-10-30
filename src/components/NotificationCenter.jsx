import React, { useState, useEffect, useRef } from 'react';
import {
  Bell, Check, CheckCheck, X, GitBranch, UserCheck, CreditCard,
  FileText, Truck, ShoppingCart, Clock, ArrowRight, ExternalLink,
  Volume2, VolumeX
} from 'lucide-react';
import realtimeNotificationService from '../services/realtimeNotificationService';
import { isVoiceNotificationEnabled, setVoiceNotificationEnabled } from '../services/notificationService';

function getRelativeTime(timestamp) {
  if (!timestamp) return 'Just now';
  const now = Date.now();
  const past = new Date(timestamp).getTime();
  const diffSec = Math.max(0, Math.floor((now - past) / 1000));

  if (diffSec < 60) return 'Just now';
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHour = Math.floor(diffMin / 60);
  if (diffHour < 24) return `${diffHour}h ago`;
  const diffDay = Math.floor(diffHour / 24);
  if (diffDay < 7) return `${diffDay}d ago`;
  return new Date(timestamp).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });
}

function getNotificationIcon(docType, eventType) {
  const dt = String(docType || '').toLowerCase();
  const et = String(eventType || '').toLowerCase();

  if (dt === 'lead') {
    return { icon: <UserCheck size={16} />, bg: '#EFF6FF', fg: '#2563EB' };
  }
  if (dt === 'bom') {
    if (et.includes('cancel')) {
      return { icon: <X size={16} />, bg: '#FEF2F2', fg: '#DC2626' };
    }
    if (et.includes('pack')) {
      return { icon: <Truck size={16} />, bg: '#F0FDF4', fg: '#16A34A' };
    }
    return { icon: <GitBranch size={16} />, bg: '#ECFEFF', fg: '#0E7490' };
  }
  if (dt === 'po') {
    return { icon: <ShoppingCart size={16} />, bg: '#FAF5FF', fg: '#9333EA' };
  }
  if (dt === 'invoice') {
    return { icon: <FileText size={16} />, bg: '#F0FDF4', fg: '#16A34A' };
  }
  if (et.includes('account') || et.includes('pay')) {
    return { icon: <CreditCard size={16} />, bg: '#FFFBEB', fg: '#D97706' };
  }
  return { icon: <Bell size={16} />, bg: '#F1F5F9', fg: '#475569' };
}

export default function NotificationCenter({ onNavigateTab }) {
  const [isOpen, setIsOpen] = useState(false);
  const [activeFilter, setActiveFilter] = useState('all'); // 'all' | 'unread'
  const [voiceEnabled, setVoiceEnabled] = useState(isVoiceNotificationEnabled);
  const [state, setState] = useState({
    notifications: [],
    unreadCount: 0
  });

  const panelRef = useRef(null);

  const toggleVoice = (e) => {
    e.stopPropagation();
    const nextVal = !voiceEnabled;
    setVoiceEnabled(nextVal);
    setVoiceNotificationEnabled(nextVal);
  };

  const triggerTestAlert = (type) => {
    let payload;
    if (type === 'bom') {
      payload = {
        title: 'New BOM Order Submitted',
        message: 'VRM-BOM-2026-05 submitted by Sales for dispatch packing verification.',
        document_type: 'BOM',
        event_type: 'BOM_SUBMITTED',
        target_tab: 'BOM Orders',
        actor_name: 'Sales Dept'
      };
    } else if (type === 'lead') {
      payload = {
        title: 'New Lead Assigned to You',
        message: 'Karthik Raman (SunPower Systems - 100kW Rooftop Solar) assigned to you.',
        document_type: 'LEAD',
        event_type: 'LEAD_ASSIGNED',
        target_tab: 'CRM Leads',
        actor_name: 'Lead Manager'
      };
    } else if (type === 'po') {
      payload = {
        title: 'Purchase Order Approved',
        message: 'PO-00042 approved by MD. Proceed with payment details and inwarding.',
        document_type: 'PO',
        event_type: 'PO_APPROVED',
        target_tab: 'Purchase Orders',
        actor_name: 'MD Office'
      };
    }
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('businz_show_toast', { detail: payload }));
    }
  };

  useEffect(() => {
    realtimeNotificationService.start();
    const unsubscribe = realtimeNotificationService.subscribe((data) => {
      setState({
        notifications: data.notifications || [],
        unreadCount: data.unreadCount || 0
      });
    });

    const handleOutsideClick = (e) => {
      if (panelRef.current && !panelRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };
    window.addEventListener('mousedown', handleOutsideClick);

    return () => {
      unsubscribe();
      window.removeEventListener('mousedown', handleOutsideClick);
    };
  }, []);

  const filteredList = state.notifications.filter(n => {
    if (activeFilter === 'unread') return !n.is_read;
    return true;
  });

  const handleNotificationClick = (item) => {
    // 1. Mark as read
    if (!item.is_read) {
      realtimeNotificationService.markAsRead(item.id);
    }
    setIsOpen(false);

    // 2. Navigate immediately to the target tab and open the relevant document
    if (item.target_tab && typeof onNavigateTab === 'function') {
      onNavigateTab(item.target_tab, {
        recordId: item.target_record_id || item.document_id,
        highlightId: item.document_id,
        fromNotification: true
      });
    }
  };

  const handleMarkAllRead = (e) => {
    e.stopPropagation();
    realtimeNotificationService.markAsRead(null, true);
  };

  return (
    <div ref={panelRef} style={{ position: 'relative', display: 'inline-block' }}>
      {/* Header Bell Trigger Button */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        title="Notifications"
        style={{
          width: '38px',
          height: '38px',
          borderRadius: '50%',
          border: '1px solid rgba(226, 232, 240, 0.8)',
          backgroundColor: isOpen ? '#ECFEFF' : '#FFFFFF',
          color: isOpen ? '#0E7490' : '#475569',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'pointer',
          position: 'relative',
          transition: 'all 0.15s ease',
          boxShadow: '0 1px 2px rgba(0,0,0,0.04)'
        }}
        onMouseEnter={(e) => {
          if (!isOpen) e.currentTarget.style.backgroundColor = '#F8FAFC';
        }}
        onMouseLeave={(e) => {
          if (!isOpen) e.currentTarget.style.backgroundColor = '#FFFFFF';
        }}
      >
        <Bell size={18} strokeWidth={2.2} />

        {/* Unread Counter Badge */}
        {state.unreadCount > 0 && (
          <span
            style={{
              position: 'absolute',
              top: '-3px',
              right: '-3px',
              backgroundColor: '#EF4444',
              color: '#FFFFFF',
              borderRadius: '10px',
              minWidth: '18px',
              height: '18px',
              padding: '0 4px',
              fontSize: '10.5px',
              fontWeight: '800',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 2px 4px rgba(239, 68, 68, 0.4)',
              border: '2px solid #FFFFFF',
              lineHeight: 1
            }}
          >
            {state.unreadCount > 99 ? '99+' : state.unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown Notification Panel */}
      {isOpen && (
        <div
          style={{
            position: 'absolute',
            top: '46px',
            right: 0,
            width: '380px',
            maxWidth: 'calc(100vw - 24px)',
            backgroundColor: '#FFFFFF',
            borderRadius: '16px',
            boxShadow: '0 16px 36px -8px rgba(15, 23, 42, 0.22), 0 0 0 1px rgba(15, 23, 42, 0.08)',
            zIndex: 999999,
            overflow: 'hidden',
            fontFamily: "'Plus Jakarta Sans', 'DM Sans', -apple-system, sans-serif",
            animation: 'fadeIn 0.18s cubic-bezier(0.16, 1, 0.3, 1)'
          }}
        >
          {/* Top Panel Header */}
          <div
            style={{
              padding: '14px 16px',
              borderBottom: '1px solid #F1F5F9',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              backgroundColor: '#FAFAFA'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '14px', fontWeight: '800', color: '#0F172A' }}>
                Notifications
              </span>
              {state.unreadCount > 0 && (
                <span
                  style={{
                    backgroundColor: '#ECFEFF',
                    color: '#0E7490',
                    fontSize: '11px',
                    fontWeight: '800',
                    padding: '2px 8px',
                    borderRadius: '12px',
                    border: '1px solid #CFFAFE'
                  }}
                >
                  {state.unreadCount} new
                </span>
              )}
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              {/* Voice Alert Toggle */}
              <button
                type="button"
                onClick={toggleVoice}
                title={voiceEnabled ? 'Voice Announcements: ON (click to mute)' : 'Voice Announcements: OFF (click to enable)'}
                style={{
                  border: 'none',
                  background: voiceEnabled ? '#ECFEFF' : '#F1F5F9',
                  color: voiceEnabled ? '#0E7490' : '#94A3B8',
                  fontSize: '11px',
                  fontWeight: '700',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  padding: '4px 8px',
                  borderRadius: '6px',
                  transition: 'all 0.15s ease'
                }}
              >
                {voiceEnabled ? <Volume2 size={13} /> : <VolumeX size={13} />}
                <span>{voiceEnabled ? 'Voice ON' : 'Muted'}</span>
              </button>

              {state.unreadCount > 0 && (
                <button
                  type="button"
                  onClick={handleMarkAllRead}
                  style={{
                    border: 'none',
                    background: 'none',
                    color: '#0E7490',
                    fontSize: '11.5px',
                    fontWeight: '700',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                    padding: '4px 6px',
                    borderRadius: '6px'
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#ECFEFF'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; }}
                >
                  <CheckCheck size={14} />
                  Mark all read
                </button>
              )}
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                style={{
                  border: 'none',
                  background: 'none',
                  color: '#94A3B8',
                  cursor: 'pointer',
                  padding: '2px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderRadius: '4px'
                }}
              >
                <X size={16} />
              </button>
            </div>
          </div>

          {/* Quick Voice & Notification Test Shortcuts */}
          <div
            style={{
              padding: '6px 14px',
              backgroundColor: '#F8FAFC',
              borderBottom: '1px solid #F1F5F9',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '6px'
            }}
          >
            <span style={{ fontSize: '10.5px', fontWeight: '800', color: '#64748B', display: 'flex', alignItems: 'center', gap: '4px' }}>
              <Volume2 size={12} color="#0E7490" />
              Test Voice:
            </span>
            <div style={{ display: 'flex', gap: '5px' }}>
              <button
                type="button"
                onClick={() => triggerTestAlert('bom')}
                title="Test BOM Notification & Voice"
                style={{
                  border: '1px solid #CFFAFE',
                  backgroundColor: '#ECFEFF',
                  color: '#0E7490',
                  fontSize: '10px',
                  fontWeight: '800',
                  padding: '2px 8px',
                  borderRadius: '6px',
                  cursor: 'pointer'
                }}
              >
                BOM
              </button>
              <button
                type="button"
                onClick={() => triggerTestAlert('lead')}
                title="Test Lead Notification & Voice"
                style={{
                  border: '1px solid #DBEAFE',
                  backgroundColor: '#EFF6FF',
                  color: '#2563EB',
                  fontSize: '10px',
                  fontWeight: '800',
                  padding: '2px 8px',
                  borderRadius: '6px',
                  cursor: 'pointer'
                }}
              >
                Lead
              </button>
              <button
                type="button"
                onClick={() => triggerTestAlert('po')}
                title="Test Purchase Order Notification & Voice"
                style={{
                  border: '1px solid #F3E8FF',
                  backgroundColor: '#FAF5FF',
                  color: '#9333EA',
                  fontSize: '10px',
                  fontWeight: '800',
                  padding: '2px 8px',
                  borderRadius: '6px',
                  cursor: 'pointer'
                }}
              >
                PO
              </button>
            </div>
          </div>

          {/* Filter Sub-Tabs */}
          <div
            style={{
              padding: '8px 16px',
              borderBottom: '1px solid #F1F5F9',
              display: 'flex',
              gap: '6px',
              backgroundColor: '#FFFFFF'
            }}
          >
            <button
              type="button"
              onClick={() => setActiveFilter('all')}
              style={{
                border: 'none',
                backgroundColor: activeFilter === 'all' ? '#0E7490' : '#F1F5F9',
                color: activeFilter === 'all' ? '#FFFFFF' : '#64748B',
                fontSize: '11px',
                fontWeight: '700',
                padding: '4px 12px',
                borderRadius: '20px',
                cursor: 'pointer',
                transition: 'all 0.15s ease'
              }}
            >
              All ({state.notifications.length})
            </button>
            <button
              type="button"
              onClick={() => setActiveFilter('unread')}
              style={{
                border: 'none',
                backgroundColor: activeFilter === 'unread' ? '#0E7490' : '#F1F5F9',
                color: activeFilter === 'unread' ? '#FFFFFF' : '#64748B',
                fontSize: '11px',
                fontWeight: '700',
                padding: '4px 12px',
                borderRadius: '20px',
                cursor: 'pointer',
                transition: 'all 0.15s ease'
              }}
            >
              Unread ({state.unreadCount})
            </button>
          </div>

          {/* Notifications Scroll List */}
          <div style={{ maxHeight: '380px', overflowY: 'auto' }}>
            {filteredList.length === 0 ? (
              <div
                style={{
                  padding: '36px 20px',
                  textAlign: 'center',
                  color: '#94A3B8',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: '8px'
                }}
              >
                <div
                  style={{
                    width: '42px',
                    height: '42px',
                    borderRadius: '50%',
                    backgroundColor: '#F8FAFC',
                    color: '#CBD5E1',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}
                >
                  <Bell size={20} />
                </div>
                <span style={{ fontSize: '13px', fontWeight: '700', color: '#64748B' }}>
                  {activeFilter === 'unread' ? 'No unread notifications' : 'All caught up!'}
                </span>
                <span style={{ fontSize: '11.5px', color: '#94A3B8' }}>
                  Workflow handoffs & lead alerts will appear here in real-time.
                </span>
              </div>
            ) : (
              filteredList.map((item) => {
                const iconConfig = getNotificationIcon(item.document_type, item.event_type);
                const isUnread = !item.is_read;

                return (
                  <div
                    key={item.id}
                    onClick={() => handleNotificationClick(item)}
                    style={{
                      padding: '12px 16px',
                      borderBottom: '1px solid #F1F5F9',
                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: '12px',
                      cursor: 'pointer',
                      backgroundColor: isUnread ? '#F8FCFD' : '#FFFFFF',
                      transition: 'background-color 0.15s ease',
                      position: 'relative'
                    }}
                    onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = isUnread ? '#EDF8FA' : '#F8FAFC'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = isUnread ? '#F8FCFD' : '#FFFFFF'; }}
                  >
                    {/* Document Icon Avatar */}
                    <div
                      style={{
                        width: '34px',
                        height: '34px',
                        borderRadius: '10px',
                        backgroundColor: iconConfig.bg,
                        color: iconConfig.fg,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0,
                        marginTop: '2px'
                      }}
                    >
                      {iconConfig.icon}
                    </div>

                    {/* Notification Content */}
                    <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: '2px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
                        <span style={{ fontSize: '12.5px', fontWeight: '800', color: '#0F172A', lineHeight: '1.3' }}>
                          {item.title}
                        </span>
                        <span style={{ fontSize: '10.5px', color: '#94A3B8', whiteSpace: 'nowrap', fontWeight: '500' }}>
                          {getRelativeTime(item.created_at)}
                        </span>
                      </div>

                      <div style={{ fontSize: '11.5px', color: '#475569', lineHeight: '1.4', wordBreak: 'break-word' }}>
                        {item.message}
                      </div>

                      {/* Document Pill & Action Link */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '4px' }}>
                        <span
                          style={{
                            fontSize: '10px',
                            fontWeight: '700',
                            backgroundColor: '#F1F5F9',
                            color: '#475569',
                            padding: '1px 6px',
                            borderRadius: '4px'
                          }}
                        >
                          {item.document_id}
                        </span>
                        {item.target_tab && (
                          <span
                            style={{
                              fontSize: '10.5px',
                              fontWeight: '700',
                              color: '#0E7490',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '2px'
                            }}
                          >
                            Open in {item.target_tab} →
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Blue Unread Dot Indicator */}
                    {isUnread && (
                      <div
                        style={{
                          width: '7px',
                          height: '7px',
                          borderRadius: '50%',
                          backgroundColor: '#0E7490',
                          flexShrink: 0,
                          marginTop: '6px',
                          boxShadow: '0 0 0 2px #CFFAFE'
                        }}
                      />
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
